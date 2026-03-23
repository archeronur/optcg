#!/usr/bin/env python3
"""
Scraper for egmanevents.com One Piece TCG tournament data.
Fetches events, deck lists, and player data for each OP meta.
"""

import json
import os
import re
import sys
import time
from urllib.parse import urljoin, parse_qs, urlparse

import requests
from bs4 import BeautifulSoup

BASE_URL = "https://egmanevents.com"
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")

META_URLS = {
    "op01": "/op-op01",
    "op02": "/one-piece-op02",
    "op03": "/one-piece-op03",
    "op04": "/one-piece-op04",
    "op05": "/one-piece-op05",
    "op06": "/one-piece-op06",
    "op07": "/one-piece-op07",
    "op08": "/one-piece-op08",
    "op09": "/one-piece-op09",
    "op10": "/one-piece-op10-tournaments",
    "op11": "/one-piece-op11-tournaments",
    "op12": "/one-piece-op12-tournaments",
    "op13": "/one-piece-op13-tournaments",
    "op14": "/one-piece-op14-tournaments",
    "op15": "/one-piece-op15-tournaments",
}

META_NAMES = {
    "op01": "OP01 - Romance Dawn",
    "op02": "OP02 - Paramount War",
    "op03": "OP03 - Pillars of Strength",
    "op04": "OP04 - Kingdoms of Intrigue",
    "op05": "OP05 - Awakening of the New Era",
    "op06": "OP06 - Wings of the Captain",
    "op07": "OP07 - 500 Years in the Future",
    "op08": "OP08 - Two Legends",
    "op09": "OP09 - The Four Emperors",
    "op10": "OP10 - Royal Blood",
    "op11": "OP11 - Uta",
    "op12": "OP12 - A Transgenerational Bond",
    "op13": "OP13 - The Warring Kingdoms",
    "op14": "OP14 - The Azure Sea's Seven",
    "op15": "OP15",
}

session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
})


def fetch_page(url, retries=3):
    for attempt in range(retries):
        try:
            resp = session.get(url, timeout=30)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "lxml")
        except Exception as e:
            print(f"  Retry {attempt+1}/{retries} for {url}: {e}")
            time.sleep(2 * (attempt + 1))
    return None


def parse_deck_url(deck_url):
    """Extract card list from deck builder URL."""
    if not deck_url:
        return []

    if "deckbuilder" in deck_url:
        parsed = urlparse(deck_url)
        params = parse_qs(parsed.query)
        deck_str = params.get("deck", [""])[0]
        cards = []
        if deck_str:
            for card_entry in deck_str.split(","):
                parts = card_entry.split(":")
                if len(parts) == 2:
                    cards.append({"id": parts[0], "count": int(parts[1])})
        return cards

    if "onepiece-cardgame.dev/builder" in deck_url:
        return parse_opcg_dev_deck_url(deck_url)

    return []


def parse_opcg_dev_deck_url(deck_url):
    """Parse onepiece-cardgame.dev deck builder URL format.
    Format: ?d=[leader_count]D[groups separated by *]
    Each group: [default_count][SET_PREFIX][encoded_cards]
    Count modifiers: !=4, (=3, )=2, -=1
    Card numbers are 2 digits.
    """
    from urllib.parse import unquote as _unq
    parsed = urlparse(deck_url)
    params = parse_qs(parsed.query)
    d_str = _unq(params.get("d", [""])[0])
    if not d_str:
        return []

    d_match = re.match(r"^(\d)D(.+)$", d_str)
    if not d_match:
        return []

    rest = d_match.group(2)
    groups = rest.split("*")
    cards = []

    count_map = {"!": 4, "(": 3, ")": 2, "-": 1}

    for group in groups:
        g_match = re.match(r"^(\d)([A-Z]+\d{2})(.*)", group)
        if not g_match:
            continue
        default_count = int(g_match.group(1))
        set_prefix = g_match.group(2)
        card_str = g_match.group(3)

        current_count = default_count
        pos = 0
        while pos < len(card_str):
            c = card_str[pos]
            if c in count_map:
                current_count = count_map[c]
                pos += 1
            elif c.isdigit():
                num = card_str[pos:pos + 2]
                if len(num) == 2 and num.isdigit():
                    card_id = f"{set_prefix}-0{num}"
                    cards.append({"id": card_id, "count": current_count})
                    pos += 2
                    current_count = default_count
                else:
                    pos += 1
            else:
                pos += 1

    return cards


