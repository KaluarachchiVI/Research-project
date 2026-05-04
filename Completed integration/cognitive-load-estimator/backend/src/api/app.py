"""Exposes the estimator microservice via a FastAPI application."""

from __future__ import annotations

import asyncio
import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
import logging
from typing import Any, Dict, Optional, List

from fastapi import Depends, FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from backend.src.core.config import AppConfig
from backend.src.core.events import Event, utc_now
from backend.src.services.service import EstimatorService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


class EventIn(BaseModel):
    source: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    timestamp: Optional[datetime] = None


class EmaResponseIn(BaseModel):
    prompt_id: int
    rating: int = Field(ge=1, le=7)
    disposition: str
    note: Optional[str] = None


class PrivacyToggle(BaseModel):
    active: bool


class ConsentToggle(BaseModel):
    granted: bool


class ExportRequest(BaseModel):
    reviewer: Optional[str] = None


class ExportApproval(BaseModel):
    reviewer: str
    token: Optional[str] = None


class ContextBlocklistUpdate(BaseModel):
    entries: List[str]


class IdleBlockUpdate(BaseModel):
    seconds: int = Field(ge=0, le=86400)


def create_service(config_path: Optional[Path] = None) -> EstimatorService:
    config = AppConfig.load(config_path)
    config.ensure_storage_parent()
    logger.info("Loaded app configuration (config_path=%s)", config_path or "default")
    return EstimatorService(config)


