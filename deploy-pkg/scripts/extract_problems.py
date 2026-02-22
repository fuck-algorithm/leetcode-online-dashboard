#!/usr/bin/env python3
import re
import json

with open('/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/hot-100.html', 'r') as f:
    content = f.read()

match = re.search(r'<script id="__NEXT_DATA__"[^>]*>({.*?})</script>', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    questions = data['props']['pageProps']['studyPlanDetail']['questions']
    
    problems = []
    for q in questions:
        problems.append({
            'id': q['questionFrontendId'],
            'slug': q['titleSlug'],
            'title': q['title'],
            'difficulty': q['difficulty']
        })
    
    with open('/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/hot100_problems.json', 'w') as f:
        json.dump(problems, f, indent=2)
    
    print(f'Extracted {len(problems)} problems')
    for i, p in enumerate(problems[:10], 1):
        print(f"{i}. [{p['id']}] {p['title']} ({p['slug']})")
else:
    print("No __NEXT_DATA__ found")
