import pytesseract
from crop_slot_image import crop_slot_region
from preprocess import preprocess_image

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

img = crop_slot_region("samples/slot1.jpg")
img = preprocess_image(img)

config = (
    "--oem 3 --psm 6 "
    "-c tessedit_char_whitelist="
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "abcdefghijklmnopqrstuvwxyz"
    "0123456789._- "
)

text = pytesseract.image_to_string(img, config=config)

print("===== CROPPED + PREPROCESSED OCR =====")
print(text)
