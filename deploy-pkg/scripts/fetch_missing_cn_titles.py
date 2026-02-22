#!/usr/bin/env python3
"""
获取缺失的中文题目标题
从 LeetCode CN 获取题目中文标题并更新数据库
"""

import json
import sqlite3
import urllib.request
import urllib.error
import ssl
import time

# 创建SSL上下文
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# GraphQL 查询获取题目中文标题
GRAPHQL_QUERY = """
query problemTitle($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    title
    translatedTitle
    titleSlug
  }
}
"""

def fetch_cn_title(slug):
    """从 LeetCode CN 获取题目中文标题"""
    url = "https://leetcode.cn/graphql/"
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": f"https://leetcode.cn/problems/{slug}/"
    }
    
    data = json.dumps({
        "query": GRAPHQL_QUERY,
        "variables": {"titleSlug": slug},
        "operationName": "problemTitle"
    }).encode()
    
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, context=ssl_context, timeout=10) as response:
            result = json.loads(response.read().decode())
            if result.get("data") and result["data"].get("question"):
                return result["data"]["question"].get("translatedTitle", "")
    except Exception as e:
        print(f"Error fetching {slug}: {e}")
    
    return ""

def get_missing_slugs():
    """获取数据库中缺失中文标题的题目"""
    db_path = "/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/dashboard.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT slug FROM problems 
        WHERE title_cn IS NULL OR title_cn = ''
        ORDER BY slug
    """)
    
    slugs = [row[0] for row in cursor.fetchall()]
    conn.close()
    return slugs

def update_cn_title(slug, cn_title):
    """更新数据库中的中文标题"""
    db_path = "/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/dashboard.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute(
        "UPDATE problems SET title_cn = ? WHERE slug = ?",
        (cn_title, slug)
    )
    
    conn.commit()
    updated = cursor.rowcount
    conn.close()
    return updated

def main():
    slugs = get_missing_slugs()
    print(f"找到 {len(slugs)} 道缺失中文标题的题目")
    print(f"前10道: {slugs[:10]}")
    
    success = 0
    failed = []
    
    for i, slug in enumerate(slugs):
        print(f"\n[{i+1}/{len(slugs)}] 获取 {slug} ...", end=" ")
        cn_title = fetch_cn_title(slug)
        
        if cn_title:
            update_cn_title(slug, cn_title)
            print(f"✓ {cn_title}")
            success += 1
        else:
            print("✗ 失败")
            failed.append(slug)
        
        # 避免请求过快
        time.sleep(0.5)
    
    print(f"\n\n完成！成功: {success}, 失败: {len(failed)}")
    if failed:
        print(f"失败的题目: {failed}")

if __name__ == "__main__":
    main()
