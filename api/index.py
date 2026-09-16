import os
import io
import json
import base64
import time
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted, PermissionDenied, Unauthenticated
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

app = Flask(__name__)
CORS(app)
application = app

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024

# Load environment variables if .env exists
env_path = os.path.join(BASE_DIR, '.env')
if os.path.exists(env_path):
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    if key.strip() not in os.environ:
                        os.environ[key.strip()] = val.strip()
    except Exception:
        pass

raw_keys = os.environ.get("GEMINI_API_KEY", "").strip()
API_KEYS = [k.strip() for k in raw_keys.split(",") if k.strip() and k.strip() != "buraya_google_api_kodunuzu_yapistirin"]

if API_KEYS:
    try:
        genai.configure(api_key=API_KEYS[0])
    except Exception:
        pass

IP_LIMIT = 8
MAX_SHEETS = 8
WINDOW_SECONDS = 60
ip_history = defaultdict(list)

AVAILABLE_MODELS = [
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.6-flash',
    'gemini-3.7-flash'
]


@app.route('/')
def home():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/<path:filename>')
def serve_static(filename):
    target = os.path.join(BASE_DIR, filename)
    if os.path.exists(target) and os.path.isfile(target):
        return send_from_directory(BASE_DIR, filename)
    return send_from_directory(BASE_DIR, 'index.html')


def parse_cell_value(val):
    if val is None:
        return ""
    if isinstance(val, (int, float)):
        return val

    cleaned = str(val).strip()
    if not cleaned:
        return ""

    if cleaned.isdigit() or (cleaned.startswith('-') and cleaned[1:].isdigit()):
        try:
            return int(cleaned)
        except ValueError:
            pass

    normalized = cleaned.replace(" ", "")
    if "," in normalized and "." not in normalized:
        parts = normalized.split(",")
        if len(parts) == 2 and (parts[0].isdigit() or (parts[0].startswith('-') and parts[0][1:].isdigit())) and parts[1].isdigit():
            try:
                return float(normalized.replace(",", "."))
            except ValueError:
                pass
    elif "." in normalized and "," not in normalized:
        parts = normalized.split(".")
        if len(parts) == 2 and (parts[0].isdigit() or (parts[0].startswith('-') and parts[0][1:].isdigit())) and parts[1].isdigit():
            try:
                return float(normalized)
            except ValueError:
                pass

    return cleaned


def get_client_ip():
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "127.0.0.1"


def check_rate_limit(ip, count=1):
    now = time.time()
    valid_requests = [t for t in ip_history[ip] if now - t < WINDOW_SECONDS]
    ip_history[ip] = valid_requests

    if len(valid_requests) + count > IP_LIMIT:
        oldest = valid_requests[0] if valid_requests else now
        retry_in = max(1, int(WINDOW_SECONDS - (now - oldest)))
        return False, retry_in

    for _ in range(count):
        ip_history[ip].append(now)
    remaining = IP_LIMIT - len(ip_history[ip])
    return True, remaining


@app.route('/api/quota', methods=['GET'])
@app.route('/quota', methods=['GET'])
def quota_status():
    ip = get_client_ip()
    now = time.time()
    valid_requests = [t for t in ip_history[ip] if now - t < WINDOW_SECONDS]
    remaining = max(0, IP_LIMIT - len(valid_requests))
    retry_in = 0
    if valid_requests:
        retry_in = max(1, int(WINDOW_SECONDS - (now - valid_requests[0])))
    return jsonify({
        "status": "success",
        "remaining": remaining,
        "max_limit": IP_LIMIT,
        "retry_in": retry_in
    })


