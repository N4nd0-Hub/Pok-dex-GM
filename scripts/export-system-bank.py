#!/usr/bin/env python3
"""Exporta o banco público a partir das constantes já utilizadas pela ficha."""
import argparse
import hashlib
import json
import re
from pathlib import Path


def read_constant(html, name):
    match = re.search(r"\bconst\s+" + re.escape(name) + r"\s*=\s*", html)
    if not match:
        raise ValueError(f"Constante não encontrada: {name}")
    value, _ = json.JSONDecoder().raw_decode(html[match.end():])
    if not isinstance(value, list) or not value:
        raise ValueError(f"Banco vazio ou incompatível: {name}")
    return value


def export(source, output, source_etag=None):
    html = source.read_text(encoding="utf-8")
    banks = {
        "abilities": read_constant(html, "CUSTOM_ABILITY_BANK"),
        "moves": read_constant(html, "CUSTOM_MOVE_BANK"),
        "rules": read_constant(html, "HHRPG_RULES"),
    }
    for key, rows in banks.items():
        field = "id" if key == "rules" else "name"
        names = [str(row.get(field, "")).strip().casefold() for row in rows]
        if any(not name for name in names) or len(names) != len(set(names)):
            raise ValueError(f"Entradas vazias ou duplicadas em {key}")
    canonical = json.dumps(banks, ensure_ascii=False, separators=(",", ":"))
    data = {
        "schema": "heaven-and-hell-system-v1",
        "title": "Ficha Pokémon · Heaven & Hell",
        "sourceUrl": "https://n4nd0-hub.github.io/ficha-pokemon/",
        "revision": hashlib.sha256(canonical.encode("utf-8")).hexdigest(),
        **banks,
    }
    if source_etag:
        data["sourceETag"] = source_etag
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print("Banco exportado: " + ", ".join(f"{len(rows)} {key}" for key, rows in banks.items()))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path("system-bank.json"))
    parser.add_argument("--source-etag", help="ETag da ficha publicada, opcional")
    args = parser.parse_args()
    export(args.input, args.output, args.source_etag)
