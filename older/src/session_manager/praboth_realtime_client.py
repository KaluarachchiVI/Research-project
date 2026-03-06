"""
Real-time Praboth Client - Polls praboth API for cognitive load estimates during active sessions
"""
import requests
import time
import threading
import logging
from typing import Optional, Callable, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class PrabothRealtimeClient:
    """
    Client for polling praboth /estimate endpoint during active sessions
    to get real-time cognitive load estimates
    """
    
    def __init__(self, api_url: str = "http://localhost:8000", poll_interval: int = 15):
        """
        Initialize real-time praboth client
        
        Args:
            api_url: Base URL of praboth API service
            poll_interval: Interval in seconds between polls
        """
        self.api_url = api_url.rstrip('/')
        self.poll_interval = poll_interval
        self.is_polling = False
        self.poll_thread: Optional[threading.Thread] = None
        self.cognitive_load_callback: Optional[Callable[[float, Dict], None]] = None
        self.last_estimate: Optional[Dict[str, Any]] = None
        self._stop_event = threading.Event()
    
    def start_polling(self, callback: Callable[[float, Dict], None]):
        """
        Start polling praboth /estimate endpoint
        
        Args:
            callback: Function to call with (cognitive_load, full_estimate_dict)
        """
        if self.is_polling:
            logger.warning("Already polling praboth API")
            return
        
        self.cognitive_load_callback = callback
        self.is_polling = True
        self._stop_event.clear()
        
        self.poll_thread = threading.Thread(target=self._poll_loop, daemon=True)
        self.poll_thread.start()
        logger.info(f"Started polling praboth API at {self.api_url}/estimate every {self.poll_interval}s")
    
    def stop_polling(self):
        """Stop polling praboth API"""
        if not self.is_polling:
            return
        
        self.is_polling = False
        self._stop_event.set()
        
        if self.poll_thread:
            self.poll_thread.join(timeout=5.0)
        
        logger.info("Stopped polling praboth API")
    
    def _poll_loop(self):
        """Main polling loop with error handling and retry logic"""
        consecutive_errors = 0
        max_consecutive_errors = 5
        empty_estimate_count = 0
        
        while self.is_polling and not self._stop_event.is_set():
            try:
                estimate = self._fetch_estimate()
                # Treat "no estimate yet" (e.g., empty JSON, None) as a
                # normal warm‑up condition, not as a connectivity error.
                if estimate not in (None, {}):
                    self.last_estimate = estimate
                    cognitive_load = self._extract_cognitive_load(estimate)
                    if cognitive_load is not None and self.cognitive_load_callback:
                        self.cognitive_load_callback(cognitive_load, estimate)
                        consecutive_errors = 0  # Reset error counter on success
                        empty_estimate_count = 0
                    elif cognitive_load is None:
                        logger.debug("Could not extract cognitive load from praboth estimate")
                else:
                    empty_estimate_count += 1
                    # Log occasionally so we can see warm‑up, but don't
                    # claim the service is unavailable if HTTP is fine.
                    if empty_estimate_count in (5, 10, 20, 50):
                        logger.info(
                            f"Praboth API returned empty/no estimate {empty_estimate_count} times. "
                            "Service is reachable but may still be warming up or has no input events."
                        )
            except requests.exceptions.RequestException as e:
                consecutive_errors += 1
                if consecutive_errors >= max_consecutive_errors:
                    logger.warning(f"Praboth API connection error {consecutive_errors} times: {e}")
            except Exception as e:
                logger.error(f"Unexpected error polling praboth API: {e}", exc_info=True)
                consecutive_errors += 1
            
            # Wait for poll interval or stop event
            self._stop_event.wait(timeout=self.poll_interval)
    
    def _fetch_estimate(self) -> Optional[Dict[str, Any]]:
        """
        Fetch latest estimate from praboth API
        
        Returns:
            Estimate dictionary or None if error
        """
        try:
            response = requests.get(
                f"{self.api_url}/estimate",
                timeout=5.0
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.debug(f"Failed to fetch praboth estimate: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching estimate: {e}")
            return None
    
    def _extract_cognitive_load(self, estimate: Dict[str, Any]) -> Optional[float]:
        """
        Extract cognitive load value from estimate response
        
        Args:
            estimate: Estimate dictionary from praboth API
        
        Returns:
            Cognitive load value [0, 1] or None if not available
        """
        # Praboth API returns estimate with structure:
        # {
        #   "load": <cognitive_load>,
        #   "variance": <variance>,
        #   "load_state": "low/medium/high cognitive load",
        #   "context_flags": {...},
        #   ...
        # }
        
        try:
            # Check for direct 'load' field (from latest_payload)
            if 'load' in estimate:
                return float(estimate['load'])
            
            # Check nested estimate structure
            if 'estimate' in estimate and estimate['estimate']:
                estimate_data = estimate['estimate']
                if 'load' in estimate_data:
                    return float(estimate_data['load'])
                if 'latent_mean' in estimate_data:
                    return float(estimate_data['latent_mean'])
            
            # Fallback: check for direct latent_mean
            if 'latent_mean' in estimate:
                return float(estimate['latent_mean'])
            
            return None
        except (KeyError, ValueError, TypeError) as e:
            logger.debug(f"Could not extract cognitive load from estimate: {e}")
            return None
    
    def get_latest_estimate(self) -> Optional[Dict[str, Any]]:
        """
        Get the latest estimate without polling
        
        Returns:
            Latest estimate dictionary or None
        """
        if not self.last_estimate:
            # Try to fetch once
            self.last_estimate = self._fetch_estimate()
        return self.last_estimate
    
    def get_latest_cognitive_load(self) -> Optional[float]:
        """
        Get the latest cognitive load value
        
        Returns:
            Cognitive load [0, 1] or None if not available
        """
        estimate = self.get_latest_estimate()
        if estimate:
            return self._extract_cognitive_load(estimate)
        return None
    
    def is_service_available(self) -> bool:
        """
        Check if praboth service is available
        
        Returns:
            True if service is reachable
        """
        # Newer cog-py-est builds expose a very minimal API surface:
        # - /estimate (primary data endpoint)
        # - /events   (ingest)
        # Some configs do NOT provide a /health endpoint. To make this client
        # robust across versions, we:
        #  1) Prefer /health when it exists and returns 200
        #  2) Fallback to checking /estimate directly (which we know is present)
        #
        # This avoids the situation where /estimate is working but a missing
        # /health route makes the scheduler think praboth is offline.
        try:
            health_resp = requests.get(f"{self.api_url}/health", timeout=2.0)
            if health_resp.status_code == 200:
                return True
        except Exception:
            # Ignore and fall back to /estimate
            pass

        try:
            estimate_resp = requests.get(f"{self.api_url}/estimate", timeout=2.0)
            return estimate_resp.status_code == 200
        except Exception:
            return False