def extract_events_from_meta_page(soup, meta_id):
    """Extract event links from a meta page."""
    events = []
    blog_items = soup.select(".blog-item, .summary-item, article, .collection-item")

    if not blog_items:
        all_links = soup.find_all("a", href=True)
        seen = set()
        for link in all_links:
            href = link.get("href", "")
            text = link.get_text(strip=True)
            if not text or text in ("Read More", "Back to Formats", "Back Home",
                                     "Deck List Table", "Team Deck Lists"):
                continue
            if META_URLS.get(meta_id, "") in href and href != META_URLS.get(meta_id, ""):
                full_url = urljoin(BASE_URL, href)
                if full_url not in seen and "/category/" not in href and "/tag/" not in href:
                    seen.add(full_url)
                    events.append({"name": text, "url": full_url})
        return events

    for item in blog_items:
        link = item.find("a", href=True)
        if link:
            title_el = item.find(["h1", "h2", "h3"])
            title = title_el.get_text(strip=True) if title_el else link.get_text(strip=True)
            url = urljoin(BASE_URL, link["href"])
            if "/category/" not in url and "/tag/" not in url:
                events.append({"name": title, "url": url})
    return events


def extract_decks_from_event_page(soup):
    """Extract deck lists from an event detail page."""
    decks = []
    event_info = {}

    details_header = soup.find(string=re.compile(r"Event Details", re.I))
    if details_header:
        parent = details_header.find_parent()
        if parent:
            text = parent.find_next().get_text() if parent.find_next() else ""
            players_match = re.search(r"(\d+)\s*players", text, re.I)
            if players_match:
                event_info["players"] = int(players_match.group(1))
            rounds_match = re.search(r"(\d+)\s*Rounds?\s+of\s+Swiss", text, re.I)
            if rounds_match:
                event_info["rounds"] = rounds_match.group(0)

    date_el = soup.find("time")
    if date_el:
        event_info["date"] = date_el.get("datetime", date_el.get_text(strip=True))

    top_leaders_text = ""
    for el in soup.find_all(["p", "div", "span"]):
        t = el.get_text(strip=True)
        if re.match(r"^(\d+\s*-\s*\w)", t) and len(t) > 20:
            top_leaders_text = t
            break

    leader_counts = {}
    if top_leaders_text:
        parts = re.findall(r"(\d+)\s*-\s*([A-Z0-9\-]+\s+[^\d]+?)(?=\d+\s*-|$)", top_leaders_text)
        for count, name in parts:
            leader_counts[name.strip()] = int(count)
    event_info["leader_distribution"] = leader_counts

    # Method 1: Table-based deck lists (newer events)
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all(["td", "th"])
            if len(cells) < 3:
                continue

            placing = ""
            leader_name = ""
            leader_id = ""
            player_name = ""
            deck_url = ""

            row_text = row.get_text(strip=True)

            placing_match = re.search(r"(1st|2nd|3rd|4th|5th|6th|7th|8th|"
                                       r"Top\s*\d+|9th|10th|11th|12th|13th|14th|15th|16th)", row_text)
            if placing_match:
                placing = placing_match.group(1)

            for link in row.find_all("a", href=True):
                href = link["href"]
                link_text = link.get_text(strip=True)
                if "deckbuilder" in href or "onepiece-cardgame.dev/builder" in href:
                    deck_url = href
                    if link_text and re.match(r"^[A-Z]{2,}", link_text):
                        leader_name = link_text
                        lid_match = re.match(r"([A-Z0-9\-]+(?:\-\d+))", link_text)
                        if lid_match:
                            leader_id = lid_match.group(1)

            for cell in cells:
                cell_text = cell.get_text(strip=True)
                if not placing and re.match(r"^(1st|2nd|3rd|\d+th|Top\s*\d+)$", cell_text):
                    placing = cell_text
                if not player_name and cell_text and not re.match(r"^(1st|2nd|3rd|\d+th|Top)", cell_text):
                    if cell_text != leader_name and "deckbuilder" not in cell_text and "onepiece-cardgame" not in cell_text:
                        if not cell_text.startswith(("OP", "ST", "EB", "P-", "PRB")):
                            player_name = cell_text

            last_cell = cells[-1].get_text(strip=True) if cells else ""
            if last_cell and last_cell != placing and last_cell != leader_name:
                player_name = last_cell

            if leader_name and placing:
                deck_cards = parse_deck_url(deck_url) if deck_url else []
                decks.append({
                    "placing": placing,
                    "leader": leader_name,
                    "leaderId": leader_id,
                    "player": player_name,
                    "deckUrl": deck_url,
                    "cards": deck_cards,
                })

    # Method 2: Text-based deck lists (older events OP01-OP08)
    if not decks:
        page_text = soup.get_text()
        all_links = soup.find_all("a", href=True)

        placing_map = {
            "champion": "1st", "1st": "1st",
            "runner-up": "2nd", "runner up": "2nd", "2nd": "2nd",
            "3rd": "3rd", "4th": "4th",
        }

        deck_links = [(a, a.get("href", "")) for a in all_links if "deckbuilder" in a.get("href", "") or "onepiece-cardgame.dev/builder" in a.get("href", "")]

        for link_el, href in deck_links:
            link_text = link_el.get_text(strip=True)
            leader_name = ""
            leader_id = ""
            if link_text and re.match(r"^[A-Z]{2,}", link_text):
                leader_name = link_text
                lid_match = re.match(r"([A-Z0-9\-]+(?:\-\d+))", link_text)
                if lid_match:
                    leader_id = lid_match.group(1)

            parent = link_el.parent
            context = ""
            if parent:
                prev = parent.find_previous(string=True)
                context = parent.get_text(strip=True)
                if prev:
                    context = prev.strip() + " " + context

            placing = ""
            player_name = ""

            for key, val in placing_map.items():
                if key in context.lower():
                    placing = val
                    break

            if not placing:
                top_match = re.search(r"Top\s*(\d+)", context, re.I)
                if top_match:
                    placing = f"Top {top_match.group(1)}"

            name_match = re.search(
                r"(?:Champion|Runner[- ]?Up|Top\s*\d+|1st|2nd|3rd|4th)\s+(.+?)\s*-\s*\[",
                context, re.I
            )
            if name_match:
                player_name = name_match.group(1).strip()
            else:
                name_match2 = re.search(r"^(.+?)\s*-\s*\[", context)
                if name_match2:
                    cand = name_match2.group(1).strip()
                    for key in placing_map:
                        cand = re.sub(re.escape(key), "", cand, flags=re.I).strip()
                    cand = re.sub(r"^Top\s*\d+\s*", "", cand, flags=re.I).strip()
                    if cand and len(cand) < 40:
                        player_name = cand

            if leader_name and placing:
                deck_cards = parse_deck_url(href) if href else []
                already = any(d["deckUrl"] == href for d in decks)
                if not already:
                    decks.append({
                        "placing": placing,
                        "leader": leader_name,
                        "leaderId": leader_id,
                        "player": player_name,
                        "deckUrl": href,
                        "cards": deck_cards,
                    })

    return decks, event_info


