#!/usr/bin/env python3
"""
Parse hot-100.html to extract the correct Hot 100 problems
"""
import re
import json

# Read the hot-100.html file
with open('/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/hot-100.html', 'r', encoding='utf-8') as f:
    content = f.read()

print(f"File size: {len(content)} characters")

# Try to extract from __NEXT_DATA__
next_data_pattern = r'<script id="__NEXT_DATA__"[^>]*>({.*?})</script>'
matches = re.findall(next_data_pattern, content, re.DOTALL)
print(f"Found {len(matches)} __NEXT_DATA__ matches")

if matches:
    try:
        data = json.loads(matches[0])
        print(f"Successfully parsed NEXT_DATA")
        
        # Navigate to find questions
        if 'props' in data and 'pageProps' in data['props']:
            page_props = data['props']['pageProps']
            
            if 'studyPlanDetail' in page_props:
                study_plan = page_props['studyPlanDetail']
                print(f"Found studyPlanDetail")
                
                if 'questions' in study_plan:
                    questions = study_plan['questions']
                    print(f"Found {len(questions)} questions")
                    
                    problems = []
                    for q in questions:
                        problem = {
                            'id': q.get('questionFrontendId', q.get('id', '')),
                            'title': q.get('title', ''),
                            'titleSlug': q.get('titleSlug', q.get('slug', '')),
                            'difficulty': q.get('difficulty', 'Medium'),
                        }
                        problems.append(problem)
                    
                    # Save to JSON file
                    output_file = '/Users/cc11001100/github/fuck-algorithm/leetcode-online-dashboard/backend/data/hot100_problems.json'
                    with open(output_file, 'w', encoding='utf-8') as f:
                        json.dump(problems, f, indent=2, ensure_ascii=False)
                    
                    print(f"\nSaved {len(problems)} problems to {output_file}")
                    
                    # Print first 10 problems
                    print("\nFirst 10 problems:")
                    for i, p in enumerate(problems[:10], 1):
                        print(f"  {i}. [{p['id']}] {p['title']} ({p['titleSlug']}) - {p['difficulty']}")
                        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
else:
    print("No __NEXT_DATA__ found")
