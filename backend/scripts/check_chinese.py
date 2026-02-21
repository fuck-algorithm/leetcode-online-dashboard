#!/usr/bin/env python3
import re
import json

# Read the HTML file
with open('/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/hot-100.html', 'r') as f:
    content = f.read()

# Find the NEXT_DATA script tag
match = re.search(r'<script id="__NEXT_DATA__"[^>]*>({.*?})</script>', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    questions = data['props']['pageProps']['studyPlanDetail']['questions']
    
    # Check first question fields
    q = questions[0]
    print("Available fields:", list(q.keys()))
    print()
    
    # Look for fields with Chinese characters
    chinese_fields = []
    for k, v in q.items():
        if isinstance(v, str) and len(v) > 0:
            # Check if contains Chinese characters
            if any('\u4e00' <= c <= '\u9fff' for c in v):
                chinese_fields.append((k, v))
    
    if chinese_fields:
        print("Fields with Chinese content:")
        for k, v in chinese_fields[:5]:
            print(f"  {k}: {v}")
    else:
        print("No Chinese title fields found in the data")
        print()
        print("Sample data fields:")
        for k, v in list(q.items())[:10]:
            if isinstance(v, str):
                print(f"  {k}: {v}")
else:
    print("Could not find __NEXT_DATA__")