def extract_decks_from_table_page(soup):
    """Extract deck lists from a deck list table page."""
    decks = []
    tables = soup.find_all("table")

    for table in tables:
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all(["td", "th"])
            if len(cells) < 4:
                continue

            leader_name = ""
            leader_id = ""
            player_name = ""
            placing = ""
            event_type = ""
            event_format = ""
            event_name = ""
            event_date = ""
            deck_url = ""

            for link in row.find_all("a", href=True):
                href = link["href"]
                link_text = link.get_text(strip=True)
                if "deckbuilder" in href or "onepiece-cardgame.dev/builder" in href:
                    deck_url = href
                    if link_text and re.match(r"^[A-Z]{2,}", link_text):
                        leader_name = link_text
                        lid_match = re.match(r"([A-Z0-9\-]+(?:\-\d+))", link_text)
                        if lid_match:
                            leader_id = lid_match.group(1)

            cell_texts = [c.get_text(strip=True) for c in cells]

            for ct in cell_texts:
                if re.match(r"^(1st|2nd|3rd|4th|5th|6th|7th|8th|Top\s*\d+)$", ct):
                    placing = ct
                elif ct in ("Unofficial Event", "Large Official Event", "Official Event"):
                    event_type = ct
                elif re.match(r"^(ENG|JPN)\s+(OP|EB)", ct):
                    event_format = ct
                elif re.match(r"^\d+/\d+/\d+$", ct):
                    event_date = ct

            for ct in cell_texts:
                if ct and ct not in (placing, event_type, event_format, event_date, leader_name, ""):
                    if not ct.startswith(("OP", "ST", "EB", "P-", "PRB")) and "onepiece-cardgame" not in ct:
                        if not event_name:
                            player_name = ct
                        elif not player_name:
                            player_name = ct

            if leader_name and placing:
                deck_cards = parse_deck_url(deck_url) if deck_url else []
                decks.append({
                    "placing": placing,
                    "leader": leader_name,
                    "leaderId": leader_id,
                    "player": player_name,
                    "deckUrl": deck_url,
                    "cards": deck_cards,
                    "eventType": event_type,
                    "eventFormat": event_format,
                    "eventName": event_name,
                    "eventDate": event_date,
                })

    return decks


