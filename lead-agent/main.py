#!/usr/bin/env python3
"""AUVIX Lead Agent — обогащение лидов, генерация питчей и отчёт по потенциальной выручке.

Использование:
    python main.py leads.csv --out result.xlsx
    python main.py leads.csv --out result.xlsx --skip-pitch   # без вызова Claude API
"""
from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

from openpyxl import Workbook

sys.path.insert(0, str(Path(__file__).parent))
from enrich import check_website
from pitch import generate_pitch, load_profile
from report import estimate_package

REQUIRED_COLUMNS = {"name", "niche", "city"}


def read_leads(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if missing:
            raise SystemExit(f"В CSV не хватает колонок: {', '.join(missing)}")
        return list(reader)


def write_report(path: str, rows: list[dict]) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Лиды"
    headers = [
        "Название", "Ниша", "Город", "Сайт", "Статус сайта", "Есть форма заявки",
        "Телефон", "Telegram", "Email", "Рекомендуемый пакет", "Потенциальная выручка, ₽",
        "Питч (черновик)", "Статус",
    ]
    ws.append(headers)
    total = 0
    for row in rows:
        total += row["revenue"]
        ws.append([
            row.get("name", ""), row.get("niche", ""), row.get("city", ""), row.get("website", ""),
            row["website_status"], "да" if row.get("has_form") else "нет",
            row.get("phone", ""), row.get("telegram", ""), row.get("email", ""),
            row["package"], row["revenue"], row["pitch"], "черновик готов",
        ])
    ws.append([])
    ws.append(["", "", "", "", "", "", "", "", "", "Итого потенциал:", total])
    for col in ws.columns:
        width = max((len(str(c.value)) for c in col if c.value), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(width + 2, 60)
    wb.save(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("input_csv", help="CSV со списком лидов (колонки: name,niche,city,website,phone,telegram,email)")
    parser.add_argument("--out", default="leads_report.xlsx", help="Путь к выходному .xlsx")
    parser.add_argument("--skip-pitch", action="store_true", help="Не вызывать Claude API — только обогащение и оценка выручки")
    args = parser.parse_args()

    leads = read_leads(args.input_csv)
    profile = load_profile()

    client = None
    if not args.skip_pitch:
        import anthropic
        client = anthropic.Anthropic()  # читает ключ из переменной окружения ANTHROPIC_API_KEY

    results = []
    for lead in leads:
        web_info = check_website(lead.get("website", ""))
        lead["website_status"] = web_info["status"]
        lead["has_form"] = web_info["has_form"]
        package, revenue = estimate_package(profile, lead)
        pitch = generate_pitch(client, profile, lead) if client else ""
        results.append({**lead, "package": package, "revenue": revenue, "pitch": pitch})
        print(f"✓ {lead.get('name', '?')} — {web_info['status']} — {package}")

    write_report(args.out, results)
    print(f"\nГотово: {args.out}")


if __name__ == "__main__":
    main()
