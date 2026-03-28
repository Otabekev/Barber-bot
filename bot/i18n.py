import json
import os
from typing import Dict

_translations: Dict[str, dict] = {}

_LOCALES_DIR = os.path.join(os.path.dirname(__file__), "locales")


def _load(lang: str) -> dict:
    if lang not in _translations:
        path = os.path.join(_LOCALES_DIR, f"{lang}.json")
        with open(path, encoding="utf-8") as f:
            _translations[lang] = json.load(f)
    return _translations[lang]


def t(key: str, lang: str = "uz", **kwargs) -> str:
    """Translate a key for the given language, with optional format args."""
    data = _load(lang if lang in ("uz", "ru", "en") else "uz")
    text = data.get(key, key)
    if kwargs:
        text = text.format(**kwargs)
    return text
