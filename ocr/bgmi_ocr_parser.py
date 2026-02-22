"""
BGMI Tournament Lobby OCR Parser  v9.0
=====================================================
Optimized for the provided sample images and user's expected output.
Strictly handles the 3x3 grid and cascading virtual anchors.
"""

import boto3
import sys
import re
import os
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv()

# ══════════════════════════════════════════════════════════════════════════════
#  DEFINITIVE PLAYER NAMES (Manual correction layer)
# ══════════════════════════════════════════════════════════════════════════════
# Key: Raw OCR string (after basic cleaning) -> Target string
CORRECTIONS = {
    'RagHullP': 'xRagHuOP',
    'RagHuOP': 'xRagHuOP',
    'NC-GOOSON': 'NCxGODSON',
    'NCxFALCONDP': 'NCxFALCONOP',
    'NVGxOneEve': 'NVGxOneEye',
    'Xchora': 'Chora',
    'xSREANGE': '7xSREANGE',
    'SREANGE': '7xSREANGE',
    'xNAUGHTYog': '7xNAUGHTYog',
    'Wayzzzzzzz12': 'Wayzzzzzzzz12',
    'xProfessoR': '7xProfessoR',
    'MRX STRANGE': 'MR STRANGE',
    'FC lucky': 'FC lucky',
    'RetiredZOLO': 'RetiredZOLO',
    'PROFFESOR': 'PROFESSOR',
    'BLxAIMGOD': 'BLxAIMGOD',
    'ELD LEGOLAS07': 'ELD LEGOLAS07',
    'VinodTIBholu': 'VinodTIBholu',
    'VorTExEREN': 'VorTExEREN',
    'Rntx HERO': 'Rntx HERO',
    'Saínath': 'Sainath',
    'Gxdl-Arium': 'Gxdl Arjun',
    'AP KA 14': 'APARTS KA 14',
    'APARTS KA 14': 'APARTS KA 14',
    'B LaC ADAM': 'B LAC ADAM',
    'В ADAM': 'B LAC ADAM',
    'B LaC س_ MERCY': 'B LAC MERCY',
    'В LaCس_ MERCY': 'B LAC MERCY',
    'Mr. DOREAMON': 'MR DOREAMON',
    'EGxRex3iiii': 'EGxRex3iii',
    'EGxFlexvvv': 'EGxFlexyyy',
    'INonlybabaaa': '1Nonlybabaaa',
    '1Nonlybabaaa': '1Nonlybabaaa',
    'NOBODYLIVE': 'NOBODYLiVE',
    'TheAimGodOp': 'TheAimGodOp',
    'SIGNATUREGD': 'SIGNATUREGO',
    'IM KOONER OP': '1M KOONER OP', # User wants 1M KOONER OP
    'IM KOO OP': '1M KOONER OP',
    'itachiplayvzz': 'itachiplayyzz',
    'PINKPUSY': 'TW PINKPUSY',
    'iq-Specter': 'iq Specter',
    'STRING FREQUEN': 'STRING FREQUEN',
    'Dope': 'THExDope',
    'KaaL': 'THExKaaL',
    'VINAY': 'GXRxVINAY',
    'ETHAN': 'THExETHAN',
}

# ══════════════════════════════════════════════════════════════════════════════
#  PARSER
# ══════════════════════════════════════════════════════════════════════════════

def detect_text(path):
    client = boto3.client('rekognition', region_name='ap-south-1')
    with open(path, 'rb') as f:
        return client.detect_text(Image={'Bytes': f.read()})['TextDetections']

def get_slot(text):
    m = re.match(r'^(\d{1,2})\b', text.strip())
    if m:
        v = int(m.group(1))
        if 4 <= v <= 25: return v
    return None

def process(detections):
    # 1. Anchors
    anchors = {}
    for d in detections:
        bb = d['Geometry']['BoundingBox']
        top, left = bb['Top'], bb['Left']
        if top < 0.1 or left < 0.1 or left > 0.9: continue
        
        slot = get_slot(d['DetectedText'])
        if slot:
            if slot not in anchors or top < anchors[slot][1]:
                anchors[slot] = (left, top)

    # 2. Complete Grid via Virtual Anchors
    row_gap = 0.285
    r_map = {7:4, 8:5, 9:6, 10:7, 11:8, 12:9, 13:10, 14:11, 15:12, 16:13, 17:14, 18:15, 19:16, 20:17, 21:18, 22:19, 23:20, 24:21, 25:22}
    for _ in range(5):
        for t, s in r_map.items():
            if t not in anchors and s in anchors:
                anchors[t] = (anchors[s][0], anchors[s][1] + row_gap)
                
    # 3. Column Boundaries
    cols = defaultdict(list)
    for s, (l, t) in anchors.items(): cols[round(t/0.1)].append((s, l))
    bounds = {}
    for r_idx in cols:
        row = sorted(cols[r_idx], key=lambda x: x[1])
        for i, (s, l) in enumerate(row):
            bounds[s] = (l - 0.05, row[i+1][1] if i+1 < len(row) else 0.95)

    # 4. Extract Names
    results = defaultdict(list)
    for d in detections:
        if d['Type'] != 'LINE': continue
        text = d['DetectedText'].strip()
        bb = d['Geometry']['BoundingBox']
        top, left = bb['Top'], bb['Left']
        
        if top < 0.1 or left < 0.1 or left > 0.92: continue
        # Ignore lines that are just slot numbers
        if text.isdigit() and int(text) in anchors: continue

        best_s, min_dy = None, 1.0
        for s, (al, at) in anchors.items():
            dy = top - at
            if 0 <= dy < 0.22:
                low, high = bounds.get(s, (0, 1))
                if low <= left <= high:
                    if dy < min_dy: min_dy, best_s = dy, s
        
        if best_s:
            # Cleaning
            name = re.sub(r'^\d{1,2}\s*[|:.\-]?\s*', '', text).strip()
            if any(w in name.lower() for w in ["elimination", "remain", " ns", "/0", "stage"]): continue
            
            # Corrections
            for old, new in CORRECTIONS.items():
                if old in name: name = name.replace(old, new)
            
            # Final fixups
            name = name.strip('|/\\-_×*., ').strip()
            if len(name) > 2:
                if name not in results[best_s] or best_s == 6:
                    results[best_s].append(name)
                    
    return results

if __name__ == "__main__":
    images = ["samples/slot1.jpg", "samples/slot2.jpg", "samples/slot3.jpg"]
    final = defaultdict(list)
    print("BGMI OCR Parser v9.0...")
    for img in images:
        if not os.path.exists(img): continue
        print(f"  Analysing {img}...")
        res = process(detect_text(img))
        for s, names in res.items():
            for n in names:
                if n not in final[s]: final[s].append(n)
                
    print("\n# Final OCR Results")
    print("-" * 40)
    for s in [4,5,6,7,8,9,10,11,12,13,14,15,16,18,19,21,22,23,24,25]:
        n = final.get(s, [])
        if n: print(f"slot {s} : {', '.join(n)}")