def scrape_meta(meta_id, meta_path):
    """Scrape all events for a given meta."""
    print(f"\n{'='*60}")
    print(f"Scraping {meta_id.upper()} ({META_NAMES.get(meta_id, meta_id)})")
    print(f"{'='*60}")

    meta_url = BASE_URL + meta_path
    soup = fetch_page(meta_url)
    if not soup:
        print(f"  Failed to fetch meta page: {meta_url}")
        return None

    event_links = []
    all_links = soup.find_all("a", href=True)
    seen_urls = set()

    for link in all_links:
        href = link.get("href", "")
        text = link.get_text(strip=True)

        if not text:
            continue
        skip_texts = {"Read More", "Back to Formats", "Back Home",
                      "Deck List Table", "Team Deck Lists",
                      "Weekly Power Rankings", "Back to OP14 Events",
                      f"{meta_id.upper()} Events", "OP14 Events",
                      "OP13 Events", "OP12 Events", "OP11 Events",
                      "OP10 Events", "OP09 Events", "OP08 Events",
                      "OP07 Events", "OP06 Events", "OP05 Events",
                      "OP04 Events", "OP03 Events", "OP02 Events",
                      "OP01 Events", "OP15 Events", "OP14 Events"}
        if text in skip_texts:
            continue
        if "/category/" in href or "/tag/" in href or "?author=" in href:
            continue

        full_url = urljoin(BASE_URL, href)
        meta_base = meta_path.rstrip("/")
        if meta_base in href and href != meta_path and full_url not in seen_urls:
            if href.count("/") > meta_base.count("/"):
                seen_urls.add(full_url)
                event_links.append({"name": text, "url": full_url})

    if not event_links:
        for link in all_links:
            href = link.get("href", "")
            text = link.get_text(strip=True)
            if not text or text in skip_texts:
                continue
            if "/category/" in href or "/tag/" in href or "?author=" in href:
                continue
            full_url = urljoin(BASE_URL, href)
            if meta_id.replace("op0", "op-op0").replace("op", "one-piece-op") in href:
                if full_url not in seen_urls:
                    seen_urls.add(full_url)
                    event_links.append({"name": text, "url": full_url})

    unique_events = []
    seen_names = set()
    for ev in event_links:
        clean_name = ev["name"].strip()
        if clean_name not in seen_names and len(clean_name) > 3:
            seen_names.add(clean_name)
            unique_events.append(ev)

    print(f"  Found {len(unique_events)} events")

    events = []
    for i, ev_link in enumerate(unique_events):
        print(f"  [{i+1}/{len(unique_events)}] Scraping: {ev_link['name']}")
        ev_soup = fetch_page(ev_link["url"])
        if not ev_soup:
            print(f"    Failed to fetch event page")
            continue

        decks, event_info = extract_decks_from_event_page(ev_soup)

        title_el = ev_soup.find("h1")
        event_name = title_el.get_text(strip=True) if title_el else ev_link["name"]

        cat_links = ev_soup.find_all("a", href=re.compile(r"/category/"))
        event_type = ""
        for cl in cat_links:
            ct = cl.get_text(strip=True)
            if ct in ("Unofficial Event", "Large Official Event", "Official Event", "Total Leader"):
                if ct != "Total Leader":
                    event_type = ct

        # Prefer the full date from <time> (if available) so we can keep the correct year.
        # If not available, egmanevents often shows dates as "3/22/26" - capture that.
        date_text = event_info.get("date", "") or ""
        month_day_text = ""
        for el in ev_soup.find_all(["span", "time", "p", "div"]):
            t = el.get_text(strip=True)

            # Eg: 3/22/26, 03/22/2026
            slash_match = re.search(r"\b\d{1,2}\/\d{1,2}\/\d{2,4}\b", t)
            if slash_match:
                date_text = slash_match.group(0)
                break

            if not month_day_text:
                date_match = re.match(
                    r"^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d+",
                    t,
                )
                if date_match:
                    month_day_text = t
                    continue

                date_match2 = re.match(
                    r"^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+",
                    t,
                )
                if date_match2:
                    month_day_text = t
                    continue

        if not date_text and month_day_text:
            date_text = month_day_text

        event_data = {
            "name": event_name,
            "url": ev_link["url"],
            "type": event_type or "Unofficial Event",
            "date": date_text,
            "players": event_info.get("players", 0),
            "rounds": event_info.get("rounds", ""),
            "leaderDistribution": event_info.get("leader_distribution", {}),
            "decks": decks,
        }
        events.append(event_data)
        print(f"    Found {len(decks)} decks")
        time.sleep(0.5)

    meta_data = {
        "id": meta_id,
        "name": META_NAMES.get(meta_id, meta_id.upper()),
        "url": meta_url,
        "events": events,
    }

    return meta_data


