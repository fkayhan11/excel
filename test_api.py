import base64
import requests
import json
import time

# Create a small blank image or use a tiny white pixel for testing
# 1x1 white pixel in PNG base64:
img_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="

payload = {
    "image_base64": img_base64,
    "target_xlsx": "test_output.xlsx",
    "sheet_name": "Sayfa1",
    "append_rows": False
}

print("Testing Render API...")
start_time = time.time()
try:
    response = requests.post(
        "https://fkayhanhub.onrender.com/convert_sync", 
        json=payload,
        headers={"Content-Type": "application/json"}
    )
    duration = time.time() - start_time
    print(f"Request took {duration:.2f} seconds.")
    
    print(f"Status Code: {response.status_code}")
    try:
        data = response.json()
        print(f"Response JSON: {json.dumps(data, indent=2)}")
    except Exception as e:
        print(f"Failed to parse JSON: {e}")
        print(f"Raw Response: {response.text[:200]}")
        
except Exception as e:
    print(f"Request failed: {e}")
