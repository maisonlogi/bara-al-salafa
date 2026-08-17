import csv
import json
import os
import re


def wiki_from_name(name: str) -> str:
    return re.sub(r"[^\w\s\-]", "", name, flags=re.UNICODE).strip().replace(" ", "_")


def read_tm(path: str):
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            with open(path, encoding=enc, errors="strict") as f:
                return list(csv.DictReader(f)), enc
        except Exception:
            continue
    with open(path, encoding="cp1252", errors="replace") as f:
        return list(csv.DictReader(f)), "cp1252-replace"


# Pre-market-value icons — always keep a small set of timeless legends
MUST_INCLUDE = [
    ("Pelé", "Pelé", "retired"),
    ("Diego Maradona", "Diego_Maradona", "retired"),
    ("Johan Cruyff", "Johan_Cruyff", "retired"),
    ("Franz Beckenbauer", "Franz_Beckenbauer", "retired"),
    ("Michel Platini", "Michel_Platini", "retired"),
    ("Marco van Basten", "Marco_van_Basten", "retired"),
    ("Ronaldo Nazário", "Ronaldo_(Brazilian_footballer)", "retired"),
    ("Ronaldinho", "Ronaldinho", "retired"),
    ("Zinedine Zidane", "Zinedine_Zidane", "retired"),
    ("David Beckham", "David_Beckham", "retired"),
    ("Paolo Maldini", "Paolo_Maldini", "retired"),
    ("Francesco Totti", "Francesco_Totti", "retired"),
    ("Alessandro Del Piero", "Alessandro_Del_Piero", "retired"),
    ("Thierry Henry", "Thierry_Henry", "retired"),
    ("Andrés Iniesta", "Andrés_Iniesta", "retired"),
    ("Xavi Hernández", "Xavi", "retired"),
    ("Iker Casillas", "Iker_Casillas", "retired"),
    ("Gianluigi Buffon", "Gianluigi_Buffon", "retired"),
    ("Kaká", "Kaká", "retired"),
    ("Luis Figo", "Luís_Figo", "retired"),
]

tm_rows, enc = read_tm("players.csv")
print("encoding", enc, "rows", len(tm_rows))

by_name = {}
for row in tm_rows:
    name = (row.get("name") or "").strip()
    if not name:
        continue
    try:
        hv = int(float(row.get("highest_market_value_in_eur") or 0))
    except Exception:
        hv = 0
    try:
        mv = int(float(row.get("market_value_in_eur") or 0))
    except Exception:
        mv = 0
    try:
        last = int(row.get("last_season") or 0)
    except Exception:
        last = 0
    img = (row.get("image_url") or "").strip()
    if "default" in img.lower() or "placeholder" in img.lower():
        img = ""

    is_active = last >= 2023 or mv > 0
    # Rank by the best known market value (peak OR current),
    # with a light boost so today's expensive stars stay near the top.
    best_value = max(hv, mv)
    score = best_value + (mv // 2)  # current value gets extra weight
    if is_active:
        score += 5_000_000

    era = "active" if is_active else "retired"
    item = {
        "name": name,
        "wiki": wiki_from_name(name),
        "era": era,
        "image": img,
        "score": score,
        "best": best_value,
        "mv": mv,
    }
    key = name.casefold()
    prev = by_name.get(key)
    if not prev or item["score"] > prev["score"]:
        by_name[key] = item

unique = list(by_name.values())

# Ensure timeless legends are present
have = {p["name"].casefold() for p in unique}
for name, wiki, era in MUST_INCLUDE:
    if name.casefold() not in have:
        unique.append(
            {
                "name": name,
                "wiki": wiki,
                "era": era,
                "image": "",
                "score": 35_000_000,
                "best": 35_000_000,
                "mv": 0,
            }
        )
    else:
        for p in unique:
            if p["name"].casefold() == name.casefold():
                p["wiki"] = wiki
                # keep them competitive even if TM peak is missing/low
                p["score"] = max(p["score"], 35_000_000)
                break

unique.sort(key=lambda x: (x["score"], x["best"], x["mv"]), reverse=True)

TOP_N = 800
# Keep most slots for highest market value, reserve room for timeless legends
legend_items = []
for name, wiki, era in MUST_INCLUDE:
    found = next((p for p in unique if p["name"].casefold() == name.casefold()), None)
    if found:
        found["wiki"] = wiki
        legend_items.append(found)
    else:
        legend_items.append(
            {
                "name": name,
                "wiki": wiki,
                "era": era,
                "image": "",
                "score": 0,
                "best": 0,
                "mv": 0,
            }
        )

legend_keys = {p["name"].casefold() for p in legend_items}
market_slots = TOP_N - len(legend_items)
top_market = [p for p in unique if p["name"].casefold() not in legend_keys][:market_slots]

# legends first in data for familiarity, then market leaders
# but overall order for the game is shuffled anyway — still sort final list by score
combined = legend_items + top_market
# de-dupe safety
seen = set()
final = []
for p in combined:
    k = p["name"].casefold()
    if k in seen:
        continue
    seen.add(k)
    final.append(p)

# fill if short
for p in unique:
    if len(final) >= TOP_N:
        break
    k = p["name"].casefold()
    if k in seen:
        continue
    seen.add(k)
    final.append(p)

final.sort(key=lambda x: (x["score"], x["best"], x["mv"]), reverse=True)
final = final[:TOP_N]

out = []
for p in final:
    item = {"name": p["name"], "wiki": p["wiki"], "era": p["era"]}
    if p.get("image"):
        item["image"] = p["image"]
    out.append(item)

assert len(out) == 800

with open("whoami-data.js", "w", encoding="utf-8") as f:
    f.write("/** Top 800 footballers by market value (current prioritized) for Who Am I */\n")
    f.write(f"/** Total: {len(out)} players */\n")
    f.write("window.WHOAMI_PLAYERS = ")
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

print("written", len(out), "bytes", os.path.getsize("whoami-data.js"))
print("active", sum(1 for p in out if p["era"] == "active"))
print("retired", sum(1 for p in out if p["era"] == "retired"))
print("images", sum(1 for p in out if p.get("image")))

with open("_top30.txt", "w", encoding="utf-8") as f:
    for i, p in enumerate(out[:30], 1):
        f.write(f"{i}. {p['name']} ({p['era']})\n")
    f.write("\n-- checks --\n")
    for n in ["Lionel Messi", "Cristiano Ronaldo", "Zinedine Zidane", "Diego Maradona", "Pelé", "Kylian Mbappé", "Erling Haaland"]:
        f.write(f"{n}: {any(p['name'] == n for p in out)}\n")
