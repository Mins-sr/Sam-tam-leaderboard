#!/usr/bin/env python3
"""Validate chaos-map/data/models.json structure, taxonomy integrity, and non-abstract fields."""

import json
import re
import sys
from datetime import date
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "models.json"
DEF_PATH = BASE_DIR / "docs" / "classification-definitions.md"

REQUIRED_TOP_KEYS = {"metadata", "taxonomies", "models"}
REQUIRED_META_KEYS = {"version", "last_updated", "schema_version", "definition_doc"}
REQUIRED_TAX_KEYS = {"task_types", "optimization_methods", "base_families"}
REQUIRED_MODEL_KEYS = {
    "id",
    "name",
    "task_types",
    "optimization_method",
    "optimization_methods_secondary",
    "params_million",
    "params_note",
    "fps_device",
    "venue",
    "base_model",
    "base_family",
    "github_url",
    "paper_url",
    "release_date",
    "description",
}

EXPECTED_TASKS = [
    "image_promptable",
    "image_automatic",
    "video_semi_supervised",
    "video_promptable",
    "video_open_vocabulary",
]

EXPECTED_METHODS = [
    "original_architecture",
    "backbone_redesign",
    "memory_compression",
    "knowledge_distillation",
    "sparse_acceleration",
    "runtime_optimization",
    "task_decoupling",
]

EXPECTED_FAMILIES = ["sam", "sam2", "sam3", "non_sam"]

DATE_RE = re.compile(r"^\d{4}-\d{2}$")
URL_RE = re.compile(r"^https://[^\s]+$")
PLACEHOLDER_RE = re.compile(r"(xxxxx|TBD|TODO|placeholder)", re.IGNORECASE)


def validate_lineage(data, model_ids):
    errors = []
    parents = {}
    for section, reference in (("derivatives", "parent_ids"), ("communities", "model_ids")):
        rows = data.get(section, [])
        if not isinstance(rows, list):
            errors.append(f"{section} must be a list")
            continue
        for index, row in enumerate(rows):
            label = f"{section}[{index}]"
            if not isinstance(row, dict):
                errors.append(f"{label} must be an object")
                continue
            fields = ["description"]
            if section == "derivatives":
                fields += ["id", "name", "kind", "weights"]
            for field in fields:
                if not isinstance(row.get(field), str) or not row[field].strip():
                    errors.append(f"{label}: missing {field}")
            try:
                day = row.get("checked_on")
                if date.fromisoformat(day).isoformat() != day:
                    raise ValueError
            except (ValueError, TypeError):
                errors.append(f"{label}: invalid checked_on")
            sources = row.get("sources")
            if not isinstance(sources, list) or not sources or any(
                not isinstance(source, dict) or not isinstance(source.get("label"), str)
                or not source["label"].strip() or not isinstance(source.get("url"), str)
                or not URL_RE.fullmatch(source["url"]) for source in sources
            ):
                errors.append(f"{label}: missing or invalid sources")
            refs = row.get(reference)
            if not isinstance(refs, list) or not refs or not all(isinstance(r, str) for r in refs):
                errors.append(f"{label}: invalid {reference}")
                continue
            if section == "communities":
                if set(refs) - model_ids:
                    errors.append(f"{label}: unknown model")
                continue
            key = row.get("id")
            if not isinstance(key, str) or key in parents or key in model_ids:
                errors.append(f"{label}: duplicate or invalid id")
                continue
            parents[key] = refs

    done = set()
    def visit(key, path):
        if key in path:
            errors.append(f"Cycle in derivatives: {key}")
        elif key not in done:
            for ref in parents[key]:
                if ref in parents:
                    visit(ref, path | {key})
                elif ref not in model_ids:
                    errors.append(f"{key}: unknown parent {ref}")
            done.add(key)

    for key in parents:
        visit(key, set())
    return errors


