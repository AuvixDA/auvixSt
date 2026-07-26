"""Генерация персонализированного холодного питча для лида от лица AUVIX Studio."""
import json
import os
from pathlib import Path

import anthropic

PROFILE_PATH = Path(__file__).parent / "studio_profile.json"
MODEL = os.environ.get("AUVIX_PITCH_MODEL", "claude-opus-5")


def load_profile() -> dict:
    return json.loads(PROFILE_PATH.read_text(encoding="utf-8"))


def build_system_prompt(profile: dict) -> str:
    services_text = json.dumps(profile["services"], ensure_ascii=False, indent=2)
    usp_text = "\n".join(f"- {item}" for item in profile["usp"])
    return f"""Ты — ассистент студии {profile['name']} (основатель — {profile['founder']}).
Твоя задача: написать короткое холодное сообщение от лица студии владельцу конкретного бизнеса.

Позиционирование студии: {profile['positioning']}

УТП:
{usp_text}

Услуги и цены (используй только то, что релевантно конкретной ситуации, называй реальные цифры "от"):
{services_text}

Портфолио для ссылки при необходимости: {profile['contacts']['cases']}

Правила:
- Пиши по-русски, обращение на «вы», без канцелярита и без эмодзи.
- 3–5 предложений — это первое холодное сообщение, а не коммерческое предложение.
- Обязательно упомяни конкретную проблему или возможность именно этого бизнеса (передана в запросе).
- Предложи один конкретный релевантный продукт с ценой "от".
- Не выдумывай кейсы, отзывы или цифры результатов, которых нет в данных выше.
- Заверши мягким вопросом или предложением обсудить, без давления и без "заходите к нам".
- Не подписывайся именем — сообщение отправит вручную владелец студии."""


def generate_pitch(client: anthropic.Anthropic, profile: dict, lead: dict) -> str:
    system_prompt = build_system_prompt(profile)
    lead_brief = (
        f"Название: {lead.get('name', '—')}\n"
        f"Ниша: {lead.get('niche', '—')}\n"
        f"Город: {lead.get('city', '—')}\n"
        f"Статус сайта: {lead.get('website_status', '—')}\n"
        f"Есть форма заявки на сайте: {'да' if lead.get('has_form') else 'нет'}"
    )
    response = client.messages.create(
        model=MODEL,
        max_tokens=500,
        thinking={"type": "disabled"},
        output_config={"effort": "low"},
        system=system_prompt,
        messages=[{"role": "user", "content": lead_brief}],
    )
    if response.stop_reason == "refusal":
        return "[Не удалось сгенерировать текст — отказ модели, проверьте вручную]"
    return "".join(block.text for block in response.content if block.type == "text").strip()
