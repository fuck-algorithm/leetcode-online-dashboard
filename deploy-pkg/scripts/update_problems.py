#!/usr/bin/env python3
import re
import json

# Read the HTML file
with open('/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/hot-100.html', 'r') as f:
    content = f.read()

# Find and extract __NEXT_DATA__
match = re.search(r'<script id="__NEXT_DATA__"[^>]*>({.*?})</script>', content, re.DOTALL)
if not match:
    print("ERROR: Could not find __NEXT_DATA__")
    exit(1)

# Parse the JSON data
data = json.loads(match.group(1))
questions = data['props']['pageProps']['studyPlanDetail']['questions']

print(f"Found {len(questions)} questions")

# Save full data to JSON
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

print(f"✓ Saved to hot100_problems.json")

# Generate Go code
slugs_lines = [f'\t\t"{q["titleSlug"]}",' for q in questions]
slugs_content = '\n'.join(slugs_lines)

new_function = f'''// getHot100Problems returns the LeetCode Hot 100 problem slugs
func getHot100Problems() []string {{
\tproblems := []string{{
{slugs_content}
\t}}
\treturn problems
}}'''

# Read current config.go
with open('/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/internal/config/config.go', 'r') as f:
    go_content = f.read()

# Replace the function
pattern = r'// getHot100Problems returns the LeetCode Hot 100 problem slugs.*?\treturn problems\n}'
new_go_content = re.sub(pattern, new_function, go_content, flags=re.DOTALL)

# Write back
with open('/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/internal/config/config.go', 'w') as f:
    f.write(new_go_content)

print(f"✓ Updated config.go with {len(questions)} problems")

# Print first 10 for verification
for i, p in enumerate(problems[:10], 1):
    print(f"{i}. [{p['id']}] {p['title']}")
