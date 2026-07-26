"""Проверка сайта лида: жив ли он и есть ли форма приёма заявок."""
import re

import requests

FORM_MARKERS = re.compile(
    r"(оставить заявку|заявк|форма обратной связи|<form|заказать звонок|callback)",
    re.IGNORECASE,
)
TIMEOUT = 8


def check_website(url: str) -> dict:
    """Возвращает {"status": ..., "has_form": bool} для заданного URL сайта лида."""
    url = (url or "").strip()
    if not url:
        return {"status": "no_site", "has_form": False}
    if not url.startswith("http"):
        url = "https://" + url
    try:
        resp = requests.get(
            url, timeout=TIMEOUT, headers={"User-Agent": "Mozilla/5.0"}, allow_redirects=True
        )
    except requests.RequestException:
        return {"status": "unreachable", "has_form": False}
    if resp.status_code >= 400:
        return {"status": f"error_{resp.status_code}", "has_form": False}
    has_form = bool(FORM_MARKERS.search(resp.text))
    return {"status": "ok", "has_form": has_form}
