import pdfplumber
import os
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

folder = r'c:\Users\nishantkumar04\OneDrive - Nagarro\Documents\upsc-tracker\PYQ'
files = [f for f in os.listdir(folder) if f.endswith('.pdf')]
anthro_files = [f for f in files if 'Anthro' in f or 'Indian Society' in f]

print(f"Found {len(anthro_files)} Anthro PDF files:")
for f in anthro_files:
    print(f"  - {f}")
print()

# Extract all text and find PYQ sections
for f in anthro_files:
    path = os.path.join(folder, f)
    with pdfplumber.open(path) as pdf:
        print(f"\n{'='*80}")
        print(f"FILE: {f} ({len(pdf.pages)} pages)")
        print('='*80)
        
        # Get all text
        full_text = ""
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"
        
        # Print first 2 pages for topic identification
        print("\n>>> FIRST 2 PAGES (for topic identification):")
        for i, page in enumerate(pdf.pages[:2]):
            text = page.extract_text()
            if text:
                print(f"\n--- Page {i+1} ---")
                print(text[:1200])
        
        # Search for PYQ sections
        pyq_markers = ['PYQ', 'Previous Year', 'Mains Question', 'UPSC Question', 'Practice Question', 'Question Bank']
        found_pyq = False
        for marker in pyq_markers:
            idx = full_text.lower().find(marker.lower())
            if idx != -1:
                found_pyq = True
                print(f"\n>>> FOUND '{marker}' at char {idx}")
                # Write PYQ section to output file
                pyq_section = full_text[max(0,idx-200):]
                output_file = os.path.join(folder, f"{f}_PYQ_EXTRACTED.txt")
                with open(output_file, 'w', encoding='utf-8') as out:
                    out.write(f"SOURCE: {f}\n")
                    out.write(f"TOPIC HEADER (from page 1-2):\n")
                    for i, page in enumerate(pdf.pages[:2]):
                        text = page.extract_text()
                        if text:
                            out.write(text[:800] + "\n")
                    out.write(f"\n{'='*60}\nPYQ SECTION:\n{'='*60}\n")
                    out.write(pyq_section)
                print(f"   Written to: {output_file}")
                break
        
        if not found_pyq:
            # Try last 3 pages
            print(f"\n>>> NO PYQ MARKER FOUND. Writing last 5 pages to file.")
            output_file = os.path.join(folder, f"{f}_LAST_PAGES.txt")
            with open(output_file, 'w', encoding='utf-8') as out:
                out.write(f"SOURCE: {f}\n")
                for i in range(max(0, len(pdf.pages)-5), len(pdf.pages)):
                    text = pdf.pages[i].extract_text()
                    if text:
                        out.write(f"\n--- Page {i+1} ---\n")
                        out.write(text)

print("\n\nDONE")