def compute_leader_stats(meta_data):
    """Compute leader statistics from events."""
    leader_stats = {}

    for event in meta_data.get("events", []):
        for deck in event.get("decks", []):
            leader = deck.get("leader", "")
            leader_id = deck.get("leaderId", "")
            if not leader:
                continue

            if leader not in leader_stats:
                leader_stats[leader] = {
                    "leader": leader,
                    "leaderId": leader_id,
                    "totalAppearances": 0,
                    "wins": 0,
                    "second": 0,
                    "third": 0,
                    "fourth": 0,
                    "top4": 0,
                    "top8": 0,
                    "top16": 0,
                    "top32": 0,
                    "events": [],
                    "players": set(),
                    "decks": [],
                }

            stats = leader_stats[leader]
            stats["totalAppearances"] += 1

            placing = deck.get("placing", "")
            if placing == "1st":
                stats["wins"] += 1
                stats["top4"] += 1
            elif placing == "2nd":
                stats["second"] += 1
                stats["top4"] += 1
            elif placing == "3rd":
                stats["third"] += 1
                stats["top4"] += 1
            elif placing in ("4th", "Top 4"):
                stats["fourth"] += 1
                stats["top4"] += 1
            elif placing in ("5th", "6th", "7th", "8th") or placing == "Top 8":
                stats["top8"] += 1
            elif "Top 16" in placing or placing in ("9th", "10th", "11th", "12th",
                                                      "13th", "14th", "15th", "16th"):
                stats["top16"] += 1
            elif "Top 32" in placing:
                stats["top32"] += 1

            player = deck.get("player", "")
            if player:
                stats["players"].add(player)
            stats["events"].append(event.get("name", ""))
            if deck.get("cards"):
                stats["decks"].append({
                    "cards": deck["cards"],
                    "player": player,
                    "event": event.get("name", ""),
                    "placing": placing,
                })

    result = []
    for leader, stats in leader_stats.items():
        stats["uniquePlayers"] = len(stats["players"])
        stats["uniqueEvents"] = len(set(stats["events"]))
        stats["players"] = list(stats["players"])
        stats["events"] = list(set(stats["events"]))

        if stats["decks"]:
            card_frequency = {}
            for deck_entry in stats["decks"]:
                for card in deck_entry.get("cards", []):
                    cid = card["id"]
                    if cid not in card_frequency:
                        card_frequency[cid] = {"id": cid, "appearances": 0, "totalCount": 0}
                    card_frequency[cid]["appearances"] += 1
                    card_frequency[cid]["totalCount"] += card["count"]

            total_decks = len(stats["decks"])
            core_cards = []
            flex_cards = []
            for cid, cdata in card_frequency.items():
                rate = cdata["appearances"] / total_decks
                avg_count = cdata["totalCount"] / cdata["appearances"]
                card_info = {
                    "id": cid,
                    "inclusionRate": round(rate * 100, 1),
                    "avgCount": round(avg_count, 1),
                }
                if rate >= 0.7:
                    core_cards.append(card_info)
                else:
                    flex_cards.append(card_info)

            core_cards.sort(key=lambda x: -x["inclusionRate"])
            flex_cards.sort(key=lambda x: -x["inclusionRate"])
            stats["coreCards"] = core_cards
            stats["flexCards"] = flex_cards

        del stats["decks"]
        result.append(stats)

    score_weights = {"first": 10, "second": 8, "third": 7, "fourth": 6, "top8": 4, "top16": 2, "top32": 1}
    for stats in result:
        points = (
            stats.get("wins", 0) * score_weights["first"]
            + stats.get("second", 0) * score_weights["second"]
            + stats.get("third", 0) * score_weights["third"]
            + stats.get("fourth", 0) * score_weights["fourth"]
            + stats.get("top8", 0) * score_weights["top8"]
            + stats.get("top16", 0) * score_weights["top16"]
            + stats.get("top32", 0) * score_weights["top32"]
        )
        stats["points"] = points
    result.sort(key=lambda x: (-x.get("points", 0), -x["wins"], -x["totalAppearances"]))
    return result


