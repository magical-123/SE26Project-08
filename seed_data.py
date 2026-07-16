"""Seed mock data into the database via backend APIs."""
import requests
import re

BASE = "http://localhost:8080"

# ── 1. Login ──
print(">>> Logging in...")
r = requests.post(f"{BASE}/api/auth/login", json={"username": "test_user", "password": "1"})
r.raise_for_status()
token = r.json()["token"]
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
print("Login OK\n")

# ── 2. Insert concepts ──
concepts = [
    {"name": "frontend-arch",   "label": "前端架构演进",  "color": "#0EA5E9"},
    {"name": "ai-trend",        "label": "AI 行业动态",   "color": "#8B5CF6"},
    {"name": "design-system",   "label": "设计系统",      "color": "#F43F5E"},
    {"name": "animation",       "label": "动效与交互",    "color": "#F59E0B"},
    {"name": "science-pop",     "label": "科学科普",      "color": "#10B981"},
    {"name": "productivity",    "label": "效率与认知",    "color": "#3B82F6"},
]

concept_id_map = {}
print(">>> Creating concepts...")
for c in concepts:
    r = requests.post(f"{BASE}/api/graph/concepts", json=c, headers=headers)
    r.raise_for_status()
    created = r.json()
    concept_id_map[created["name"]] = created["id"]
    print(f"  {created['label']} -> id={created['id']}")
print()

# ── 3. Insert information items ──
inbox_items = [
    {"id": 1,  "title": "【深度】AI 时代的前端架构演进",                     "platform": "Bilibili", "author": "技术圆桌", "duration": 45, "category": "深度知识", "color": "#10B981", "isFavorite": True,  "isLiked": False, "hasNote": True,  "note": "前端架构正在向微前端、Server Components 演进，需要关注 Rust 工具链的崛起。", "tags": '["兴趣","实用"]'},
    {"id": 2,  "title": "如何用 React 实现丝滑的弹簧动画",                    "platform": "Zhihu",    "author": "前端小智", "duration": 15, "category": "实用技巧", "color": "#0EA5E9", "isFavorite": False, "isLiked": True,  "hasNote": False, "note": None, "tags": None},
    {"id": 3,  "title": "硅谷创业播客：寻找下一个千亿市场",                    "platform": "Podcast",  "author": "Tech Talk", "duration": 60, "category": "行业资讯", "color": "#F59E0B", "isFavorite": True,  "isLiked": True,  "hasNote": True,  "note": "AI 原生应用正在重塑 SaaS 格局，关注垂直领域的中小型模型玩家。", "tags": '["震撼","共鸣"]'},
    {"id": 4,  "title": "三分钟看懂量子力学",                                "platform": "Bilibili", "author": "科普君",   "duration": 3,  "category": "娱乐科普", "color": "#F43F5E", "isFavorite": False, "isLiked": False, "hasNote": False, "note": None, "tags": None},
    {"id": 5,  "title": "Framer Motion 高级实战指南",                         "platform": "Zhihu",    "author": "UI 开发",  "duration": 20, "category": "深度知识", "color": "#10B981", "isFavorite": True,  "isLiked": True,  "hasNote": True,  "note": None, "tags": None},
    {"id": 6,  "title": "设计系统搭建：从零到一",                             "platform": "Zhihu",    "author": "设计达人", "duration": 30, "category": "实用技巧", "color": "#0EA5E9", "isFavorite": False, "isLiked": False, "hasNote": True,  "note": "设计系统的核心是 token 管理，组件库只是表象。", "tags": '["实用"]'},
    {"id": 7,  "title": "2026 前端技术趋势展望",                              "platform": "Bilibili", "author": "技术圆桌", "duration": 25, "category": "深度知识", "color": "#10B981", "isFavorite": False, "isLiked": True,  "hasNote": False, "note": None, "tags": None},
    {"id": 8,  "title": "深度解读：大模型的推理成本",                          "platform": "Podcast",  "author": "Tech Talk", "duration": 40, "category": "行业资讯", "color": "#F59E0B", "isFavorite": True,  "isLiked": False, "hasNote": True,  "note": None, "tags": None},
    {"id": 9,  "title": "幽默科普：黑洞是什么",                               "platform": "Bilibili", "author": "科普君",   "duration": 8,  "category": "娱乐科普", "color": "#F43F5E", "isFavorite": False, "isLiked": False, "hasNote": False, "note": None, "tags": None},
    {"id": 10, "title": "TypeScript 高级类型体操",                            "platform": "Zhihu",    "author": "前端小智", "duration": 18, "category": "深度知识", "color": "#10B981", "isFavorite": True,  "isLiked": True,  "hasNote": True,  "note": None, "tags": None},
    {"id": 11, "title": "2026 AI Agent 爆发与前端机会",                        "platform": "Bilibili", "author": "技术圆桌", "duration": 35, "category": "深度知识", "color": "#10B981", "isFavorite": True,  "isLiked": True,  "hasNote": True,  "note": None, "tags": None},
    {"id": 12, "title": "Rust 在前端工具链的全面胜利",                        "platform": "Bilibili", "author": "技术圆桌", "duration": 40, "category": "深度知识", "color": "#10B981", "isFavorite": True,  "isLiked": False, "hasNote": True,  "note": None, "tags": None},
    {"id": 13, "title": "独立开发者：用 AI 一人打造千万级产品",                  "platform": "Podcast",  "author": "Tech Talk", "duration": 55, "category": "行业资讯", "color": "#F59E0B", "isFavorite": True,  "isLiked": True,  "hasNote": True,  "note": None, "tags": None},
    {"id": 14, "title": "GPT-5 核心架构解析",                                "platform": "Podcast",   "author": "Tech Talk", "duration": 60, "category": "行业资讯", "color": "#F59E0B", "isFavorite": True,  "isLiked": False, "hasNote": True,  "note": None, "tags": None},
    {"id": 15, "title": "从零实现个人 AI 助手",                               "platform": "Bilibili", "author": "技术圆桌", "duration": 45, "category": "深度知识", "color": "#10B981", "isFavorite": True,  "isLiked": True,  "hasNote": True,  "note": None, "tags": None},
    {"id": 16, "title": "未来五年的科技趋势总结",                             "platform": "Podcast",  "author": "Tech Talk", "duration": 50, "category": "行业资讯", "color": "#F59E0B", "isFavorite": True,  "isLiked": True,  "hasNote": True,  "note": None, "tags": None},
    {"id": 17, "title": "AI 时代我们需要什么认知？",                          "platform": "Zhihu",    "author": "认知突破", "duration": 15, "category": "效率与认知", "color": "#EC4899", "isFavorite": True,  "isLiked": True,  "hasNote": True,  "note": None, "tags": None},
    {"id": 18, "title": "如何高效获取优质信息源",                             "platform": "Zhihu",    "author": "认知突破", "duration": 20, "category": "效率与认知", "color": "#EC4899", "isFavorite": True,  "isLiked": False, "hasNote": True,  "note": None, "tags": None},
    {"id": 19, "title": "微前端架构在大型项目中的应用",                        "platform": "Bilibili", "author": "技术圆桌", "duration": 40, "category": "深度知识", "color": "#10B981", "isFavorite": False, "isLiked": True,  "hasNote": True,  "note": None, "tags": None},
    {"id": 20, "title": "AIGC 如何重塑设计流程",                             "platform": "Zhihu",    "author": "设计达人", "duration": 25, "category": "实用技巧", "color": "#0EA5E9", "isFavorite": True,  "isLiked": True,  "hasNote": True,  "note": None, "tags": None},
]

