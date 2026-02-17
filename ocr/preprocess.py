import cv2

def preprocess_image(img):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Upscale for small fonts
    gray = cv2.resize(gray, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

    # Blur to reduce JPG noise
    gray = cv2.GaussianBlur(gray, (5,5), 0)

    # Binary threshold
    _, gray = cv2.threshold(gray, 150, 255, cv2.THRESH_BINARY)

    return gray