def main() -> int:
    errors: list[str] = []

    if not DEF_PATH.exists():
        errors.append(f"Missing definition document: {DEF_PATH}")

    if not DATA_PATH.exists():
        print(f"ERROR: Missing data file: {DATA_PATH}")
        return 1

    try:
        data = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"ERROR: Invalid JSON in {DATA_PATH}: {exc}")
        return 1

    missing_top = REQUIRED_TOP_KEYS - set(data.keys())
    if missing_top:
        errors.append(f"Missing top-level keys: {sorted(missing_top)}")

    meta = data.get("metadata", {})
    missing_meta = REQUIRED_META_KEYS - set(meta.keys())
    if missing_meta:
        errors.append(f"Missing metadata keys: {sorted(missing_meta)}")

    tax = data.get("taxonomies", {})
    missing_tax = REQUIRED_TAX_KEYS - set(tax.keys())
    if missing_tax:
        errors.append(f"Missing taxonomies keys: {sorted(missing_tax)}")

    task_ids = [t.get("id") for t in tax.get("task_types", [])]
    method_ids = [m.get("id") for m in tax.get("optimization_methods", [])]
    family_ids = [f.get("id") for f in tax.get("base_families", [])]

    if task_ids != EXPECTED_TASKS:
        errors.append(f"task_types IDs mismatch: got {task_ids}, expected {EXPECTED_TASKS}")
    if method_ids != EXPECTED_METHODS:
        errors.append(f"optimization_methods IDs mismatch: got {method_ids}, expected {EXPECTED_METHODS}")
    if family_ids != EXPECTED_FAMILIES:
        errors.append(f"base_families IDs mismatch: got {family_ids}, expected {EXPECTED_FAMILIES}")

    models = data.get("models", [])
    if not isinstance(models, list) or len(models) == 0:
        errors.append("models must be a non-empty list")

    seen_ids: set[str] = set()
    for idx, model in enumerate(models):
        label = model.get("id") or f"index[{idx}]"
        missing_keys = REQUIRED_MODEL_KEYS - set(model.keys())
        if missing_keys:
            errors.append(f"[{label}] Missing required keys: {sorted(missing_keys)}")
            continue

        mid = model["id"]
        if not isinstance(mid, str) or not mid:
            errors.append(f"[{label}] id must be non-empty string")
        elif mid in seen_ids:
            errors.append(f"[{label}] Duplicate model id: {mid}")
        seen_ids.add(mid)

        tasks = model["task_types"]
        if not isinstance(tasks, list) or len(tasks) == 0:
            errors.append(f"[{label}] task_types must be non-empty list")
        else:
            invalid_t = [t for t in tasks if t not in task_ids]
            if invalid_t:
                errors.append(f"[{label}] Invalid task_types: {invalid_t}")
            if len(tasks) != len(set(tasks)):
                errors.append(f"[{label}] Duplicate entries in task_types: {tasks}")

        opt = model["optimization_method"]
        if opt not in method_ids:
            errors.append(f"[{label}] Invalid optimization_method: {opt}")

        sec = model["optimization_methods_secondary"]
        if not isinstance(sec, list):
            errors.append(f"[{label}] optimization_methods_secondary must be list")
        else:
            invalid_s = [s for s in sec if s not in method_ids]
            if invalid_s:
                errors.append(f"[{label}] Invalid optimization_methods_secondary: {invalid_s}")
            if opt in sec:
                errors.append(f"[{label}] Primary optimization_method '{opt}' duplicated in secondary")
            if len(sec) != len(set(sec)):
                errors.append(f"[{label}] Duplicate entries in optimization_methods_secondary: {sec}")

        pm = model["params_million"]
        if pm is not None and (not isinstance(pm, (int, float)) or isinstance(pm, bool) or pm <= 0):
            errors.append(f"[{label}] params_million must be positive number or null, got {pm!r}")

        if model["base_family"] not in family_ids:
            errors.append(f"[{label}] Invalid base_family: {model['base_family']}")

        if not isinstance(model["release_date"], str) or not DATE_RE.match(model["release_date"]):
            errors.append(f"[{label}] release_date must be YYYY-MM, got {model['release_date']!r}")

        for url_field in ("github_url", "paper_url"):
            val = model[url_field]
            if val is not None:
                if not isinstance(val, str) or not URL_RE.match(val):
                    errors.append(f"[{label}] {url_field} invalid URL: {val!r}")
                elif PLACEHOLDER_RE.search(val):
                    errors.append(f"[{label}] {url_field} contains placeholder: {val!r}")

        for text_field in ("name", "params_note", "fps_device", "venue", "base_model", "description"):
            val = model[text_field]
            if not isinstance(val, str) or not val.strip():
                errors.append(f"[{label}] {text_field} must be non-empty string")
            elif PLACEHOLDER_RE.search(val):
                errors.append(f"[{label}] {text_field} contains placeholder text: {val!r}")

    errors.extend(validate_lineage(data, seen_ids))
    if errors:
        print(f"SCHEMA VALIDATION FAILED ({len(errors)} errors):")
        for err in errors:
            print(f"  - {err}")
        return 1

    print(f"SCHEMA VALIDATION PASSED: {len(models)} models verified against schema.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
