from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict, Any
from .matchers import match_prop

@dataclass
class ComponentNode:
    type: str
    props: Dict[str, Any]
    children: List['ComponentNode']
    path: str

    def flatten(self) -> List['ComponentNode']:
        out: List[ComponentNode] = []
        stack = [self]
        while stack:
            n = stack.pop()
            out.append(n)
            stack.extend(reversed(n.children))
        return out

def evaluate_expected_component(spec: Dict[str, Any], nodes: List[ComponentNode]) -> Dict[str, Any]:
    candidates = [n for n in nodes if n.type == spec["type"]]
    coverage_pass = len(candidates) >= spec.get("count", 1)
    prop_results: Dict[str,bool] = {}
    for prop_name, matcher in (spec.get("required_props") or {}).items():
        prop_results[prop_name] = any(
            match_prop(c.props.get(prop_name), matcher) for c in candidates
        )
    return {
        "type": spec["type"],
        "coverage_pass": coverage_pass,
        "prop_results": prop_results
    }

def summarize_component_evals(evals: List[Dict[str, Any]]) -> Dict[str, Any]:
    cov_passed = sum(1 for e in evals if e["coverage_pass"])
    cov_total = len(evals)
    prop_total = sum(len(e["prop_results"]) for e in evals)
    prop_pass = sum(sum(1 for v in e["prop_results"].values() if v) for e in evals)
    return {
        "componentCoverage": cov_passed / cov_total if cov_total else 0.0,
        "propFidelity": prop_pass / prop_total if prop_total else 0.0,
        "raw": evals
    }
