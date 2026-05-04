"""Context classification using LLMs with caching for privacy."""

import asyncio
import hashlib
import json
import logging
import os
import urllib.error
import urllib.request
from typing import Optional, Tuple

from backend.src.data.storage import Storage

logger = logging.getLogger(__name__)

class ContextClassifier:
    def __init__(self, storage: Storage, api_key: Optional[str] = None, model: str = "llama3.2:3b") -> None:
        self.storage = storage
        self.api_key = api_key
        # Normalize legacy config values; we only support local Ollama here.
        normalized = (model or "").strip()
        if normalized.lower() in {"gemini-pro", "gemini"}:
            logger.warning("Ignoring legacy model '%s'; using llama3.2:3b via Ollama", normalized)
            normalized = "llama3.2:3b"
        self.model = normalized or "llama3.2:3b"

    def _hash_key(self, app_name: str, window_title: str) -> str:
        """Creates a privacy-preserving hash of the context identifier."""
        raw = f"{app_name.lower()}:{window_title.lower()}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    async def classify(self, app_name: str, window_title: str) -> Tuple[bool, str]:
        """
        Determines if the context is study-related.
        Returns: (is_study, category)
        """
        cache_key = self._hash_key(app_name, window_title)
        
        # 1. Check Cache
        cached = await self.storage.get_cached_classification(cache_key)
        if cached:
            is_study, category = cached
            return self._heuristic_override(app_name, window_title, is_study, category)

        # 2. LLM Classification (or Fallback)
        # Log only on cache misses (context changes), to avoid spamming.
        if os.environ.get("CLE_LOG_LLM", "").strip() in {"1", "true", "True", "yes", "YES"}:
            logger.info(
                "Classifier cache miss; querying Ollama model=%s app=%s title=%s",
                self.model,
                app_name,
                (window_title or "")[:160],
            )
        is_study, category = await self._query_llm(app_name, window_title)

        # 2b. Apply deterministic heuristics for common browser cases.
        is_study, category = self._heuristic_override(app_name, window_title, is_study, category)
        
        # 3. Cache Result (Key ONLY, no plaintext)
        await self.storage.cache_classification(cache_key, is_study, category)
        
        return is_study, category

    @staticmethod
    def _heuristic_override(
        app_name: str,
        window_title: str,
        is_study: bool,
        category: str,
    ) -> Tuple[bool, str]:
        """Best-effort deterministic adjustment.

        This exists because some contexts (especially YouTube in a browser) are
        high variance for an LLM, but users expect obvious "tutorial" tabs to be
        treated as study and "music video" tabs to be treated as distraction.
        """

        app = (app_name or "").lower()
        title = (window_title or "").lower()

        is_browser = any(x in app for x in ["chrome", "edge", "firefox", "brave", "browser"])
        if not is_browser:
            return is_study, category

        study_hints = [
            "tutorial",
            "course",
            "lecture",
            "lesson",
            "machine learning",
            "deep learning",
            "data science",
            "python",
            "pytorch",
            "tensorflow",
            "scikit",
            "sklearn",
            "linear regression",
            "neural network",
            "university",
            "research",
            "documentation",
            "docs",
        ]
        distraction_hints = [
            "official video",
            "music video",
            "lyrics",
            "spotify",
            "netflix",
            "trailer",
            "live stream",
            "tiktok",
            "reels",
            "shorts",
        ]

        if any(hint in title for hint in study_hints):
            return True, "research"
        if any(hint in title for hint in distraction_hints):
            return False, "entertainment"

        return is_study, category

    async def _query_llm(self, app_name: str, window_title: str) -> Tuple[bool, str]:
        prompt = (
            "Classify the user's context into one of the following cognitive activities based on O*NET Work Activities:\n\n"
            "1. Information Gathering (Browsing documentation, reading papers, searching)\n"
            "2. Information Processing (Coding, debugging, analyzing data, writing logic)\n"
            "3. Communicating (Email, Slack, Teams, Meetings)\n"
            "4. Creative Thinking (Design, brainstorming, planning)\n"
            "5. Admin/Routine (File management, settings, updates)\n"
            "6. Distraction/Entertainment (Social media, games, video streaming)\n\n"
            f"Context:\nApp: {app_name}\nWindow Title: {window_title}\n\n"
            "Return a valid JSON object with the following keys:\n"
            "- \"activity\": One of the 6 categories above.\n"
            "- \"is_study\": true if 1, 2, 4; false if 6; maybe true/false for 3/5 depending on context (assume true for professional communication).\n\n"
            "JSON:"
        )

        try:
            return await asyncio.to_thread(self._call_ollama, prompt)
        except Exception as exc:
            logger.error("LLM classification failed: %s", exc)
            return self._simple_fallback(app_name, window_title)

    def _call_ollama(self, prompt: str) -> Tuple[bool, str]:
        model = self.model if self.model else "llama3.2:3b"
        url = "http://localhost:11434/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.2, "num_predict": 256},
            "format": "json"
        }
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                body = response.read().decode("utf-8")
        except urllib.error.URLError as exc:
            raise RuntimeError(f"ollama request failed: {exc}") from exc

        data = json.loads(body)
        text = data.get("response", "").strip()
        
        if not text:
            raise RuntimeError("ollama returned empty response")

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            # Try to extract a JSON block if the model wrapped it in prose.
            start = text.find("{")
            end = text.rfind("}")
            if start == -1 or end == -1:
                raise RuntimeError("ollama response is not JSON")
            parsed = json.loads(text[start : end + 1])

        is_study = bool(parsed.get("is_study"))
        category = str(parsed.get("activity") or "other")
        return is_study, category

    def _simple_fallback(self, app_name: str, window_title: str) -> Tuple[bool, str]:
        """Offline keyword-based fallback."""
        app = app_name.lower()
        title = window_title.lower()
        
        if any(x in app for x in ["code", "visual studio", "pycharm", "intellij", "terminal", "powershell", "cmd"]):
            return True, "coding"
        
        if any(x in app for x in ["word", "docs", "obsidian", "notion"]):
            return True, "writing"
            
        if any(x in app for x in ["chrome", "edge", "firefox", "brave"]):
            # Browser is tricky; check title
            if any(x in title for x in ["github", "stackoverflow", "docs", "python", "tutorial", "course", "arxiv", "paper"]):
                return True, "research"
            return False, "browsing"
            
        if any(x in app for x in ["spotify", "netflix", "game", "steam", "discord"]):
            return False, "entertainment"

        # Default to neutral/study to avoid false positive distractions
        return True, "other"
