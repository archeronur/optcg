#!/usr/bin/env python3
"""
Fetches card data from OPTCG API and builds a local card database.
This gives us card names, images, types, colors, etc.
"""

import json
import os
import time
import requests

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
CARDS_FILE = os.path.join(DATA_DIR, "cards.json")

API_BASE = "https://optcgapi.com/api"

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/json",
})


def fetch_json(url, retries=3):
    for attempt in range(retries):
        try:
            resp = session.get(url, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            print(f"  Retry {attempt+1}/{retries} for {url}: {e}")
            time.sleep(2 * (attempt + 1))
    return None


def collect_all_card_ids():
    """Collect all unique card IDs from scraped event data."""
    card_ids = set()
    metas_dir = os.path.join(DATA_DIR, "metas")
    for fname in os.listdir(metas_dir):
        if not fname.endswith(".json"):
            continue
        with open(os.path.join(metas_dir, fname), "r") as f:
            meta = json.load(f)
        for event in meta.get("events", []):
            for deck in event.get("decks", []):
                lid = deck.get("leaderId", "")
                if lid:
                    card_ids.add(lid)
                for card in deck.get("cards", []):
                    card_ids.add(card["id"])
        for ls in meta.get("leaderStats", []):
            lid = ls.get("leaderId", "")
            if lid:
                card_ids.add(lid)
            for cc in ls.get("coreCards", []):
                card_ids.add(cc["id"])
            for fc in ls.get("flexCards", []):
                card_ids.add(fc["id"])
    return card_ids


def fetch_card_data(card_id):
    """Fetch card data from OPTCG API, trying sets, decks, and promos endpoints."""
    prefix = card_id.split("-")[0] if "-" in card_id else ""

    if prefix.startswith("ST") or prefix.startswith("st"):
        data = fetch_json(f"{API_BASE}/decks/card/{card_id}/?format=json")
        if data and len(data) > 0:
            return data[0]

    if prefix.startswith("EB") or prefix.startswith("PRB"):
        data = fetch_json(f"{API_BASE}/sets/card/{card_id}/?format=json")
        if data and len(data) > 0:
            return data[0]
        data = fetch_json(f"{API_BASE}/decks/card/{card_id}/?format=json")
        if data and len(data) > 0:
            return data[0]

    data = fetch_json(f"{API_BASE}/sets/card/{card_id}/?format=json")
    if data and len(data) > 0:
        return data[0]

    data = fetch_json(f"{API_BASE}/decks/card/{card_id}/?format=json")
    if data and len(data) > 0:
        return data[0]

    return None


def main():
    existing = {}
    if os.path.exists(CARDS_FILE):
        with open(CARDS_FILE, "r") as f:
            existing = json.load(f)
        print(f"Loaded {len(existing)} existing cards from cache")

    card_ids = collect_all_card_ids()
    print(f"Found {len(card_ids)} unique card IDs in event data")

    new_ids = [cid for cid in card_ids if cid not in existing]
    print(f"Need to fetch {len(new_ids)} new cards")

    for i, card_id in enumerate(sorted(new_ids)):
        print(f"  [{i+1}/{len(new_ids)}] Fetching {card_id}...", end=" ")
        card_data = fetch_card_data(card_id)
        if card_data:
            existing[card_id] = {
                "id": card_id,
                "name": card_data.get("card_name", "").split(" - ")[0].split(" (")[0],
                "fullName": card_data.get("card_name", ""),
                "image": card_data.get("card_image", ""),
                "imageId": card_data.get("card_image_id", ""),
                "color": card_data.get("card_color", ""),
                "type": card_data.get("card_type", ""),
                "cost": card_data.get("card_cost"),
                "power": card_data.get("card_power"),
                "counter": card_data.get("card_counter_amount"),
                "rarity": card_data.get("rarity", ""),
                "text": card_data.get("card_text", ""),
                "attribute": card_data.get("attribute", ""),
                "subTypes": card_data.get("sub_types", ""),
                "life": card_data.get("life"),
                "set": card_data.get("set_name", ""),
                "price": card_data.get("market_price"),
            }
            print("OK")
        else:
            existing[card_id] = {
                "id": card_id,
                "name": card_id,
                "fullName": card_id,
                "image": "",
                "imageId": "",
                "color": "",
                "type": "",
                "cost": None,
                "power": None,
                "counter": None,
                "rarity": "",
                "text": "",
                "attribute": "",
                "subTypes": "",
                "life": None,
                "set": "",
                "price": None,
            }
            print("NOT FOUND")

        if (i + 1) % 50 == 0:
            with open(CARDS_FILE, "w") as f:
                json.dump(existing, f, ensure_ascii=False, indent=2)
            print(f"  Saved checkpoint ({len(existing)} cards)")

        time.sleep(0.3)

    with open(CARDS_FILE, "w") as f:
        json.dump(existing, f, ensure_ascii=False, indent=2)
    print(f"\nDone! Saved {len(existing)} cards to {CARDS_FILE}")


if __name__ == "__main__":
    main()