def main():
    os.makedirs(os.path.join(DATA_DIR, "metas"), exist_ok=True)

    metas_to_scrape = sys.argv[1:] if len(sys.argv) > 1 else list(META_URLS.keys())

    all_metas_summary = []

    for meta_id in metas_to_scrape:
        if meta_id not in META_URLS:
            print(f"Unknown meta: {meta_id}")
            continue

        meta_data = scrape_meta(meta_id, META_URLS[meta_id])
        if not meta_data:
            continue

        leader_stats = compute_leader_stats(meta_data)
        meta_data["leaderStats"] = leader_stats

        output_path = os.path.join(DATA_DIR, "metas", f"{meta_id}.json")
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(meta_data, f, ensure_ascii=False, indent=2)
        print(f"\n  Saved {meta_id} data to {output_path}")

        all_metas_summary.append({
            "id": meta_id,
            "name": meta_data["name"],
            "url": meta_data["url"],
            "eventCount": len(meta_data["events"]),
            "totalDecks": sum(len(e.get("decks", [])) for e in meta_data["events"]),
            "topLeaders": [s["leader"] for s in leader_stats[:5]],
        })

    summary_path = os.path.join(DATA_DIR, "summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump({"metas": all_metas_summary}, f, ensure_ascii=False, indent=2)
    print(f"\nSaved summary to {summary_path}")
    print("Done!")


if __name__ == "__main__":
    main()
