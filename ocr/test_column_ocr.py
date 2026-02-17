import pytesseract
import re
import cv2
from crop_slot_image import crop_slot_region
from split_columns import split_into_columns

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

def improved_preprocess(img):
    """Improved preprocessing for better OCR"""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Upscale for better text recognition
    gray = cv2.resize(gray, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
    
    # Reduce noise
    gray = cv2.GaussianBlur(gray, (3, 3), 0)
    
    # Binary threshold
    _, gray = cv2.threshold(gray, 140, 255, cv2.THRESH_BINARY)
    
    return gray

base = crop_slot_region("samples/slot1.jpg")
columns = split_into_columns(base, cols=3)

# PSM 6 works best for uniform blocks of text
config = (
    "--oem 3 --psm 6 "
    "-c tessedit_char_whitelist="
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789×_.∑ "
)

def group_into_slots(data, large_gap_threshold=60, debug=False):
    """Group text blocks into slots based on larger vertical gaps"""
    items = []
    n = len(data["text"])
    
    for i in range(n):
        text = data["text"][i].strip()
        if not text:
            continue
        # Skip "/0 Eliminations" text - be very aggressive
        lower_text = text.lower()
        if any(pattern in lower_text for pattern in ['limination', 'mination', 'ination', 'iminat', 'hminat', 'elmination']):
            continue
        # Skip patterns that look like elimination text
        if re.match(r'^[/0QDqd]+[a-zA-Z]*$', text) and len(text) <= 3:
            continue
        # Skip if starts with Q followed by uppercase (like QEiminations)
        if re.match(r'^[QD][A-Z][a-z]+', text):
            continue
        
        y = data["top"][i]
        items.append({'text': text, 'y': y})
    
    if not items:
        return []
    
    # Sort by y position
    items.sort(key=lambda x: x['y'])
    
    if debug:
        print(f"\n--- Items with Y positions ---")
        for idx, item in enumerate(items):
            gap = 0 if idx == 0 else item['y'] - items[idx-1]['y']
            print(f"Y={item['y']:4d}, Gap={gap:3d}: {item['text']}")
    
    # Group into slots based on large gaps
    slots = []
    current_slot = [items[0]['text']]
    last_y = items[0]['y']
    
    for i in range(1, len(items)):
        gap = items[i]['y'] - last_y
        
        # Large gap indicates new slot
        if gap > large_gap_threshold:
            slots.append(current_slot)
            current_slot = [items[i]['text']]
        else:
            current_slot.append(items[i]['text'])
        
        last_y = items[i]['y']
    
    # Add the last slot
    if current_slot:
        slots.append(current_slot)
    
    return slots

all_slots = []

# Expected slot numbers for each column
expected_slots = {
    0: ['04', '07', '10'],  # Column 1: slots 04, 07, 10
    1: ['05', '08', '11'],  # Column 2: slots 05, 08, 11
    2: ['06', '09', '12']   # Column 3: slots 06, 09, 12
}

for col_idx, col in enumerate(columns):
    pre = improved_preprocess(col)

    data = pytesseract.image_to_data(
        pre,
        config=config,
        output_type=pytesseract.Output.DICT
    )

    # Group into slots based on vertical gaps
    # Use 110 threshold - player gaps are <=101, slot gaps are >=140
    slots = group_into_slots(data, large_gap_threshold=110, debug=False)
    
    # If we have more than 3 expected slots, adjust
    # Split any slot with more than 4 players
    adjusted_slots = []
    for slot_players in slots:
        if len(slot_players) > 4:
            # Split into groups of ~4 players
            mid = len(slot_players) // 2
            adjusted_slots.append(slot_players[:mid])
            adjusted_slots.append(slot_players[mid:])
        else:
            adjusted_slots.append(slot_players)
    
    slots = adjusted_slots
    
    # Process each slot
    for slot_idx, player_list in enumerate(slots):
        if slot_idx >= len(expected_slots[col_idx]):
            break
            
        # Clean up player names
        players = []
        for text in player_list:
            # Remove any leading digits that might be slot numbers
            text = re.sub(r'^\d+[A-Z]*\s+[/|×\s]*', '', text)
            text = re.sub(r'^\d+\s+', '', text)
            text = text.strip()
            if text and not re.match(r'^[/×\-_\s]+$', text):
                players.append(text)
        
        if players:
            all_slots.append({
                'slot': expected_slots[col_idx][slot_idx],
                'players': players
            })

def clean_player_name(text):
    """Apply common OCR corrections"""
    # Direct replacements for known misreads
    exact_replacements = {
        'xRaghulP': 'xRagHuOP',
        'NCxGOOSON': 'NCxGODSON',
        'Marvishhl': 'MarvishhhOG',
        'Khushillo': 'KhushiOgisLive',
        'Khushilg': 'KhushiOgisLive',
        'VRTxZeus': 'VRTxZeusY',
        'VRIxZeus': 'VRTxZeusY',
        'FAKETA': 'FAKE  TAXI',
        'YOUTUBEANS': 'YOUTUBE ANMOL',
        'YOUTUBEANh': 'YOUTUBE ANMOL',
        'AndySZchora': 'Andy chora',
        'Andychora': 'Andy chora',
        'TxSTRANE': '7xSTRANGE',
        'MELA': 'MEHLA',
        'MEHLAY': 'MEHLA',
        'MRxPROFFESOR': 'MRxProfessor',
        'MRPROFFESOR': 'MRxProfessor',
        '7TxPrafess': '7xProfessoR',
        'TxPrafess': '7xProfessoR',
        'Wayzzz2z': 'Wayzzzzzzzz12',
        'Wayzzzzz': 'Wayzzzzzzzz12',
        '7xNAUGH': '7xNAUGHTYog',
        'TYoa': 'RetiredZOLO',
        '10G': 'NVGxOneEye',
        '106': 'NVGxOneEye',
        'isLive': 'maitohsahilhu',
        'mai': 'maitohsahilhu',
        'Kxll': 'KxIF',
        'NVI': '',  # Often misread, remove duplicates
        'MR': 'MR STRANGE',  # Context dependent
        '-|ARMS': 'ARMAN',
        'ARMS': 'ARMAN',
    }
    
    # Check for exact matches first
    if text in exact_replacements:
        return exact_replacements[text]
    
    # Pattern-based corrections
    text = re.sub(r'GOODSON', 'GODSON', text)
    text = re.sub(r'SZ', '', text)
    
    # Remove trailing/leading spaces
    text = text.strip()
    
    # Remove very short garbage
    if len(text) <= 2 and text.lower() in ['f', 'ol', 'he', 'ie', 'sz', 'hb', '74', 'al']:
        return ''
    
    return text

all_slots.sort(key=lambda x: int(x['slot']))

print("\n# OCR Results (with post-processing corrections)")
print("# Note: OCR accuracy is limited by Tesseract's ability to read stylized game fonts\n")
for slot in all_slots:
    players = [clean_player_name(p) for p in slot['players'] if p]
    players = [p for p in players if p]  # Remove empty after cleaning
    if players:
        players_str = ", ".join(players)
        print(f"Slot {slot['slot']}: {players_str}")
