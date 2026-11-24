#!/usr/bin/env python3
"""Gera move-pool-data.js (dados compactos dos golpes oficiais) para o
Gerador de Move Pool por perfil da Pokédex GM.

Fonte: CSVs do repositório oficial da PokéAPI (PokeAPI/pokeapi, data/v2/csv).
Uso:  python3 scripts/build-move-pool.py <pasta-com-os-csv>
Arquivos necessários: moves, move_names, move_meta, move_meta_stat_changes,
move_flag_map, pokemon_moves, type_efficacy.
"""
import csv, json, sys, os
from collections import defaultdict

SRC = sys.argv[1] if len(sys.argv) > 1 else "."
OUT = os.path.join(os.path.dirname(__file__), "..", "move-pool-data.js")
TYPES = {1:"Normal",2:"Fighting",3:"Flying",4:"Poison",5:"Ground",6:"Rock",7:"Bug",8:"Ghost",9:"Steel",
         10:"Fire",11:"Water",12:"Grass",13:"Electric",14:"Psychic",15:"Ice",16:"Dragon",17:"Dark",18:"Fairy"}
CATS = {1:"Status",2:"Physical",3:"Special"}

def rows(name):
    with open(os.path.join(SRC, name + ".csv"), newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))

names = {}
for r in rows("move_names"):
    if r["local_language_id"] == "9":
        names[int(r["move_id"])] = r["name"]
meta = {int(r["move_id"]): r for r in rows("move_meta")}
stat_changes = defaultdict(list)
for r in rows("move_meta_stat_changes"):
    stat_changes[int(r["move_id"])].append((int(r["stat_id"]), int(r["change"])))
flags = defaultdict(set)
FLAG = {"1":"contact","2":"charge","3":"recharge","8":"punch","9":"sound","13":"heal","16":"bite","17":"pulse","21":"dance"}
for r in rows("move_flag_map"):
    if r["move_flag_id"] in FLAG:
        flags[int(r["move_id"])].add(FLAG[r["move_flag_id"]])

learners = defaultdict(set); machine = defaultdict(set); level = defaultdict(set)
for r in rows("pokemon_moves"):
    pid = int(r["pokemon_id"])
    if pid > 10000:  # formas alternativas contam pouco
        continue
    m = int(r["move_id"]); learners[m].add(pid)
    if r["pokemon_move_method_id"] == "4": machine[m].add(pid)
    if r["pokemon_move_method_id"] == "1": level[m].add(pid)

SPECIAL = {
  "protect":{"protect","detect","kings-shield","spiky-shield","baneful-bunker","obstruct","silk-trap","burning-bulwark","endure"},
  "hazard":{"stealth-rock","spikes","toxic-spikes","sticky-web"},
  "pivot":{"u-turn","volt-switch","flip-turn","parting-shot","teleport","baton-pass","chilly-reception","shed-tail"},
  "screen":{"reflect","light-screen","aurora-veil","safeguard","mist","lucky-chant"},
  "field":{"sunny-day","rain-dance","sandstorm","hail","snowscape","electric-terrain","grassy-terrain","misty-terrain","psychic-terrain","trick-room","tailwind","gravity","magic-room","wonder-room"},
  "trap":{"mean-look","block","spider-web","whirlpool","fire-spin","sand-tomb","wrap","bind","clamp","infestation","magma-storm","snap-trap","thunder-cage","jaw-lock","anchor-shot","spirit-shackle"},
  "util":{"substitute","rest","sleep-talk","taunt","encore","disable","knock-off","trick","switcheroo","haze","clear-smog","roar","whirlwind","dragon-tail","circle-throw","rapid-spin","defog","wish","heal-bell","aromatherapy","pain-split","leech-seed","yawn","destiny-bond","perish-song","confuse-ray","attract","foresight","odor-sleuth","helping-hand","follow-me","rage-powder","toxic","will-o-wisp","thunder-wave","glare","stun-spore","sleep-powder","spore","hypnosis","sing","lovely-kiss"},
}
# golpes que não fazem sentido num move pool genérico
BAN = {"struggle","sketch","transform","mimic","metronome","copycat","assist","me-first","mirror-move","nature-power","hidden-power",
       "beat-up","natural-gift","fling","last-resort","snore","celebrate","hold-hands","happy-hour","splash","teatime","explosion","self-destruct",
       "misty-explosion","memento","healing-wish","lunar-dance","final-gambit","spit-up","swallow","bide","counter","mirror-coat","metal-burst",
       "comeuppance","frustration","return","secret-power","weather-ball","judgment","multi-attack","techno-blast","revelation-dance","tera-blast",
       "hyper-beam","giga-impact","blast-burn","frenzy-plant","hydro-cannon","rock-wrecker","roar-of-time","eternabeam","prismatic-laser","meteor-assault",
       "chatter","after-you","quash","ally-switch","instruct","entrainment","role-play","skill-swap","power-split","guard-split","speed-swap",
       "power-swap","guard-swap","heart-swap","psych-up","spotlight","coaching","decorate","aromatic-mist","flower-shield","rototiller","magnetic-flux",
       "gear-up","floral-healing","heal-pulse","pollen-puff","life-dew","jungle-healing","lunar-blessing","conversion","conversion-2","reflect-type",
       "camouflage","soak","magic-powder","trick-or-treat","forests-curse","power-trick","telekinesis","magnet-rise","ingrain","aqua-ring","imprison",
       "grudge","spite","torment","embargo","heal-block","nightmare","curse","dream-eater","lock-on","mind-reader","laser-focus","focus-energy",
       "present","magnitude","fissure","sheer-cold","guillotine","horn-drill","double-team","minimize","kinesis","flash","sand-attack","smokescreen",
       "sweet-scent","teeter-dance","flatter","swagger","captivate","tickle","fake-tears","play-nice","noble-roar","tearful-look","confide",
       "venom-drench","purify","stuff-cheeks","no-retreat","octolock","tar-shot","corrosive-gas","court-change","double-shock","burn-up","steel-roller",
       "ice-spinner","rising-voltage","expanding-force","terrain-pulse","grassy-glide","lash-out","poltergeist","shell-trap","beak-blast","focus-punch",
       "sky-drop","fly","dig","dive","bounce","shadow-force","phantom-force","solar-blade","solar-beam","skull-bash","sky-attack","razor-wind",
       "freeze-shock","ice-burn","geomancy","meteor-beam","electro-shot","dragon-rage","sonic-boom","night-shade","seismic-toss","psywave",
       "super-fang","natures-madness","ruination","endeavor","rage","pay-day","covet","thief","bug-bite","pluck","incinerate","belch","stockpile",
       "rollout","ice-ball","uproar","outrage","thrash","petal-dance","fury-cutter","echoed-voice","round","pursuit","assurance","payback","revenge",
       "avalanche","stored-power","power-trip","punishment","acrobatics","retaliate","fusion-flare","fusion-bolt","venoshock","hex","brine",
       "facade","smelling-salts","wake-up-slap","wring-out","crush-grip","water-spout","eruption","dragon-energy","reversal","flail","gyro-ball",
       "electro-ball","heavy-slam","heat-crash","grass-knot","low-kick","trump-card","punishment","spit-up","false-swipe","hold-back","psyshock",
       "secret-sword","synchronoise","foul-play","body-press","shell-side-arm","photon-geyser","sunsteel-strike","moongeist-beam","light-that-burns-the-sky"}

