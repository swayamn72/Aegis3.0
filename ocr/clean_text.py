import re

def clean_lines(text):
    lines = []
    for line in text.splitlines():
        line = line.strip()

        if not line:
            continue

        # Remove obvious garbage words
        if re.search(r'div|dio|mdi|ae|dtv', line.lower()):
            continue

        # Remove very short junk
        if len(line) < 3:
            continue

        lines.append(line)

    return lines
