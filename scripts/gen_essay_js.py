import json
from collections import defaultdict

with open('PYQ/essay_extracted.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

by_topic = defaultdict(list)
for d in data:
    by_topic[d['topic']].append(d)

def clean_text(s):
    # Fix smart quotes and encoding artifacts
    s = s.replace('\u2018', "'").replace('\u2019', "'")
    s = s.replace('\u201c', '"').replace('\u201d', '"')
    s = s.replace('\u2013', '-').replace('\u2014', '-')
    s = s.replace('\u00e2\u0080\u0099', "'")
    # Remove any remaining Hindi text that leaked in
    import re
    s = re.sub(r'[\u0900-\u097F\u0980-\u09FF]+.*$', '', s).strip()
    s = s.rstrip(' .')
    return s

lines = ['const pyqEssayData = [']
for topic, questions in by_topic.items():
    lines.append('  {')
    lines.append(f'    topic: "{topic}",')
    lines.append('    questions: [')
    for q in sorted(questions, key=lambda x: x['year'], reverse=True):
        qt = clean_text(q['question'])
        if not qt:
            continue
        qt = qt.replace('"', '\\"')
        lines.append(f'      {{ year: {q["year"]}, q: "{qt}" }},')
    lines.append('    ]')
    lines.append('  },')
lines.append('];')

js_output = '\n'.join(lines)
with open('pyq_essay.js', 'w', encoding='utf-8') as f:
    f.write(js_output)

print(f'Written {len(data)} questions across {len(by_topic)} topics to pyq_essay.js')
