# -*- coding: utf-8 -*-
"""数据校验：本项目所有「不变量」的唯一权威检查入口。

退出码 0 表示全部通过；任何一条失败都会打印 [!] 并以 1 退出。
"""
import json, os, sys, collections, math

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")
fail = []
notes = []

def load(n):
    with open(os.path.join(DATA, n), encoding="utf-8") as f:
        return json.load(f)

techs = load("techs.json")["techs"]
eras = load("eras.json")["eras"]
cats = load("categories.json")["categories"]

# 1. id 唯一
ids = collections.Counter(t["id"] for t in techs)
if [k for k, v in ids.items() if v > 1]:
    fail.append("id 不唯一: %s" % [k for k, v in ids.items() if v > 1][:8])

# 2. era / category 外键必须存在
ec = {e["id"] for e in eras}; cc = {c["id"] for c in cats}
for t in techs:
    if t["era"] not in ec: fail.append("未知 era: %s -> %s" % (t["id"], t["era"]))
    if t["category"] not in cc: fail.append("未知 category: %s -> %s" % (t["id"], t["category"]))

# 3. 年份必须落在其 era 区间内（era 由年份推出，自洽性检查）
span = {e["id"]: (e["start"], e["end"]) for e in eras}
for t in techs:
    a, b = span[t["era"]]
    if not (a <= t["year"] <= b):
        fail.append("年份越界: %s (%s) 不在 %s [%s,%s]" % (t["id"], t["year"], t["era"], a, b))

# 4. importance 1..5
for t in techs:
    if t["importance"] not in (1, 2, 3, 4, 5):
        fail.append("importance 越界: %s -> %s" % (t["id"], t["importance"]))

# 5. prereq / related 引用必须已定义、不能自指
known = {t["id"] for t in techs}
for t in techs:
    for p in t["prereqs"]:
        if p not in known: fail.append("prereq 悬空: %s -> %s" % (t["id"], p))
        if p == t["id"]: fail.append("prereq 自指: %s" % t["id"])
    for r in t["related"]:
        if r not in known: fail.append("related 悬空: %s -> %s" % (t["id"], r))

# 6. 依赖不能倒流（prereq 的年份必须 <= 本条目）
#    例外：本树按「概念层级」而非「历史先后」建立前置关系时，少数边会与年份顺序相反。
#    已知例外必须逐条列出并说明理由；被豁免的边仍会打印出来，不静默通过。
CHRONO_EXEMPT = {
    ("measurable_cardinal", "weakly_compact_cardinal"):
        "可测蕴含弱紧（层级上前置），但「弱紧基数」之名 1961 年才由 Erdős–Tarski 提出，晚于 1930 年的可测性",
}
year = {t["id"]: t["year"] for t in techs}
for t in techs:
    for p in t["prereqs"]:
        if p in year and year[p] > t["year"]:
            if (t["id"], p) in CHRONO_EXEMPT:
                notes.append("年份倒挂已豁免: %s(%s) ← %s(%s) —— %s"
                             % (t["id"], t["year"], p, year[p], CHRONO_EXEMPT[(t["id"], p)]))
                continue
            fail.append("依赖倒流: %s(%s) 依赖更晚的 %s(%s)" % (t["id"], t["year"], p, year[p]))

# 7. 每个 era / category 都必须非空（防止像 ultrafilters 那样出现 0 条扇区）
for e in eras:
    if not any(t["era"] == e["id"] for t in techs):
        fail.append("空 era: %s" % e["id"])
for c in cats:
    if not any(t["category"] == c["id"] for t in techs):
        fail.append("空 category: %s" % c["id"])

# 8. 每个 era 至少要有一个 importance<=2 的地标（否则该层无法定位）
for e in eras:
    if not any(t["era"] == e["id"] and t["importance"] <= 2 for t in techs):
        fail.append("era 缺少地标(重要度<=2): %s" % e["id"])

