#!/usr/bin/env python3
import re
import json

with open('/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/hot-100.html', 'r') as f:
    content = f.read()

match = re.search(r'<script id="__NEXT_DATA__"[^>]*>({.*?})</script>', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    questions = data['props']['pageProps']['studyPlanDetail']['questions']
    
    # Check what fields are available
    q = questions[0]
    print('Available fields:', list(q.keys()))
    print()
    print('Sample question:')
    for k, v in list(q.items())[:15]:
        print(f'  {k}: {v}')
