"""Подбор рекомендуемого пакета AUVIX и оценка потенциальной выручки по лиду."""
from __future__ import annotations


def estimate_package(profile: dict, lead: dict) -> tuple[str, int]:
    status = lead.get("website_status")
    has_form = lead.get("has_form")

    if status in ("no_site", "unreachable") or (status or "").startswith("error_"):
        pkg = profile["services"]["web"]["landing_basic"]
    elif status == "ok" and not has_form:
        pkg = profile["services"]["web"]["landing_pro"]
    else:
        pkg = profile["services"]["bots"]["simple"]

    return pkg["name"], pkg["price_from"]
