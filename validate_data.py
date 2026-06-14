import json, re
from collections import defaultdict

# Read pyq_data.js
with open('pyq_data.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract GS1 data (nested: topics -> subtopics -> questions)
gs1_match = re.search(r'const pyqGS1Data = (\[.*?\]);\s*(?:const|$)', content, re.DOTALL)
gs1_raw = json.loads(gs1_match.group(1))

# Flatten GS1 questions
gs1_questions = []
for topic in gs1_raw:
    topic_name = topic.get('name', 'Unknown')
    for subtopic in topic.get('subtopics', []):
        for q in subtopic.get('questions', []):
            q['_topic'] = topic_name
            q['_subtopic'] = subtopic.get('name', '')
            gs1_questions.append(q)

# Extract CSAT data (same nested structure)
csat_match = re.search(r'const pyqCSATData = (\[.*?\]);\s*$', content, re.DOTALL)
csat_raw = json.loads(csat_match.group(1))

# Flatten CSAT questions
csat_questions = []
for topic in csat_raw:
    topic_name = topic.get('name', 'Unknown')
    for subtopic in topic.get('subtopics', []):
        for q in subtopic.get('questions', []):
            q['_topic'] = topic_name
            q['_subtopic'] = subtopic.get('name', '')
            csat_questions.append(q)

print('=' * 60)
print('GS PAPER I - YEAR-WISE QUESTION COUNTS')
print('=' * 60)
print(f'Total Questions: {len(gs1_questions)}')
print()

year_counts = {}
for q in gs1_questions:
    yr = q.get('year', 'Unknown')
    year_counts[yr] = year_counts.get(yr, 0) + 1

total = 0
for yr in sorted(year_counts.keys(), reverse=True):
    count = year_counts[yr]
    total += count
    status = 'OK' if count == 100 else f'*** MISMATCH (expected 100) ***'
    print(f'  {yr}: {count} questions  {status}')
print(f'\n  Sum of all years: {total}')

# Check for duplicates (same question text appearing in multiple years)
q_text_years = defaultdict(list)
for q in gs1_questions:
    # Strip HTML tags for comparison
    clean = re.sub(r'<[^>]+>', ' ', q.get('question', '')).strip()[:120]
    q_text_years[clean].append({'year': q.get('year','?'), 'answer': q.get('answer','?')})

dupes = {k:v for k,v in q_text_years.items() if len(v) > 1}
print(f'\n  Duplicate questions (same text, multiple entries): {len(dupes)}')
if dupes:
    for txt, entries in list(dupes.items())[:10]:
        years = [e['year'] for e in entries]
        print(f'    "{txt[:70]}..." -> years: {years}')

print()
print('=' * 60)
print('CSAT PAPER II - COMPREHENSION PASSAGE ANALYSIS')
print('=' * 60)

# Filter comprehension questions
comp_qs = [q for q in csat_questions if q.get('_topic') == 'Comprehension']
print(f'Total Comprehension Questions: {len(comp_qs)}')

# Group by passage
passage_groups = defaultdict(list)
for q in comp_qs:
    passage = q.get('passage', '')
    if passage:
        # Use first 150 chars as key
        key = re.sub(r'<[^>]+>', ' ', passage).strip()[:150]
        passage_groups[key].append(q)
    else:
        passage_groups['NO_PASSAGE'].append(q)

actual_passages = {k:v for k,v in passage_groups.items() if k != 'NO_PASSAGE'}
print(f'Total passage groups (with passage text): {len(actual_passages)}')
print()

# Count questions per passage
qs_per_passage = defaultdict(int)
for key, qs in actual_passages.items():
    count = len(qs)
    qs_per_passage[count] += 1

print('Questions per passage distribution:')
for count in sorted(qs_per_passage.keys()):
    num_passages = qs_per_passage[count]
    print(f'  {count} question(s) per passage: {num_passages} passages')

# Show passages with != 2 questions
print()
print('Passages with NOT exactly 2 questions:')
problem_count = 0
for key, qs in actual_passages.items():
    if len(qs) != 2:
        problem_count += 1
        if problem_count <= 20:
            years = sorted(set(q.get('year','?') for q in qs))
            print(f'  [{len(qs)} Qs] Year(s): {years} - "{key[:80]}..."')
if problem_count > 20:
    print(f'  ... and {problem_count - 20} more')
print(f'\n  Total passages with != 2 questions: {problem_count}')

# Questions without passage
no_passage = passage_groups.get('NO_PASSAGE', [])
print(f'  Comprehension questions WITHOUT a passage field: {len(no_passage)}')
if no_passage:
    for q in no_passage[:5]:
        print(f'    Q#{q.get("number","?")} ({q.get("year","?")}) - "{re.sub("<[^>]+>"," ",q.get("question",""))[:60]}..."')

print()
print('=' * 60)
print('CSAT PAPER II - OTHER SECTIONS GROUPED QUESTIONS CHECK')
print('=' * 60)
print('(Checking for questions that share a common stem/diagram/directions)')

# Check non-comprehension topics for grouped questions
other_topics = defaultdict(list)
for q in csat_questions:
    topic = q.get('_topic', 'Unknown')
    if topic != 'Comprehension':
        other_topics[topic].append(q)

for topic in sorted(other_topics.keys()):
    qs = other_topics[topic]
    # Check for questions with passage/directions field
    with_passage = [q for q in qs if q.get('passage')]
    # Group by passage
    grouped = defaultdict(list)
    for q in qs:
        p = q.get('passage', '')
        if p:
            key = re.sub(r'<[^>]+>', ' ', p).strip()[:150]
            grouped[key].append(q)
    
    multi_groups = {k:v for k,v in grouped.items() if len(v) > 1}
    
    print(f'\n  {topic}: {len(qs)} total Qs, {len(with_passage)} with directions/stem, {len(multi_groups)} groups of 2+ Qs')
    if multi_groups:
        for key, group_qs in list(multi_groups.items())[:5]:
            years = sorted(set(q.get('year','?') for q in group_qs))
            print(f'    [{len(group_qs)} Qs] Year(s): {years} - "{key[:70]}..."')

print()
print('=' * 60)
print('CSAT - YEAR-WISE QUESTION COUNTS')
print('=' * 60)

csat_year_counts = {}
for q in csat_questions:
    yr = q.get('year', 'Unknown')
    csat_year_counts[yr] = csat_year_counts.get(yr, 0) + 1

for yr in sorted(csat_year_counts.keys(), reverse=True):
    count = csat_year_counts[yr]
    print(f'  {yr}: {count} questions')
