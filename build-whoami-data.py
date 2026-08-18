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


# 50 timeless / retired legends always kept
MUST_INCLUDE = [
    ("Pelé", "Pelé", "retired"),
    ("Diego Maradona", "Diego_Maradona", "retired"),
    ("Johan Cruyff", "Johan_Cruyff", "retired"),
    ("Franz Beckenbauer", "Franz_Beckenbauer", "retired"),
    ("Michel Platini", "Michel_Platini", "retired"),
    ("Marco van Basten", "Marco_van_Basten", "retired"),
    ("Ruud Gullit", "Ruud_Gullit", "retired"),
    ("Garrincha", "Garrincha", "retired"),
    ("Eusébio", "Eusébio", "retired"),
    ("Alfredo Di Stéfano", "Alfredo_Di_Stéfano", "retired"),
    ("Ferenc Puskás", "Ferenc_Puskás", "retired"),
    ("George Best", "George_Best", "retired"),
    ("Bobby Charlton", "Bobby_Charlton", "retired"),
    ("Gerd Müller", "Gerd_Müller", "retired"),
    ("Ronaldo Nazário", "Ronaldo_(Brazilian_footballer)", "retired"),
    ("Ronaldinho", "Ronaldinho", "retired"),
    ("Zinedine Zidane", "Zinedine_Zidane", "retired"),
    ("David Beckham", "David_Beckham", "retired"),
    ("Paolo Maldini", "Paolo_Maldini", "retired"),
    ("Franco Baresi", "Franco_Baresi", "retired"),
    ("Alessandro Nesta", "Alessandro_Nesta", "retired"),
    ("Fabio Cannavaro", "Fabio_Cannavaro", "retired"),
    ("Francesco Totti", "Francesco_Totti", "retired"),
    ("Alessandro Del Piero", "Alessandro_Del_Piero", "retired"),
    ("Roberto Baggio", "Roberto_Baggio", "retired"),
    ("Andrea Pirlo", "Andrea_Pirlo", "retired"),
    ("Thierry Henry", "Thierry_Henry", "retired"),
    ("Andrés Iniesta", "Andrés_Iniesta", "retired"),
    ("Xavi Hernández", "Xavi", "retired"),
    ("Iker Casillas", "Iker_Casillas", "retired"),
    ("Gianluigi Buffon", "Gianluigi_Buffon", "retired"),
    ("Kaká", "Kaká", "retired"),
    ("Luís Figo", "Luís_Figo", "retired"),
    ("Rivaldo", "Rivaldo", "retired"),
    ("Romário", "Romário", "retired"),
    ("Cafu", "Cafu", "retired"),
    ("Roberto Carlos", "Roberto_Carlos", "retired"),
    ("Raúl González", "Raúl_(footballer)", "retired"),
    ("Ruud van Nistelrooy", "Ruud_van_Nistelrooy", "retired"),
    ("Steven Gerrard", "Steven_Gerrard", "retired"),
    ("Frank Lampard", "Frank_Lampard", "retired"),
    ("Paul Scholes", "Paul_Scholes", "retired"),
    ("Wayne Rooney", "Wayne_Rooney", "retired"),
    ("Didier Drogba", "Didier_Drogba", "retired"),
    ("Samuel Eto'o", "Samuel_Eto'o", "retired"),
    ("Andriy Shevchenko", "Andriy_Shevchenko", "retired"),
    ("Pavel Nedvěd", "Pavel_Nedvěd", "retired"),
    ("Eric Cantona", "Eric_Cantona", "retired"),
    ("Dennis Bergkamp", "Dennis_Bergkamp", "retired"),
    ("Zlatan Ibrahimović", "Zlatan_Ibrahimović", "retired"),
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
    best_value = max(hv, mv)
    # Rank by peak market value so retired stars with a high peak stay in
    score = best_value
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
unique.sort(key=lambda x: (x["best"], x["mv"]), reverse=True)

TOP_N = 700
legend_items = []
for name, wiki, era in MUST_INCLUDE:
    found = next((p for p in unique if p["name"].casefold() == name.casefold()), None)
    if found:
        found["wiki"] = wiki
        found["era"] = "retired" if era == "retired" and found["era"] != "active" else found["era"]
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

seen = set()
final = []
for p in legend_items + top_market:
    k = p["name"].casefold()
    if k in seen:
        continue
    seen.add(k)
    final.append(p)

for p in unique:
    if len(final) >= TOP_N:
        break
    k = p["name"].casefold()
    if k in seen:
        continue
    seen.add(k)
    final.append(p)

final.sort(key=lambda x: (x["best"], x["mv"]), reverse=True)
final = final[:TOP_N]

out = []
for p in final:
    item = {"name": p["name"], "wiki": p["wiki"], "era": p["era"]}
    if p.get("image"):
        item["image"] = p["image"]
    out.append(item)

assert len(out) == 700, len(out)

with open("whoami-data.js", "w", encoding="utf-8") as f:
    f.write("/** Top 700 footballers by peak market value, plus retired legends */\n")
    f.write(f"/** Total: {len(out)} players */\n")
    f.write("window.WHOAMI_PLAYERS = ")
    json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")

print("written", len(out), "bytes", os.path.getsize("whoami-data.js"))
print("active", sum(1 for p in out if p["era"] == "active"))
print("retired", sum(1 for p in out if p["era"] == "retired"))
print("images", sum(1 for p in out if p.get("image")))
print("legends", len(MUST_INCLUDE))