def create_app(config_path: Optional[Path] = None) -> FastAPI:
    logger.info("Creating estimator service")
    service = create_service(config_path)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        logger.info("Starting estimator service runtime loop")
        await service.start()
        try:
            yield
        finally:
            logger.info("Stopping estimator service runtime loop")
            await service.stop()

    app = FastAPI(
        title="Cognitive Load Estimator (Python)",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.service = service

    service_config = service.config.service
    app.add_middleware(
        CORSMiddleware,
        allow_origins=service_config.cors_allowed_origins,
        allow_credentials=False,
        allow_methods=service_config.cors_allowed_methods,
        allow_headers=service_config.cors_allowed_headers,
        expose_headers=["*"],
    )

    def get_service() -> EstimatorService:
        # Explicit cast to satisfy mypy
        from typing import cast
        return cast(EstimatorService, app.state.service)

    def require_api_key(
        x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
        api_key_query: Optional[str] = Query(default=None, alias="api_key"),
    ) -> None:
        security = service.config.security
        if not security.require_api_key:
            return
        if not security.api_key:
            raise HTTPException(status_code=500, detail="API key auth is enabled but not configured")
        provided_key = x_api_key or api_key_query
        if provided_key != security.api_key:
            raise HTTPException(status_code=401, detail="invalid API key")

    @app.post("/events", dependencies=[Depends(require_api_key)])
    async def ingest_event(evt: EventIn, svc: EstimatorService = Depends(get_service)) -> Dict[str, Any]:
        logger.debug("Received event from %s with payload keys=%s", evt.source, list(evt.payload.keys()))
        
        ts = evt.timestamp or utc_now()
        if ts.tzinfo is None:
             ts = ts.replace(tzinfo=timezone.utc)
        
        event = Event(
            timestamp=ts,
            source=evt.source,
            payload=evt.payload,
        )
        accepted = await svc.ingest_event(event)
        return {"accepted": accepted}

    @app.post("/ema/response", dependencies=[Depends(require_api_key)])
    async def ema_response(
        payload: EmaResponseIn, svc: EstimatorService = Depends(get_service)
    ) -> Dict[str, Any]:
        logger.info(
            "Recording EMA response (prompt_id=%s disposition=%s)",
            payload.prompt_id,
            payload.disposition,
        )
        await svc.ingest_ema_response(
            prompt_id=payload.prompt_id,
            rating=payload.rating,
            disposition=payload.disposition,
            note=payload.note,
        )
        return {"status": "ok"}

    @app.get("/estimate", dependencies=[Depends(require_api_key)])
    async def latest_estimate(svc: EstimatorService = Depends(get_service)) -> Dict[str, Any]:
        payload = svc.latest_payload()
        if not payload:
            raise HTTPException(status_code=404, detail="no estimate yet")
        return payload

    @app.get("/health")
    async def health(svc: EstimatorService = Depends(get_service)) -> Dict[str, Any]:
        state = svc.latest()
        return {
            "status": "ok",
            "baseline_active": state.baseline_active if state else True,
            "hop_index": state.hop_index if state else 0,
        }

    @app.get("/telemetry", dependencies=[Depends(require_api_key)])
    async def telemetry(svc: EstimatorService = Depends(get_service)) -> Dict[str, Any]:
        return svc.telemetry()

    @app.get("/ema/pending", dependencies=[Depends(require_api_key)])
    async def pending_prompt(svc: EstimatorService = Depends(get_service)) -> Dict[str, Any]:
        prompt = await svc.pending_prompt()
        return {"prompt": prompt}

    @app.get("/telemetry/feed", dependencies=[Depends(require_api_key)])
    async def telemetry_feed(
        limit: int = 200, svc: EstimatorService = Depends(get_service)
    ) -> StreamingResponse:
        async def iterator():
            metrics = await svc.storage.fetch_telemetry_metrics(limit)
            for metric in metrics:
                yield json.dumps(metric) + "\n"

        return StreamingResponse(iterator(), media_type="application/x-ndjson")

    @app.get("/stream/state", dependencies=[Depends(require_api_key)])
    async def stream_state(svc: EstimatorService = Depends(get_service)) -> StreamingResponse:
        async def event_generator():
            try:
                async for snapshot in svc.state_updates():
                    yield f"data: {json.dumps(snapshot, default=str)}\n\n"
            except asyncio.CancelledError:
                return

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    @app.post("/privacy", dependencies=[Depends(require_api_key)])
    async def set_privacy(
        payload: PrivacyToggle, svc: EstimatorService = Depends(get_service)
    ) -> Dict[str, bool]:
        logger.info("Privacy pause set to %s", payload.active)
        svc.set_privacy_pause(payload.active)
        return svc.permissions_status()

    @app.post("/consent", dependencies=[Depends(require_api_key)])
    async def set_consent(
        payload: ConsentToggle, svc: EstimatorService = Depends(get_service)
    ) -> Dict[str, bool]:
        logger.info("Consent flag set to %s", payload.granted)
        svc.set_consent(payload.granted)
        return svc.permissions_status()

    @app.get("/permissions", dependencies=[Depends(require_api_key)])
    async def permissions(svc: EstimatorService = Depends(get_service)) -> Dict[str, Any]:
        logger.debug("Permissions status requested")
        return svc.permissions_status()

    @app.post("/permissions/context", dependencies=[Depends(require_api_key)])
    async def update_context_blocklist(
        payload: ContextBlocklistUpdate, svc: EstimatorService = Depends(get_service)
    ) -> Dict[str, Any]:
        logger.info("Updating context blocklist to %s", payload.entries)
        svc.set_context_blocklist(payload.entries)
        return svc.permissions_status()

    @app.post("/permissions/idle", dependencies=[Depends(require_api_key)])
    async def update_idle_block(
        payload: IdleBlockUpdate, svc: EstimatorService = Depends(get_service)
    ) -> Dict[str, Any]:
        logger.info("Updating idle block seconds to %s", payload.seconds)
        svc.set_idle_block_seconds(payload.seconds)
        return svc.permissions_status()

    @app.get("/policy/consent", dependencies=[Depends(require_api_key)])
    async def consent_history(svc: EstimatorService = Depends(get_service)) -> Dict[str, Any]:
        return {"entries": svc.consent_history()}

    @app.get("/policy/events", dependencies=[Depends(require_api_key)])
    async def policy_events(
        limit: int = 100, svc: EstimatorService = Depends(get_service)
    ) -> Dict[str, Any]:
        return {"events": await svc.policy_events(limit)}

    @app.get("/distractions", dependencies=[Depends(require_api_key)])
    async def distractions(
        limit: int = 50, svc: EstimatorService = Depends(get_service)
    ) -> Dict[str, Any]:
        return {"periods": await svc.distraction_history(limit)}

    @app.post("/export/request", dependencies=[Depends(require_api_key)])
    async def export_request(
        payload: ExportRequest, svc: EstimatorService = Depends(get_service)
    ) -> Dict[str, Any]:
        try:
            result = await svc.request_export(payload.reviewer)
        except RuntimeError as exc:
            raise HTTPException(status_code=403, detail=str(exc))
        return result

    @app.get("/export", dependencies=[Depends(require_api_key)])
    async def list_exports(status: Optional[str] = None, svc: EstimatorService = Depends(get_service)) -> Dict[str, Any]:
        exports = await svc.list_exports(status)
        return {"exports": exports}

    @app.post("/export/{export_id}/approve", dependencies=[Depends(require_api_key)])
    async def approve_export(
        export_id: int, payload: ExportApproval, svc: EstimatorService = Depends(get_service)
    ) -> Dict[str, Any]:
        try:
            export = await svc.approve_export(export_id, payload.reviewer, payload.token)
        except PermissionError as exc:
            raise HTTPException(status_code=401, detail=str(exc))
        except (RuntimeError, FileNotFoundError) as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        return export

    @app.get("/export/{export_id}/download", dependencies=[Depends(require_api_key)])
    async def download_export(export_id: int, svc: EstimatorService = Depends(get_service)) -> FileResponse:
        export = await svc.get_export(export_id)
        if not export or export["status"] != "approved" or not export.get("file_path"):
            raise HTTPException(status_code=404, detail="approved export not found")
        path = Path(export["file_path"])
        if not path.exists():
            raise HTTPException(status_code=404, detail="export file missing")
        return FileResponse(path, filename=path.name, media_type="application/json")

    return app


# Module-level app instance for Uvicorn
app = create_app()
