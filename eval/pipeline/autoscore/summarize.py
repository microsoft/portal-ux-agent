from __future__ import annotations
from typing import List, Dict, Any
from .rules import ComponentNode

SALIENT_KEYS = {"title","label","type","columns","itemType"}

def summarize_nodes(nodes: List[ComponentNode]) -> list[dict[str,Any]]:
    out = []
    for n in nodes:
        salient = {k:v for k,v in (n.props or {}).items() if k in SALIENT_KEYS}
        out.append({"type": n.type, "props": salient, "path": n.path})
    return out
