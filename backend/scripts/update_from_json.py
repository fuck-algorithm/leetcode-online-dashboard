#!/usr/bin/env python3
"""
从 hot100_with_cn.json 更新数据库中的题目信息
包括 paid_only 和 topic_tags 字段
"""
import json
import sqlite3
import os

# 路径
JSON_PATH = '/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/hot100_with_cn.json'
DB_PATH = '/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/dashboard.db'

def update_database():
    # 读取 JSON
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        problems = json.load(f)
    
    print(f"Loaded {len(problems)} problems from JSON")
    
    # 连接数据库
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    updated = 0
    for p in problems:
        # 将 topic_tags 转换为 JSON 字符串
        tags_json = json.dumps(p.get('topic_tags', []), ensure_ascii=False)
        paid_only = 1 if p.get('paid_only', False) else 0
        
        # 更新数据库
        cursor.execute("""
            UPDATE problems 
            SET paid_only = ?, tags = ?, updated_at = CURRENT_TIMESTAMP
            WHERE slug = ?
        """, (paid_only, tags_json, p['slug']))
        
        if cursor.rowcount > 0:
            updated += 1
            print(f"Updated: [{p['id']}] {p['slug']} - paid_only={p.get('paid_only')}, tags={p.get('topic_tags')}")
        else:
            print(f"Not found in DB: [{p['id']}] {p['slug']}")
    
    conn.commit()
    conn.close()
    
    print(f"\nUpdated {updated} problems in database")

if __name__ == '__main__':
    update_database()
