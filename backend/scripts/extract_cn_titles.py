#!/usr/bin/env python3
import re
import json
import sqlite3

# Read HTML file
with open('/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/hot-100.html', 'r') as f:
    content = f.read()

# Extract data
match = re.search(r'<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)</script>', content)
if not match:
    print("No __NEXT_DATA__ found")
    exit(1)

data = json.loads(match.group(1))
queries = data['props']['pageProps']['dehydratedState']['queries']
study_plan = queries[0]['state']['data']['studyPlanV2Detail']

# Collect all problems from all sub-groups
all_problems = []
for group in study_plan['planSubGroups']:
    for q in group['questions']:
        all_problems.append({
            'id': q['questionFrontendId'],
            'slug': q['titleSlug'],
            'title': q['title'],
            'title_cn': q.get('translatedTitle', ''),
            'difficulty': q['difficulty']
        })

print(f"Extracted {len(all_problems)} problems with Chinese titles")
for i, p in enumerate(all_problems[:5], 1):
    print(f"{i}. [{p['id']}] {p['title_cn']} ({p['title']})")

# Save to JSON
with open('/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/hot100_with_cn.json', 'w') as f:
    json.dump(all_problems, f, indent=2, ensure_ascii=False)

print(f"\n✓ Saved to hot100_with_cn.json")