# SOURCE_CONCEPT_MAP: item_id -> [concept_name, ...]
source_concept_map = {
    1:  ["frontend-arch", "ai-trend"],
    2:  ["animation", "frontend-arch"],
    3:  ["ai-trend", "productivity"],
    4:  ["science-pop"],
    5:  ["frontend-arch", "animation"],
    6:  ["design-system", "productivity"],
    7:  ["frontend-arch", "ai-trend"],
    8:  ["ai-trend"],
    9:  ["science-pop"],
    10: ["frontend-arch", "design-system"],
    11: ["ai-trend", "frontend-arch"],
    12: ["frontend-arch"],
    13: ["ai-trend", "productivity"],
    14: ["ai-trend"],
    15: ["ai-trend", "frontend-arch", "productivity"],
    16: ["ai-trend", "science-pop"],
    17: ["productivity", "ai-trend"],
    18: ["productivity"],
    19: ["frontend-arch"],
    20: ["design-system", "ai-trend"],
}

# Insert items and collect mapping from old mock ID -> new DB ID
new_item_ids = {}
print(">>> Creating information items...")
for item in inbox_items:
    payload = {
        "title": item["title"],
        "platform": item["platform"],
        "author": item["author"],
        "category": item["category"],
        "color": item["color"],
        "durationMinutes": item["duration"],
        "isFavorite": item["isFavorite"],
        "isLiked": item["isLiked"],
        "hasNote": item["hasNote"],
        "processStatus": "PROCESSED",
    }
    if item["note"]:
        payload["note"] = item["note"]
    if item["tags"]:
        payload["tags"] = item["tags"]

    r = requests.post(f"{BASE}/api/inbox/items", json=payload, headers=headers)
    r.raise_for_status()
    created = r.json()
    new_item_ids[item["id"]] = created["id"]
    print(f"  [{created['id']}] {item['title'][:30]}...")

# ── 4. Insert mappings ──
print("\n>>> Creating item-concept mappings...")
for old_item_id, concept_names in source_concept_map.items():
    new_id = new_item_ids[old_item_id]
    for cname in concept_names:
        cid = concept_id_map[cname]
        payload = {"itemId": new_id, "conceptId": cid}
        r = requests.post(f"{BASE}/api/graph/mappings", json=payload, headers=headers)
        r.raise_for_status()
        print(f"  item {new_id} -> concept {cid} ({cname})")

print("\n✓ Done! All mock data has been seeded into the database.")
