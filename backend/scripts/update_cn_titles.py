#!/usr/bin/env python3
import json
import sqlite3
import os

# Read the extracted data
with open('/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/hot100_with_cn.json', 'r') as f:
    problems = json.load(f)

# Connect to database
db_path = '/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/dashboard.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check if title_cn column exists
cursor.execute("PRAGMA table_info(problems)")
columns = [col[1] for col in cursor.fetchall()]
print(f"Current columns: {columns}")

# Add title_cn column if not exists
if 'title_cn' not in columns:
    cursor.execute("ALTER TABLE problems ADD COLUMN title_cn TEXT")
    print("Added title_cn column")

# Update problems with Chinese titles
updated = 0
for p in problems:
    cursor.execute(
        "UPDATE problems SET title_cn = ? WHERE slug = ?",
        (p['title_cn'], p['slug'])
    )
    if cursor.rowcount > 0:
        updated += 1

conn.commit()
conn.close()

print(f"✓ Updated {updated} problems with Chinese titles")