# 9. 禁止「年份占位」条目（防回归）
#    历史上曾有 248 条形如「伍丁 1994 年工作」的空条目，只有年份没有知识。
#    允许的真名条目（如「哥德尔 1934 年讲演（一般递归函数）」）在 ALLOW 里放行。
import re
ALLOW = {"godel_1934_lectures_def"}
PH = re.compile(r"\d{4} 年(工作|论文|讲演|报告)$|\d{4} 年的工作")
for t2 in techs:
    if t2["id"] in ALLOW:
        continue
    if PH.search(t2["name"]):
        fail.append("年份占位条目: %s -> %s" % (t2["id"], t2["name"]))

# 10. desc / 依赖边的 id 必须存在于目录（引用完整性）
def _load_ids(sub):
    base = os.path.join(os.path.dirname(HERE), "..", "work", sub)
    base = os.path.abspath(base)
    out = []
    if not os.path.isdir(base): return out
    for fn in sorted(os.listdir(base)):
        if not fn.endswith(".tsv"): continue
        for ln in open(os.path.join(base, fn), encoding="utf-8"):
            ln = ln.rstrip("\n")
            if not ln.strip() or ln.startswith("#"): continue
            f = ln.split("|")
            if f[0].strip(): out.append((f[0].strip(), fn))
    return out

for eid, fn in _load_ids("desc"):
    if eid not in known: fail.append("desc 的 id 不存在于目录: %s (%s)" % (eid, fn))
for eid, fn in _load_ids("links"):
    if eid not in known: fail.append("links 的 id 不存在于目录: %s (%s)" % (eid, fn))

# 12. 地标链完整性：README 公开引用的「大基数主干链」必须逐跳存在。
#     链条写成 A -> B 表示「A 是 B 的前置」，即 A 应出现在 B.prereqs 里。
#     这是站面上最直观的一条纵深线；若将来改数据时误删一环，链条会静默断掉，
#     而上面的逐条检查（id 唯一 / 外键 / 年份 / 无悬空引用）都发现不了。
LANDMARK_CHAIN = [
    "strongly_inaccessible",      # 强不可达基数
    "weakly_compact_cardinal",    # 弱紧基数
    "measurable_cardinal",        # 可测基数
    "strongly_compact_cardinal",  # 强紧基数
    "supercompact_cardinal",      # 超紧基数
    "extendible_cardinal",        # 可扩基数
    "rank_into_rank",             # 秩入秩基数
    "i3_axiom",                   # I3
    "i2_axiom",                   # I2
    "i1_axiom",                   # I1
    "i0_axiom",                   # I0
    "kunen_inconsistency",        # 库宁不一致性定理
]
_idx = {t["id"]: t for t in techs}
for _a, _b in zip(LANDMARK_CHAIN, LANDMARK_CHAIN[1:]):
    if _a not in _idx:
        fail.append("地标链缺条目: %s" % _a)
    elif _b not in _idx:
        fail.append("地标链缺条目: %s" % _b)
    elif _a not in _idx[_b]["prereqs"]:
        fail.append("地标链断环: %s 不是 %s 的前置" % (_a, _b))

# 11. desc 覆盖率（只报告，不判失败）
withdesc = sum(1 for t in techs if t.get("desc"))
print("条目 %d | 时代 %d | 领域 %d" % (len(techs), len(eras), len(cats)))
print("desc 已写 %d / %d (%.1f%%)" % (withdesc, len(techs), 100 * withdesc / len(techs)))
print("依赖边 prereqs %d | related %d" % (
    sum(len(t["prereqs"]) for t in techs), sum(len(t["related"]) for t in techs)))

if fail:
    print("\n[!] %d 项校验失败：" % len(fail))
    for f in fail[:40]: print("   -", f)
    sys.exit(1)
for n in notes:
    print("\n[i] " + n)
print("\n[OK] 全部校验通过")