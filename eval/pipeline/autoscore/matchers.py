from __future__ import annotations
import re
from typing import Any

def match_prop(value: Any, matcher: Any) -> bool:
    """Match a value against a matcher spec.
    Supported forms:
      - string: exact
      - list[str]: one-of
      - {"regex": pattern}
      - {"exists": bool}
    """
    if isinstance(matcher, str):
        return value == matcher
    if isinstance(matcher, list):
        return value in matcher
    if isinstance(matcher, dict):
        if "regex" in matcher:
            return bool(value) and re.search(matcher["regex"], str(value)) is not None
        if "exists" in matcher:
            return (value is not None) if matcher["exists"] else (value is None)
    return False
