"""
Extract GS Mains PYQs from the 13-year topic-wise PDF.
Uses keyword-based topic splitting aligned with UPSC syllabus.
"""
import pdfplumber
import re
import json

PDF_PATH = "PYQ/13_Years_topic_wise_PYQS_of_GS_MAINS_1234_2025_2013_FINAL.pdf"

# Topic markers for each paper - these strings appear in the PDF as section headers
GS2_TOPICS = [
    ("Indian Constitution", "Indian Constitution: Historical underpinnings"),
    ("Separation of Powers & Dispute Redressal", "Separation of powers"),
    ("Parliament & State Legislatures", "Parliament and State Legislatures"),
    ("Executive & Judiciary", "Structure, organization and functioning of the Executive"),
    ("Constitutional Posts & Bodies", "Appointment to various Constitutional Posts"),
    ("Statutory & Quasi-judicial Bodies", "Statutory, Regulatory and various Quasi-judicial"),
    ("NGOs, SHGs & Pressure Groups", "Development processes and the development industry"),
    ("Governance & Accountability", "Important aspects of governance, transparency"),
    ("Role of Civil Services", "Role of civil services"),
    ("International Relations", "International Relations"),
]

GS4_TOPICS = [
    ("Ethics & Human Interface", "Ethics and Human Interface"),
    ("Attitude", "Attitude"),
    ("Aptitude & Values for Civil Service", "Aptitude and foundational values"),
    ("Emotional Intelligence", "Emotional intelligence"),
    ("Public/Civil Service Values", "Public/Civil service values"),
    ("Probity in Governance", "Probity in Governance"),
    ("Case Studies", "Case Studies"),
]


def extract_all_text():
    pages = []
    with pdfplumber.open(PDF_PATH) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            pages.append(text if text else "")
    return "\n".join(pages)


def split_papers(full_text):
    gs1_start = full_text.find("General Studies 1:")
    gs2_start = full_text.find("POLITY AND GOVERNANCE")
    gs3_start = full_text.find("General Studies 3:")
    gs4_start = full_text.find("General Studies 4:")
    
    if gs1_start == -1: gs1_start = 0
    
    return {
        "GS1": full_text[gs1_start:gs2_start],
        "GS2": full_text[gs2_start:gs3_start],
        "GS3": full_text[gs3_start:gs4_start],
        "GS4": full_text[gs4_start:],
    }


def extract_questions_from_text(text):
    """Extract questions from a block of text. Each question starts with number. or number)"""
    questions = []
    # Split on lines starting with a number
    parts = re.split(r'(?:^|\n)(\d+[\.\)]\s)', text)
    
    # Reassemble: parts[0] is before first Q, then pairs of (number_prefix, text)
    i = 1
    while i < len(parts) - 1:
        num_prefix = parts[i]
        q_body = parts[i+1] if i+1 < len(parts) else ""
        full_q = (num_prefix + q_body).strip()
        
        # Extract year - various formats
        year_match = re.search(r'[\(\s\.](20[12]\d)[\)\s\.]', full_q)
        if not year_match:
            year_match = re.search(r'(20[12]\d)', full_q)
        
        if year_match:
            year = year_match.group(1)
            
            # Extract marks
            marks = 10
            marks_match = re.search(r'\((\d+)\s*[Mm](?:arks)?\)', full_q)
            if not marks_match:
                marks_match = re.search(r'(\d+)\s*[Mm](?:arks)?', full_q)
            if not marks_match:
                marks_match = re.search(r'\)\s*(\d+)\s*$', full_q)
            if marks_match:
                m = int(marks_match.group(1))
                if m in (10, 15, 20, 25):
                    marks = m
            
            # Clean question text
            q_text = re.sub(r'^\d+[\.\)]\s*', '', full_q)
            # Remove year/marks from end
            q_text = re.sub(r'\s*\(?\s*Answer in \d+ words\s*\)?\s*\d*\s*$', '', q_text, flags=re.IGNORECASE)
            q_text = re.sub(r'\s*\(?\s*20[12]\d\s*\)?\s*\(?\s*\d+\s*[Mm](?:arks)?\s*\)?\s*$', '', q_text)
            q_text = re.sub(r'\s*\(?\s*20[12]\d\s*\)?\s*\d*\s*$', '', q_text)
            q_text = re.sub(r'\s*\(\d+\s*[Mm]\)\s*$', '', q_text)
            q_text = re.sub(r'\s*\d+\.\d+\s*$', '', q_text)  # trailing "12.5"
            q_text = re.sub(r'\s*\d+\s*$', '', q_text)
            q_text = q_text.strip().rstrip('.')
            
            # Replace newlines with spaces
            q_text = re.sub(r'\s+', ' ', q_text)
            
            if len(q_text) > 15:
                questions.append({
                    "question": q_text,
                    "year": year,
                    "marks": marks
                })
        i += 2
    
    return questions


