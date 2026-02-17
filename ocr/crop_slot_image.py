import cv2

def crop_slot_region(path):
    img = cv2.imread(path)
    h, w = img.shape[:2]

    # Crop ratios (based on BGMI layout)
    x1 = 0
    x2 = int(w * 0.65)

    y1 = int(h * 0.15)
    y2 = int(h * 0.95)

    cropped = img[y1:y2, x1:x2]
    return cropped
