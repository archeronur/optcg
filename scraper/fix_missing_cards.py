#!/usr/bin/env python3
"""Fetch missing card data from Limitless TCG API and optcgapi.com."""

import json
import os
import sys
import time
import urllib.request
import urllib.error

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
CARDS_FILE = os.path.join(DATA_DIR, "cards.json")

LIMITLESS_API = "https://onepiece.limitlesstcg.com/api/cards"
OPTCG_API = "https://optcgapi.com/api/cards"

def fetch_json(url, timeout=10):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            ct = resp.headers.get("content-type", "")
            if "json" not in ct and "text" not in ct:
                return None
            data = resp.read().decode("utf-8")
            if not data.strip():
                return None
            return json.loads(data)
    except Exception as e:
        print(f"  Error fetching {url}: {e}")
        return None


def fetch_from_limitless(card_id):
    """Try Limitless TCG API."""
    data = fetch_json(f"{LIMITLESS_API}/{card_id}")
    if not data:
        return None
    
    name = data.get("name") or data.get("card_name") or ""
    if not name or name == card_id:
        return None
    
    set_prefix = card_id.split("-")[0].lower() if "-" in card_id else ""
    image = ""
    if set_prefix:
        image = f"https://limitlesstcg.nyc3.digitaloceanspaces.com/one-piece/{set_prefix}/{card_id}_{card_id}.webp"

    return {
        "name": name,
        "image": image,
        "color": data.get("color") or data.get("card_color") or "",
        "type": data.get("category") or data.get("type") or "",
        "cost": data.get("cost") or data.get("card_cost"),
        "power": data.get("power") or data.get("card_power"),
        "rarity": data.get("rarity") or "",
        "text": data.get("effect") or data.get("text") or "",
        "attribute": data.get("attribute") or "",
        "subTypes": data.get("types") or "",
        "life": data.get("life"),
        "set": data.get("set_name") or data.get("set") or "",
    }


def fetch_from_optcg(card_id):
    """Try optcgapi.com."""
    set_prefix = card_id.split("-")[0] if "-" in card_id else ""
    
    # For promo cards
    if card_id.startswith("P-"):
        urls = [
            f"{OPTCG_API}?card_set_id={card_id}",
        ]
    else:
        set_id = set_prefix
        urls = [
            f"{OPTCG_API}?card_set_id={card_id}",
            f"{OPTCG_API}?set={set_id}&card_set_id={card_id}",
        ]
    
    for url in urls:
        data = fetch_json(url)
        if data and isinstance(data, list) and len(data) > 0:
            card = data[0]
            name = card.get("card_name") or card.get("name") or ""
            if name and name != card_id:
                image = card.get("card_image") or ""
                if image and not image.startswith("http"):
                    image = f"https://{image}"
                return {
                    "name": name,
                    "image": image or f"https://optcgapi.com/media/static/Card_Images/{card_id}.jpg",
                    "color": card.get("card_color") or "",
                    "type": card.get("card_type") or card.get("category") or "",
                    "cost": card.get("card_cost"),
                    "power": card.get("card_power"),
                    "rarity": card.get("rarity") or "",
                    "text": card.get("card_effect") or "",
                    "attribute": card.get("card_attribute") or "",
                    "subTypes": card.get("card_types") or "",
                    "life": card.get("card_life"),
                    "set": card.get("set_name") or "",
                }
    return None


# Manual data for commonly known promo/special cards
KNOWN_CARDS = {
    "P-006": {"name": "Nami", "color": "Green", "type": "Character"},
    "P-009": {"name": "Tony Tony.Chopper", "color": "Green", "type": "Character"},
    "P-013": {"name": "Monkey.D.Luffy", "color": "Red", "type": "Character"},
    "P-015": {"name": "Trafalgar Law", "color": "Blue", "type": "Character"},
    "P-017": {"name": "Donquixote Doflamingo", "color": "Purple", "type": "Character"},
    "P-022": {"name": "Sanji", "color": "Blue", "type": "Character"},
    "P-046": {"name": "Roronoa Zoro", "color": "Green", "type": "Character"},
    "P-048": {"name": "Eustass\"Captain\"Kid", "color": "Red", "type": "Character"},
    "P-062": {"name": "Edward.Newgate", "color": "Red", "type": "Character"},
    "P-064": {"name": "Uta", "color": "Yellow", "type": "Character"},
    "P-077": {"name": "Portgas.D.Ace", "color": "Red", "type": "Character"},
    "P-084": {"name": "Yamato", "color": "Green", "type": "Character"},
    "P-093": {"name": "Monkey.D.Luffy", "color": "Red", "type": "Character"},
    "P-096": {"name": "Shanks", "color": "Red", "type": "Character"},
    "P-105": {"name": "Boa Hancock", "color": "Green", "type": "Character"},
    "P-107": {"name": "Roronoa Zoro", "color": "Green", "type": "Character"},
    "P-111": {"name": "Nico Robin", "color": "Purple", "type": "Character"},
    "OP01-000": {"name": "OP01 DON!! Card", "color": "", "type": "DON!!"},
    "OP03-000": {"name": "OP03 DON!! Card", "color": "", "type": "DON!!"},
    "OP04-000": {"name": "OP04 DON!! Card", "color": "", "type": "DON!!"},
}


def main():
    with open(CARDS_FILE, "r") as f:
        cards = json.load(f)

    # Find cards with name == id (fallback)
    missing = {k: v for k, v in cards.items() if v.get("name", "") == k}
    print(f"Found {len(missing)} cards with missing names")

    fixed = 0
    for card_id in sorted(missing.keys()):
        print(f"Fixing {card_id}...")
        
        # Try Limitless API first
        result = fetch_from_limitless(card_id)
        
        # Try optcgapi
        if not result:
            result = fetch_from_optcg(card_id)
        
        # Use known data
        if not result and card_id in KNOWN_CARDS:
            known = KNOWN_CARDS[card_id]
            set_prefix = card_id.split("-")[0].lower() if "-" in card_id else ""
            result = {
                "name": known["name"],
                "image": f"https://en.onepiece-cardgame.com/images/cardlist/card/{card_id}.png",
                "color": known.get("color", ""),
                "type": known.get("type", ""),
                "cost": None,
                "power": None,
                "rarity": "Promo" if card_id.startswith("P-") else "",
                "text": "",
                "attribute": "",
                "subTypes": "",
                "life": None,
                "set": "Promo" if card_id.startswith("P-") else "",
            }
        
        if result:
            existing = cards[card_id]
            existing["name"] = result["name"]
            existing["fullName"] = result.get("name", card_id)
            if result.get("image"):
                existing["image"] = result["image"]
            if result.get("color"):
                existing["color"] = result["color"]
            if result.get("type"):
                existing["type"] = result["type"]
            if result.get("rarity"):
                existing["rarity"] = result["rarity"]
            if result.get("text"):
                existing["text"] = result["text"]
            if result.get("set"):
                existing["set"] = result["set"]
            fixed += 1
            print(f"  -> {result['name']}")
        else:
            # Generate a better image URL even if we don't know the name
            if card_id.startswith("P-"):
                cards[card_id]["image"] = f"https://en.onepiece-cardgame.com/images/cardlist/card/{card_id}.png"
            print(f"  -> NOT FOUND (keeping ID as name)")
        
        time.sleep(0.3)

    with open(CARDS_FILE, "w") as f:
        json.dump(cards, f, indent=2, ensure_ascii=False)

    print(f"\nDone! Fixed {fixed}/{len(missing)} cards")


if __name__ == "__main__":
    main()
