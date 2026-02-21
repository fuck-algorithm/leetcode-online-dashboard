import re
import json

with open('/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/hot-100.html', 'r') as f:
    content = f.read()

match = re.search(r'<script id="__NEXT_DATA__"[^>]*>({.*?})</script>', content, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    questions = data['props']['pageProps']['studyPlanDetail']['questions']
    
    slugs = [f'\t\t"{q["titleSlug"]}",' for q in questions]
    
    new_func = '// getHot100Problems returns the LeetCode Hot 100 problem slugs\n'
    new_func += 'func getHot100Problems() []string {\n'
    new_func += '\tproblems := []string{\n'
    new_func += '\n'.join(slugs)
    new_func += '\n\t}\n'
    new_func += '\treturn problems\n'
    new_func += '}'
    
    with open('/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/internal/config/config.go', 'r') as f:
        config = f.read()
    
    pattern = r'// getHot100Problems returns the LeetCode Hot 100 problem slugs.*?\treturn problems\n}'
    config = re.sub(pattern, new_func, config, flags=re.DOTALL)
    
    with open('/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/internal/config/config.go', 'w') as f:
        f.write(config)
    
    print(f'Updated {len(questions)} problems')
    for i, q in enumerate(questions[:10], 1):
        print(f"{i}. [{q['questionFrontendId']}] {q['title']}")
else:
    print('Failed to find __NEXT_DATA__')