def generate_table_json(img_data, prompt):
    last_error = None
    gen_config = genai.GenerationConfig(
        response_mime_type="application/json",
        temperature=0.0
    )

    for key in API_KEYS:
        try:
            genai.configure(api_key=key)
        except Exception as e:
            last_error = e
            continue

        for model_name in AVAILABLE_MODELS:
            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(
                    [
                        {'mime_type': 'image/jpeg', 'data': img_data},
                        prompt
                    ],
                    generation_config=gen_config
                )
                if response and response.text:
                    return response.text.strip(), model_name
            except ResourceExhausted as e:
                last_error = e
                continue
            except (PermissionDenied, Unauthenticated) as e:
                last_error = e
                break
            except Exception as e:
                err_msg = str(e).lower()
                if any(kw in err_msg for kw in ["403", "leaked", "permission", "api key not valid"]):
                    last_error = e
                    break
                last_error = e
                continue

    if last_error:
        raise last_error
    raise Exception("Unable to connect to vision extraction model.")


@app.route('/api/convert', methods=['POST'])
@app.route('/convert', methods=['POST'])
def convert():
    if not API_KEYS:
        return jsonify({
            "status": "error",
            "message": "API key configuration missing. Please check your GEMINI_API_KEY environment variable."
        }), 500

    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"status": "error", "message": "Invalid request payload."}), 400

        images_base64 = data.get('images_base64', [])
        if not images_base64 and data.get('image_base64'):
            images_base64 = [data.get('image_base64')]

        if not images_base64:
            return jsonify({"status": "error", "message": "Please upload at least one image containing a table."}), 400

        if len(images_base64) > MAX_SHEETS:
            return jsonify({
                "status": "error",
                "message": f"Maximum allowed pages per request is {MAX_SHEETS}."
            }), 400

        client_ip = get_client_ip()
        allowed, quota_data = check_rate_limit(client_ip, count=1)
        if not allowed:
            return jsonify({
                "status": "limit_error",
                "error_type": "IP_RATE_LIMIT",
                "retry_after": quota_data,
                "message": f"Rate limit reached. Maximum {IP_LIMIT} requests per minute. Please retry in {quota_data} seconds."
            }), 429

        prompt = """
        Analyze this image.
        1. If there is NO table in the image (e.g. it's a picture of a cat, nature, or unrelated graphic), return EXACTLY this JSON:
        {"error": "NO_TABLE_FOUND"}
        
        2. If there IS a table, extract all tabular data AND its visual styling (background color and bold text).
        Return ONLY valid JSON in this exact structure:
        {
          "table": [
            [
              {"value": "Header1", "bg_color": "#HEXCODE", "bold": true},
              {"value": "Header2", "bg_color": "#HEXCODE", "bold": true}
            ],
            [
              {"value": "Data1", "bg_color": "#HEXCODE", "bold": false},
              {"value": "Data2", "bg_color": "#HEXCODE", "bold": false}
            ]
          ]
        }
        Rules for table:
        - bg_color MUST be a valid 6-character hex code starting with # (e.g. #FFFFFF for white). Estimate the closest color if exact is hard.
        - bold is boolean (true or false).
        - Do not include markdown blocks like ```json.
        """

        wb = Workbook()
        ws_first = wb.active
        ws_first.title = "Sayfa1"
        ws_first.views.sheetView[0].showGridLines = True

        all_tables = []
        thin_border = Border(
            left=Side(style='thin', color='D1D5DB'),
            right=Side(style='thin', color='D1D5DB'),
            top=Side(style='thin', color='D1D5DB'),
            bottom=Side(style='thin', color='D1D5DB')
        )

        def process_image_item(item):
            idx, img_b64_raw = item
            if "base64," in img_b64_raw:
                img_b64_clean = img_b64_raw.split("base64,")[1]
            else:
                img_b64_clean = img_b64_raw

            try:
                img_data = base64.b64decode(img_b64_clean)
            except Exception:
                return idx, None

            try:
                result_text, _ = generate_table_json(img_data, prompt)
                if result_text.startswith("```json"):
                    result_text = result_text.replace("```json", "", 1)
                if result_text.startswith("```"):
                    result_text = result_text.replace("```", "", 1)
                if result_text.endswith("```"):
                    result_text = result_text.rsplit("```", 1)[0]
                result_text = result_text.strip()

                parsed_data = json.loads(result_text)
                if "error" in parsed_data and parsed_data["error"] == "NO_TABLE_FOUND":
                    return idx, None
                if "table" in parsed_data:
                    return idx, parsed_data["table"]
            except Exception:
                return idx, None
            return idx, None

        image_items = list(enumerate(images_base64, start=1))
        if len(image_items) > 1:
            with ThreadPoolExecutor(max_workers=min(8, len(image_items))) as executor:
                extracted_results = list(executor.map(process_image_item, image_items))
        else:
            extracted_results = [process_image_item(image_items[0])]

        extracted_results.sort(key=lambda x: x[0])

        for idx, table_rows in extracted_results:
            if not table_rows:
                continue

            all_tables.append(table_rows)
            sheet_index = len(all_tables)
            if sheet_index == 1:
                ws = ws_first
                ws.title = "Sayfa1"
            else:
                ws = wb.create_sheet(title=f"Sayfa{sheet_index}")
                ws.views.sheetView[0].showGridLines = True

            for row_idx, row_data in enumerate(table_rows, start=1):
                is_header = (row_idx == 1)
                for col_idx, cell_data in enumerate(row_data, start=1):
                    cell = ws.cell(row=row_idx, column=col_idx)
                    raw_val = cell_data.get("value", "")
                    parsed_val = parse_cell_value(raw_val)
                    cell.value = parsed_val
                    cell.border = thin_border
                    is_bold = cell_data.get("bold") is True or is_header
                    cell.font = Font(name="Calibri", size=11, bold=is_bold)

                    if is_header:
                        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
                    elif isinstance(parsed_val, (int, float)):
                        cell.alignment = Alignment(horizontal="right", vertical="center")
                    else:
                        cell.alignment = Alignment(horizontal="left", vertical="center")

                    bg_color = cell_data.get("bg_color", "#FFFFFF")
                    if bg_color and bg_color.startswith("#"):
                        hex_color = bg_color.replace("#", "").upper()
                        if len(hex_color) == 6 and hex_color != "FFFFFF":
                            cell.fill = PatternFill(start_color=hex_color, end_color=hex_color, fill_type="solid")
                    elif is_header:
                        cell.fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

            for col in ws.columns:
                max_len = 0
                for cell in col:
                    val_str = str(cell.value or "")
                    if len(val_str) > max_len:
                        max_len = len(val_str)
                col_letter = get_column_letter(col[0].column)
                ws.column_dimensions[col_letter].width = max(min(max_len + 4, 60), 12)

        if not all_tables:
            return jsonify({
                "status": "error",
                "message": "No structured table could be identified in the uploaded images."
            }), 400

        excel_io = io.BytesIO()
        wb.save(excel_io)
        excel_io.seek(0)
        encoded_excel = base64.b64encode(excel_io.getvalue()).decode('utf-8')

        now = time.time()
        valid_requests = [t for t in ip_history[client_ip] if now - t < WINDOW_SECONDS]
        remaining = max(0, IP_LIMIT - len(valid_requests))
        retry_in = 0
        if valid_requests:
            retry_in = max(1, int(WINDOW_SECONDS - (now - valid_requests[0])))

        return jsonify({
            "status": "success",
            "message": "Workbook created successfully",
            "excel_base64": encoded_excel,
            "table_data": all_tables[0],
            "all_tables": all_tables,
            "sheet_count": len(all_tables),
            "remaining_quota": remaining,
            "max_limit": IP_LIMIT,
            "retry_in": retry_in
        })

    except ResourceExhausted:
        return jsonify({
            "status": "limit_error",
            "error_type": "GOOGLE_QUOTA_EXHAUSTED",
            "retry_after": 60,
            "message": "Model quota limit reached. Please wait a minute before retrying."
        }), 429

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"An unexpected error occurred: {str(e)}"
        }), 500