def split_by_caps_headers(text):
    """Split text by ALL-CAPS headers (>20 chars). Returns list of (header, body) tuples."""
    lines = text.split('\n')
    sections = []
    current_header = None
    current_body = []
    
    for line in lines:
        s = line.strip()
        # Detect ALL CAPS headers (syllabus topic markers)
        if (len(s) > 20 and s.isupper() and 
            not re.match(r'^\d+[\.\)]', s) and
            'GENERAL STUDIES' not in s):
            # Save previous section
            if current_header or current_body:
                sections.append((current_header, '\n'.join(current_body)))
            current_header = s
            current_body = []
        else:
            current_body.append(line)
    
    # Last section
    if current_header or current_body:
        sections.append((current_header, '\n'.join(current_body)))
    
    return sections


def split_by_keyword_topics(text, topic_markers):
    """Split text by known keyword-based topic markers."""
    positions = []
    for display_name, search_key in topic_markers:
        pos = text.find(search_key)
        if pos >= 0:
            positions.append((pos, display_name))
    
    positions.sort(key=lambda x: x[0])
    
    sections = []
    for i, (pos, name) in enumerate(positions):
        end = positions[i+1][0] if i+1 < len(positions) else len(text)
        sections.append((name, text[pos:end]))
    
    # If no markers found, return all text as one section
    if not sections:
        return [("General", text)]
    
    return sections


def clean_topic_name(name):
    """Clean ALL-CAPS topic names to Title Case, shortened."""
    # Title case
    name = name.title()
    # Remove trailing punctuation artifacts
    name = name.strip(';:,. ')
    # Shorten common patterns
    name = re.sub(r'\s*\(Including.*$', '', name)
    name = re.sub(r'\s*-\s*Their Forms.*$', '', name)
    # Truncate
    if len(name) > 70:
        name = name[:67] + "..."
    return name


def parse_gs1(text):
    """GS1 has CAPS headers for each topic."""
    sections = split_by_caps_headers(text)
    topics = []
    for header, body in sections:
        if not header:
            continue
        questions = extract_questions_from_text(body)
        if questions:
            topics.append({
                "name": clean_topic_name(header),
                "questions": questions
            })
    return topics


def parse_gs2(text):
    """GS2 uses keyword-based splitting since headers are inconsistent."""
    sections = split_by_keyword_topics(text, GS2_TOPICS)
    topics = []
    for name, body in sections:
        questions = extract_questions_from_text(body)
        if questions:
            topics.append({"name": name, "questions": questions})
    
    # If keyword approach yields few results, fall back to CAPS splitting
    if sum(len(t["questions"]) for t in topics) < 50:
        sections = split_by_caps_headers(text)
        topics = []
        for header, body in sections:
            questions = extract_questions_from_text(body)
            if questions:
                name = clean_topic_name(header) if header else "General Polity"
                topics.append({"name": name, "questions": questions})
    
    return topics


def parse_gs3(text):
    """GS3 has CAPS headers."""
    sections = split_by_caps_headers(text)
    topics = []
    for header, body in sections:
        if not header:
            continue
        questions = extract_questions_from_text(body)
        if questions:
            topics.append({
                "name": clean_topic_name(header),
                "questions": questions
            })
    return topics


def parse_gs4(text):
    """GS4 - try keyword topics, fallback to treating as one block."""
    sections = split_by_keyword_topics(text, GS4_TOPICS)
    topics = []
    for name, body in sections:
        questions = extract_questions_from_text(body)
        if questions:
            topics.append({"name": name, "questions": questions})
    
    # Fallback: if few questions found, extract all as one topic
    if sum(len(t["questions"]) for t in topics) < 20:
        questions = extract_questions_from_text(text)
        if questions:
            topics = [{"name": "Ethics, Integrity & Aptitude", "questions": questions}]
    
    return topics


def number_questions(topics):
    for topic in topics:
        for i, q in enumerate(topic["questions"], 1):
            q["number"] = i
    return topics


def main():
    print("Extracting text from PDF...")
    full_text = extract_all_text()
    print(f"Total: {len(full_text)} chars")
    
    print("Splitting into papers...")
    papers = split_papers(full_text)
    for k, v in papers.items():
        print(f"  {k}: {len(v)} chars")
    
    print("\nParsing each paper...")
    parsers = {"GS1": parse_gs1, "GS2": parse_gs2, "GS3": parse_gs3, "GS4": parse_gs4}
    all_data = {}
    
    for paper_name, paper_text in papers.items():
        topics = parsers[paper_name](paper_text)
        topics = number_questions(topics)
        total_q = sum(len(t["questions"]) for t in topics)
        print(f"  {paper_name}: {len(topics)} topics, {total_q} questions")
        for t in topics:
            print(f"    - {t['name'][:55]}: {len(t['questions'])} Q")
        all_data[paper_name] = topics
    
    # Generate JS
    print("\nGenerating JS...")
    js_parts = []
    for paper_name, topics in all_data.items():
        var_name = f"pyqMains{paper_name}Data"
        js_parts.append(f"const {var_name} = {json.dumps(topics, ensure_ascii=False)};")
    
    output_path = "PYQ/mains_pyq_extracted.js"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(js_parts) + "\n")
    
    grand_total = sum(sum(len(t["questions"]) for t in topics) for topics in all_data.values())
    print(f"\nDone! {output_path} — {grand_total} total questions")

if __name__ == "__main__":
    main()
