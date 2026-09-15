import requests
import time

img_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="

payload = {
    "image_base64": img_base64,
    "target_xlsx": "test_output.xlsx",
    "sheet_name": "Sayfa1",
    "append_rows": False
}

print("Testing Render API speed...")
start = time.time()
try:
    response = requests.post(
        "https://fkayhanhub.onrender.com/convert_sync", 
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=180
    )
    print(f"Time taken: {time.time() - start:.2f}s")
    print(f"Status: {response.status_code}")
except Exception as e:
    print(f"Failed: {e}")
