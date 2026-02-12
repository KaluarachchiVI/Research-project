"""Context classification using LLMs with caching for privacy."""

import hashlib
import json
import logging
import asyncio
from typing import Optional, Tuple

from backend.src.data.storage import Storage

logger = logging.getLogger(__name__)

class ContextClassifier:
    def __init__(self, storage: Storage, api_key: Optional[str] = None, model: str = "gemini-pro") -> None:
        self.storage = storage
        self.api_key = api_key
        self.model = model

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
            return cached

        # 2. LLM Classification (or Fallback)
        is_study, category = await self._query_llm(app_name, window_title)
        
        # 3. Cache Result (Key ONLY, no plaintext)
        await self.storage.cache_classification(cache_key, is_study, category)
        
        return is_study, category

    async def _query_llm(self, app_name: str, window_title: str) -> Tuple[bool, str]:
        if not self.api_key:
            return self._simple_fallback(app_name, window_title)

        try:
            # O*NET Based Taxonomy Prompt
            prompt = f"""
            Classify the user's context into one of the following cognitive activities based on O*NET Work Activities:

            1. Information Gathering (Browsing documentation, reading papers, searching)
            2. Information Processing (Coding, debugging, analyzing data, writing logic)
            3. Communicating (Email, Slack, Teams, Meetings)
            4. Creative Thinking (Design, brainstorming, planning)
            5. Admin/Routine (File management, settings, updates)
            6. Distraction/Entertainment (Social media, games, video streaming)

            Context:
            App: {app_name}
            Window Title: {window_title}

            Return a valid JSON object with the following keys:
            - "activity": One of the 6 categories above.
            - "is_study": true if 1, 2, 4; false if 6; maybe true/false for 3/5 depending on context (assume true for professional communication).

            JSON:
            """
            
            # Simulated LLM Response parsing
            # In production: response = await model.generate_content(prompt)
            # data = json.loads(response.text)
            # return data["is_study"], data["activity"]

            # Fallback to simple logic since we don't have a real LLM connected in this env
            return self._simple_fallback(app_name, window_title)

        except Exception as e:
            logger.error("LLM classification failed: %s", e)
            return self._simple_fallback(app_name, window_title)

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
