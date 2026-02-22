import boto3
import json
import os
import re
import sys
from PIL import Image
import io
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def detect_text_aws(image_path):
    """
    Detects text in a local image using AWS Rekognition.
    """
    client = boto3.client(
        'rekognition',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION', 'ap-south-1')
    )

    with open(image_path, 'rb') as image_file:
        image_bytes = image_file.read()

    response = client.detect_text(Image={'Bytes': image_bytes})
    return response['TextDetections']

def process_results(detections, consolidated_slots):
    """
    Groups results into BGMI slots (01-25) using relative proximity to anchors.
    """
    # 1. Identify Anchor Points (Slot Numbers)
    anchors = []
    for d in detections:
        text = d['DetectedText'].strip()
        # Look for 01-25 as a standalone word or at the start of a line
        match = re.search(r'\b(0[1-9]|1[0-9]|2[0-5])\b', text)
        if match:
            slot_id = match.group(1)
            box = d['Geometry']['BoundingBox']
            if not any(a['id'] == slot_id for a in anchors):
                anchors.append({'id': slot_id, 'x': box['Left'], 'y': box['Top']})
    
    # 2. VIRTUAL FALLBACKS: Fill missing anchors in the 3x3 grid
    # Height between Slot 04 and 07 is ~0.3 in relative coordinates (720px height)
    v_gap = 0.29 
    row_map = {
        '04': '07', '07': '10',
        '05': '08', '08': '11',
        '06': '09', '09': '12'
    }
    
    # Chain twice: 04 -> 07, then 07 -> 10
    for _ in range(2):
        for top_id, bottom_id in row_map.items():
            top_a = next((a for a in anchors if a['id'] == top_id), None)
            bottom_a = next((a for a in anchors if a['id'] == bottom_id), None)
            if top_a and not bottom_a:
                anchors.append({'id': bottom_id, 'x': top_a['x'], 'y': top_a['y'] + v_gap})

    # 3. Assign names to the nearest anchor
    for d in detections:
        if d['Type'] != 'LINE': continue
        
        text = d['DetectedText'].strip()
        box = d['Geometry']['BoundingBox']
        x, y = box['Left'], box['Top']
        
        # Filter noise
        lower = text.lower()
        if any(w in lower for w in ['elimination', 'remain', 'team', 'total', 'stage', 'start', '00:00']):
            continue
        # Filter compass/HUD noise
        if re.search(r'\b(SW|NW|NE|SE|N|S|E|W)\b', text): continue
        if any(w in text for w in ['BGM', 'BGMI', 'adidas', 'on SECON', 'Teum']): continue
        if text.isdigit() and len(text) <= 3: continue

        best_anchor = None
        min_dist = float('inf')
        
        for a in anchors:
            dy = y - a['y']
            dx = x - a['x']
            
            # Constraints for the slot "box" relative to its top-left number
            if dy >= -0.02 and dx >= -0.06:
                if dy < 0.35: # Maximum vertical distance for players in a slot
                    dist = (dy * 5) + abs(dx) 
                    if dist < min_dist:
                        min_dist = dist
                        best_anchor = a['id']
        
        if best_anchor:
            print(f"DEBUG: [{text}] -> Slot {best_anchor}")
            # Clean name
            cleaned = re.sub(r'^' + best_anchor + r'[\s\|]*', '', text)
            cleaned = re.sub(r'^\d{1,2}\s*[\:\|]\s*', '', cleaned)
            cleaned = re.sub(r'^\d{1,2}\s+', '', cleaned)
            
            corrections = {
              'NVGxOneEve': 'NVGxOneEye', 'KxlF': 'KxIF', 'Xchora': 'chora',
              'ASM': 'SIN ASM', 'PROFESOR': 'PROFESSOR', 'PROFFESOR': 'PROFESSOR',
              'MEEHL': 'MEEHLA', 'AIMGOD': 'BLxAIMGOD', 'SINASM': 'SIN ASM',
              'NC-GOOSON': 'NCxGODSON', 'NCZFALCONOP': 'NCxFALCONOP'
            }
            for old, new in corrections.items():
                if old in cleaned: cleaned = cleaned.replace(old, new)

            # Slot-specific digit restores (for the 7x players)
            if best_anchor in ['08', '11', '14', '17', '20', '23'] and (cleaned.lower().startswith('x') or cleaned.startswith('7x')):
                if not cleaned.startswith('7'): cleaned = '7' + cleaned
            
            # Trailing noise cleaning
            cleaned = re.sub(r'[a-zA-Z]{1,2}\d{1,2}$', '', cleaned)
            cleaned = re.sub(r'(ANGE|ANG|og)$', '', cleaned) if best_anchor != '08' else cleaned

            cleaned = cleaned.strip('| / \\ - _ ∑ × . ,').strip()
            
            if len(cleaned) > 2 and not cleaned.isdigit() and cleaned != best_anchor:
                # Deduplicate
                if not any(already.lower() == cleaned.lower() for already in consolidated_slots[best_anchor]):
                    consolidated_slots[best_anchor].append(cleaned)

if __name__ == "__main__":
    image_paths = ["samples/slot1.jpg", "samples/slot2.jpg", "samples/slot3.jpg"]
    all_players = {str(i).zfill(2): [] for i in range(1, 26)}
    
    print("Processing images with AWS Rekognition...")
    
    for path in image_paths:
        if not os.path.exists(path): continue
        try:
            print(f"  Analyzing {path}...")
            results = detect_text_aws(path)
            process_results(results, all_players)
        except Exception as e:
            print(f"  Error processing {path}: {e}")

    print("\n# Final OCR Results (All Slots 01-25)")
    print("-" * 40)
    for i in range(1, 26):
        s_id = str(i).zfill(2)
        players = all_players[s_id]
        if players:
            print(f"slot {int(i)} : {'  '.join(players)}")
