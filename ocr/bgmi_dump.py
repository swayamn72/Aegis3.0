"""
BGMI Rekognition Word Dumper
Use this to see exactly what AWS Rekognition returns for a screenshot.
"""
import boto3
import sys
import os
from dotenv import load_dotenv

load_dotenv()

def dump(path):
    import sys
    sys.stdout.reconfigure(encoding='utf-8')
    client = boto3.client(
        'rekognition',
        aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        region_name=os.getenv('AWS_REGION', 'ap-south-1')
    )
    
    with open(path, "rb") as f:
        data = f.read()
    resp = client.detect_text(Image={"Bytes": data})
    
    words = [b for b in resp["TextDetections"] if b["Type"] == "WORD"]
    print(f"{'TEXT':<25} | {'LEFT':<8} | {'TOP':<8}")
    print("-" * 50)
    # Sort by Top then Left to read like a page
    for w in sorted(words, key=lambda x: (round(x["Geometry"]["BoundingBox"]["Top"], 2), x["Geometry"]["BoundingBox"]["Left"])):
        bb = w["Geometry"]["BoundingBox"]
        print(f"{w['DetectedText']:<25} | {bb['Left']:<8.4f} | {bb['Top']:<8.4f}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python bgmi_dump.py image.jpg")
    else:
        dump(sys.argv[1])
