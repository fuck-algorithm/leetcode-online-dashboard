#!/usr/bin/env python3
import re
import json

# Read the HTML file
with open('/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/hot-100.html', 'r') as f:
    content = f.read()

print(f"File size: {len(content)} characters")

# Find __NEXT_DATA__
match = re.search(r'<script id="__NEXT_DATA__"[^>]*>({.*?})</script>', content, re.DOTALL)
if match:
    print("Found __NEXT_DATA__ script tag")
    data = json.loads(match.group(1))
    questions = data['props']['pageProps']['studyPlanDetail']['questions']
    
    print(f"\nFound {len(questions)} questions")
    
    # Generate Go code
    slugs = [f'\t\t"{q["titleSlug"]}",' for q in questions]
    go_array = '\n'.join(slugs)
    
    new_func = f'''// getHot100Problems returns the LeetCode Hot 100 problem slugs
func getHot100Problems() []string {{
	problems := []string{{
{go_array}
	}}
	return problems
}}'''
    
    # Read current config.go
    config_path = '/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/internal/config/config.go'
    with open(config_path, 'r') as f:
        config_content = f.read()
    
    # Replace the function
    pattern = r'// getHot100Problems returns the LeetCode Hot 100 problem slugs.*?\treturn problems\n}'
    new_content = re.sub(pattern, new_func, config_content, flags=re.DOTALL)
    
    # Write back
    with open(config_path, 'w') as f:
        f.write(new_content)
    
    print(f"✓ Updated config.go with {len(questions)} problems")
    print("\nFirst 10 problems:")
    for i, q in enumerate(questions[:10], 1):
        print(f"{i}. [{q['questionFrontendId']}] {q['title']}")
else:
    print("✗ Could not find __NEXT_DATA__")
