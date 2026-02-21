#!/usr/bin/env python3
"""
从LeetCode获取题目难度并更新数据库
"""
import sqlite3
import requests
import json
import time
from typing import Optional

# 数据库路径
DB_PATH = '/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/dashboard.db'

# LeetCode GraphQL API
LEETCODE_API = 'https://leetcode.cn/graphql/'

def get_problem_difficulty(slug: str) -> Optional[str]:
    """从LeetCode获取题目难度"""
    query = """
    query questionData($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
            difficulty
        }
    }
    """
    
    variables = {"titleSlug": slug}
    
    try:
        response = requests.post(
            LEETCODE_API,
            json={"query": query, "variables": variables},
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            if 'data' in data and 'question' in data['data']:
                difficulty = data['data']['question'].get('difficulty')
                # 转换为中文或保持英文
                difficulty_map = {
                    'Easy': 'Easy',
                    'Medium': 'Medium',
                    'Hard': 'Hard'
                }
                return difficulty_map.get(difficulty, difficulty)
        
        return None
    except Exception as e:
        print(f"获取 {slug} 难度失败: {e}")
        return None

def update_database():
    """更新数据库中的难度字段"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 获取所有题目
    cursor.execute("SELECT id, slug, difficulty FROM problems")
    problems = cursor.fetchall()
    
    print(f"共有 {len(problems)} 道题目需要处理")
    
    updated = 0
    failed = 0
    
    for problem_id, slug, current_difficulty in problems:
        # 如果已经有难度且不为空，跳过
        if current_difficulty and current_difficulty.strip():
            print(f"[{problem_id}] {slug}: 已有难度 {current_difficulty}，跳过")
            continue
        
        # 从LeetCode获取难度
        difficulty = get_problem_difficulty(slug)
        
        if difficulty:
            cursor.execute(
                "UPDATE problems SET difficulty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (difficulty, problem_id)
            )
            conn.commit()
            updated += 1
            print(f"[{problem_id}] {slug}: 更新为 {difficulty}")
        else:
            failed += 1
            print(f"[{problem_id}] {slug}: 获取失败")
        
        # 避免请求过快
        time.sleep(0.5)
    
    conn.close()
    
    print(f"\n更新完成: 成功 {updated} 道, 失败 {failed} 道")

if __name__ == '__main__':
    update_database()