out = []
for r in rows("moves"):
    mid = int(r["id"])
    if mid > 10000 or not r["type_id"] or int(r["type_id"]) not in TYPES:
        continue
    ident = r["identifier"]
    if ident in BAN or "max-" in ident or ident.startswith("g-max") or ident.endswith("--physical") or ident.endswith("--special"):
        continue
    n_learn = len(learners[mid])
    if n_learn < 3:  # golpes de assinatura / exclusivos
        continue
    m = meta.get(mid, {})
    cat = CATS[int(r["damage_class_id"])]
    power = int(r["power"]) if r["power"] else 0
    acc = int(r["accuracy"]) if r["accuracy"] else None
    pri = int(r["priority"] or 0)
    target = int(r["target_id"] or 0)
    mc = int(m.get("meta_category_id") or 0)
    tags = set()
    if cat != "Status":
        tags.add("atk")
        if pri > 0: tags.add("priority")
        if int(m.get("drain") or 0) > 0: tags.add("drain")
        if int(m.get("drain") or 0) < 0: tags.add("recoil")
        if (m.get("max_hits") or "") not in ("", "1"): tags.add("multi")
        if mc in (4,): tags.add("ailment")
        if mc == 7: tags.add("selfboost")
        if mc == 6: tags.add("lower")
        if int(m.get("crit_rate") or 0) > 0: tags.add("crit")
    else:
        sc = stat_changes.get(mid, [])
        if mc == 2 and target in (7, 4, 13, 15) and any(c > 0 for _, c in sc):
            tags.add("setup")
            stats = {s for s, c in sc if c > 0}
            if stats & {2}: tags.add("setup-atk")
            if stats & {4}: tags.add("setup-spa")
            if stats & {6}: tags.add("setup-spe")
            if stats & {3, 5}: tags.add("setup-def")
        elif mc == 2 and any(c < 0 for _, c in sc):
            tags.add("debuff")
        if mc == 1: tags.add("status")
        if mc == 3: tags.add("heal")
    for key, group in SPECIAL.items():
        if ident in group: tags.add(key)
    if flags[mid] & {"charge", "recharge"}: tags.add("slow")
    if "contact" in flags[mid]: tags.add("contact")
    if cat == "Status" and not tags - {"slow", "contact"}:
        continue  # status sem papel claro
    out.append([names.get(mid, ident.replace("-", " ").title()), TYPES[int(r["type_id"])], cat, power, acc, pri,
                int(r["generation_id"]), n_learn, len(machine[mid]), len(level[mid]), sorted(tags)])

eff = defaultdict(dict)
for r in rows("type_efficacy"):
    eff[TYPES[int(r["damage_type_id"])]][TYPES[int(r["target_type_id"])]] = int(r["damage_factor"])

payload = {"fields": ["name","type","cat","power","acc","pri","gen","learners","tm","levelup","tags"],
           "moves": sorted(out, key=lambda x: x[0]), "chart": eff,
           "source": "PokéAPI (github.com/PokeAPI/pokeapi, data/v2/csv)"}
with open(OUT, "w", encoding="utf-8") as fh:
    fh.write("/* Gerado por scripts/build-move-pool.py — não edite à mão. */\n")
    fh.write("window.POKEDEX_MOVE_POOL_DATA=")
    json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    fh.write(";\n")
print(len(out), "moves ->", os.path.relpath(OUT))
