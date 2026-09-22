import os
import io
import re
import json
import base64
import time
import warnings
import ipaddress
import threading
from urllib.parse import urlparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

warnings.filterwarnings('ignore', category=FutureWarning)
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted, PermissionDenied, Unauthenticated
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

app = Flask(__name__)
application = app

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Limit total request payload to 16 MB
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

# Thread locks
rate_limit_lock = threading.Lock()
genai_lock = threading.Lock()

# Load environment variables if .env exists safely
env_path = os.path.join(BASE_DIR, '.env')
if os.path.exists(env_path):
    try:
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, val = line.split('=', 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key not in os.environ:
                        os.environ[key] = val
    except Exception:
        pass

raw_keys = os.environ.get("GEMINI_API_KEY", "").strip()
API_KEYS = [k.strip().strip('"').strip("'") for k in raw_keys.split(",") if k.strip() and k.strip() != "buraya_google_api_kodunuzu_yapistirin"]

if API_KEYS:
    try:
        genai.configure(api_key=API_KEYS[0])
    except Exception:
        pass

IP_LIMIT = 8
MAX_SHEETS = 8
WINDOW_SECONDS = 60
ip_history = defaultdict(list)
last_cleanup = 0.0

AVAILABLE_MODELS = [
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite',
    'gemini-flash-latest',
    'gemini-3.6-flash'
]

ALLOWED_STATIC_EXTENSIONS = {
    '.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.ico',
    '.json', '.webmanifest', '.woff', '.woff2', '.ttf'
}

BLOCKED_FILENAMES = {
    'vercel.json', 'package.json', 'requirements.txt', 'local_server.py',
    '.env', '.env.local', '.gitignore', 'license', 'readme.md'
}

ALLOWED_ORIGINS = [o.strip() for o in os.environ.get("ALLOWED_ORIGINS", "").split(",") if o.strip()]


def redact_sensitive_info(text: str) -> str:
    """Masks Google API keys, tokens, and credentials in any string."""
    if not text or not isinstance(text, str):
        return ""
    # Mask Gemini API keys (AIza... and new AQ....)
    text = re.sub(r'AIza[0-9A-Za-z_\-]{20,50}', '[REDACTED_API_KEY]', text)
    text = re.sub(r'AQ\.[0-9A-Za-z_\-]{30,80}', '[REDACTED_API_KEY]', text)
    # Mask query or body parameters containing key/token
    text = re.sub(r'((?:key|token|auth|secret|api_key)=)[^\s&]+', r'\1[REDACTED]', text, flags=re.IGNORECASE)
    for key in API_KEYS:
        if key and len(key) >= 8:
            text = text.replace(key, '[REDACTED_API_KEY]')
    return text


def is_valid_ip(ip: str) -> bool:
    """Validates IPv4 or IPv6 address syntax."""
    if not ip or not isinstance(ip, str) or len(ip) > 45:
        return False
    try:
        ipaddress.ip_address(ip)
        return True
    except ValueError:
        return False


def is_origin_allowed(origin: str | None) -> bool:
    """Validates cross-origin requests using strict hostname verification."""
    if not origin:
        return True
    try:
        parsed = urlparse(origin)
        origin_host = (parsed.hostname or "").lower()
        if not origin_host:
            return False

        # Allow local development origins
        if origin_host in ("localhost", "127.0.0.1"):
            return True

        # Allow same-host origin
        req_host = (request.host.split(":")[0] if request.host else "").lower()
        if req_host and origin_host == req_host:
            return True

        # Check explicit custom allowed origins list
        if ALLOWED_ORIGINS:
            for ao in ALLOWED_ORIGINS:
                ao_parsed = urlparse(ao)
                ao_host = (ao_parsed.hostname or ao).lower()
                if origin_host == ao_host or origin.lower().rstrip('/') == ao.lower().rstrip('/'):
                    return True
        return False
    except Exception:
        return False


@app.before_request
def validate_request():
    """Security check on incoming requests."""
    # Preflight OPTIONS request handling
    if request.method == 'OPTIONS' and request.path.startswith('/api/'):
        origin = request.headers.get('Origin')
        if origin and not is_origin_allowed(origin):
            return jsonify({"status": "error", "message": "Cross-origin forbidden."}), 403
        resp = app.make_default_options_response()
        if origin and is_origin_allowed(origin):
            resp.headers['Access-Control-Allow-Origin'] = origin
            resp.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            resp.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept'
            resp.headers['Access-Control-Max-Age'] = '86400'
        return resp

    # Validate cross-origin API calls
    if request.path.startswith('/api/'):
        origin = request.headers.get('Origin')
        if origin and not is_origin_allowed(origin):
            return jsonify({
                "status": "error",
                "message": "Yetkisiz etki alanı isteği (Cross-origin forbidden)."
            }), 403


@app.after_request
def apply_security_headers(response):
    """Applies OWASP recommended security headers to all HTTP responses."""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=(), payment=()'
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; "
        "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; "
        "img-src 'self' data: blob:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self';"
    )

    origin = request.headers.get('Origin')
    if origin and is_origin_allowed(origin):
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Accept'

    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
    return response


@app.route('/')
def home():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/<path:filename>')
def serve_static(filename):
    clean_path = os.path.normpath(filename).replace('\\', '/')
    if clean_path.startswith(('.', '/')) or '/.' in clean_path or '..' in clean_path:
        return ("Not Found", 404)

    base_name = os.path.basename(clean_path).lower()
    if base_name in BLOCKED_FILENAMES or base_name.startswith('.'):
        return ("Not Found", 404)

    _, ext = os.path.splitext(clean_path)
    if ext.lower() not in ALLOWED_STATIC_EXTENSIONS:
        return ("Not Found", 404)

    # Only allow manifest.json among json files
    if ext.lower() == '.json' and base_name != 'manifest.json':
        return ("Not Found", 404)

    target = os.path.realpath(os.path.join(BASE_DIR, clean_path))
    real_base = os.path.realpath(BASE_DIR)
    if not target.startswith(real_base + os.sep):
        return ("Not Found", 404)

    if os.path.exists(target) and os.path.isfile(target):
        return send_from_directory(BASE_DIR, clean_path)
    return ("Not Found", 404)


def parse_cell_value(val):
    """
    Intelligently parses cell text into numbers (int/float) or cleaned strings.
    Correctly handles:
    - Turkish / European accounting formats (e.g. 342.000 -> 342000, 28.500,50 -> 28500.5)
    - US / International formats (e.g. 1,270,000 -> 1270000, 28,500.50 -> 28500.5)
    - Floating point decimals (e.g. 12,5 -> 12.5, 0.05 -> 0.05)
    - Signed numbers (+85.000 -> 85000, -10.000 -> -10000)
    - Non-numeric strings (e.g. '623.550 TL', '%121', 'Laptop Pro 15')
    """
    if val is None:
        return ""
    if isinstance(val, (int, float)):
        return val

    cleaned = str(val).strip()
    if not cleaned:
        return ""

    sign = ""
    work = cleaned
    if work.startswith(('-', '+')):
        sign = work[0]
        work = work[1:].strip()

    if work.isdigit():
        try:
            return int(sign + work)
        except ValueError:
            pass

    normalized = work.replace(" ", "")

    # Both dot and comma present (e.g. 28.500,50 or 28,500.50)
    if "." in normalized and "," in normalized:
        last_dot = normalized.rfind(".")
        last_comma = normalized.rfind(",")
        if last_dot < last_comma:
            cand = normalized.replace(".", "").replace(",", ".")
        else:
            cand = normalized.replace(",", "")
        try:
            val_float = float(sign + cand)
            return int(val_float) if val_float.is_integer() else val_float
        except ValueError:
            pass

    # Multiple dots (e.g. 1.270.000) -> Turkish thousands separators
    elif normalized.count(".") > 1:
        parts = normalized.split(".")
        if parts[0].isdigit() and all(len(p) == 3 and p.isdigit() for p in parts[1:]):
            try:
                return int(sign + "".join(parts))
            except ValueError:
                pass

    # Multiple commas (e.g. 1,270,000) -> US thousands separators
    elif normalized.count(",") > 1:
        parts = normalized.split(",")
        if parts[0].isdigit() and all(len(p) == 3 and p.isdigit() for p in parts[1:]):
            try:
                return int(sign + "".join(parts))
            except ValueError:
                pass

    # Single comma (e.g. 12,5 or 12,50) -> Turkish decimal separator
    elif "," in normalized and "." not in normalized:
        parts = normalized.split(",")
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            try:
                val_float = float(sign + normalized.replace(",", "."))
                return int(val_float) if val_float.is_integer() else val_float
            except ValueError:
                pass

    # Single dot (e.g. 342.000 or 12.5 or 0.05)
    elif "." in normalized and "," not in normalized:
        parts = normalized.split(".")
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            # In Turkish accounting data, a 3-digit group after dot on a non-zero whole number is a thousands separator!
            if len(parts[1]) == 3 and parts[0] != "0" and len(parts[0]) <= 3:
                try:
                    return int(sign + parts[0] + parts[1])
                except ValueError:
                    pass
            try:
                val_float = float(sign + normalized)
                return int(val_float) if val_float.is_integer() else val_float
            except ValueError:
                pass

    return cleaned


def sanitize_cell_for_excel(val):
    """
    Prevents CSV / Excel Formula Injection (OWASP Formula Injection).
    Neutralizes formula execution characters (=, +, -, @, tab, cr, |) by prepending
    a single quote (') unless the value is a valid numeric value.
    """
    if val is None:
        return ""
    if isinstance(val, (int, float, bool)):
        return val

    s = str(val).strip()
    if not s:
        return ""

    if s[0] in ('=', '+', '-', '@', '\t', '\r', '|'):
        parsed = parse_cell_value(s)
        if isinstance(parsed, (int, float)):
            return parsed
        # Neutralize executable formula injection
        return "'" + s

    return parse_cell_value(s)


def detect_image_mime(data: bytes) -> str | None:
    """Detects MIME type by inspecting image magic bytes."""
    if not data or len(data) < 12:
        return None
    if data.startswith(b'\xff\xd8\xff'):
        return 'image/jpeg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'image/png'
    if data.startswith(b'RIFF') and data[8:12] == b'WEBP':
        return 'image/webp'
    return None


def get_client_ip() -> str:
    """
    Safely resolves client IP address with priority for trusted reverse proxy headers
    and validates IP address format to prevent spoofing and memory injection.
    """
    # 1. Trusted Vercel header
    vercel_ip = request.headers.get("x-vercel-forwarded-for")
    if vercel_ip:
        cand = vercel_ip.split(",")[0].strip()
        if is_valid_ip(cand):
            return cand

    # 2. Trusted Cloudflare header
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip and is_valid_ip(cf_ip.strip()):
        return cf_ip.strip()

    # 3. Direct socket address
    if request.remote_addr and is_valid_ip(request.remote_addr):
        return request.remote_addr

    # 4. Standard X-Forwarded-For fallback (strictly validated)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        ips = [ip.strip() for ip in forwarded.split(",") if ip.strip()]
        if ips and is_valid_ip(ips[0]):
            return ips[0]

    return "127.0.0.1"


def prune_ip_history(now: float):
    """Cleans up inactive IPs to prevent memory exhaustion DoS."""
    global last_cleanup
    if now - last_cleanup < 30:
        return
    last_cleanup = now
    cutoff = now - (WINDOW_SECONDS * 2)
    expired_ips = [ip for ip, timestamps in ip_history.items() if not timestamps or timestamps[-1] < cutoff]
    for ip in expired_ips:
        del ip_history[ip]


def check_rate_limit(ip: str, count: int = 1):
    """Thread-safe sliding-window rate limit checker."""
    with rate_limit_lock:
        now = time.time()
        prune_ip_history(now)
        valid_requests = [t for t in ip_history[ip] if now - t < WINDOW_SECONDS]
        ip_history[ip] = valid_requests

        if len(valid_requests) + count > IP_LIMIT:
            oldest = valid_requests[0] if valid_requests else now
            retry_in = max(1, int(WINDOW_SECONDS - (now - oldest)))
            return False, retry_in

        for _ in range(count):
            ip_history[ip].append(now)
        remaining = max(0, IP_LIMIT - len(ip_history[ip]))
        return True, remaining


@app.route('/api/quota', methods=['GET'])
@app.route('/quota', methods=['GET'])
def quota_status():
    """Returns the current client rate limit quota."""
    ip = get_client_ip()
    with rate_limit_lock:
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


def generate_table_json(img_data: bytes, mime_type: str, prompt: str):
    """Calls Gemini API with automatic model and key rotation."""
    last_error = None
    gen_config = genai.GenerationConfig(
        response_mime_type="application/json",
        temperature=0.0
    )

    for key in API_KEYS:
        with genai_lock:
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
                        {'mime_type': mime_type, 'data': img_data},
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
    raise Exception("Görsel çözümleme servisine bağlanılamadı.")


def normalize_raw_table(raw_table):
    """Normalizes various JSON formats from LLM into uniform table cell structure."""
    if not isinstance(raw_table, list):
        return None
    normalized_rows = []
    for row in raw_table:
        if isinstance(row, list):
            norm_cells = []
            for cell in row:
                if isinstance(cell, dict):
                    norm_cells.append({
                        "value": str(cell.get("value", "")) if cell.get("value") is not None else "",
                        "bold": bool(cell.get("bold", False)),
                        "bg_color": str(cell.get("bg_color", "#FFFFFF"))
                    })
                elif isinstance(cell, (str, int, float, bool)):
                    norm_cells.append({
                        "value": str(cell),
                        "bold": False,
                        "bg_color": "#FFFFFF"
                    })
                else:
                    norm_cells.append({
                        "value": "",
                        "bold": False,
                        "bg_color": "#FFFFFF"
                    })
            if norm_cells:
                normalized_rows.append(norm_cells)
        elif isinstance(row, dict):
            # Dict row where keys are column names
            norm_cells = []
            for k, v in row.items():
                norm_cells.append({
                    "value": str(v) if v is not None else "",
                    "bold": False,
                    "bg_color": "#FFFFFF"
                })
            if norm_cells:
                normalized_rows.append(norm_cells)
    return normalized_rows if normalized_rows else None


@app.route('/api/convert', methods=['POST'])
@app.route('/convert', methods=['POST'])
def convert():
    if not API_KEYS:
        return jsonify({
            "status": "error",
            "message": "Sistem API yapılandırması eksik. Lütfen GEMINI_API_KEY anahtarını kontrol edin."
        }), 500

    try:
        data = request.get_json(silent=True)
        if not data or not isinstance(data, dict):
            return jsonify({"status": "error", "message": "Geçersiz istek gövdesi."}), 400

        images_base64 = data.get('images_base64', [])
        if not images_base64 and data.get('image_base64'):
            images_base64 = [data.get('image_base64')]

        if not images_base64 or not isinstance(images_base64, list):
            return jsonify({"status": "error", "message": "Lütfen en az bir tablo görseli yükleyin."}), 400

        if len(images_base64) > MAX_SHEETS:
            return jsonify({
                "status": "error",
                "message": f"Tek seferde en fazla {MAX_SHEETS} sayfa dönüştürülebilir."
            }), 400

        client_ip = get_client_ip()
        cost = len(images_base64)
        allowed, quota_data = check_rate_limit(client_ip, count=cost)
        if not allowed:
            return jsonify({
                "status": "limit_error",
                "error_type": "IP_RATE_LIMIT",
                "retry_after": quota_data,
                "message": f"Dakikalık işlem limitine ulaşıldı. Lütfen {quota_data} saniye sonra tekrar deneyin."
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
            if not isinstance(img_b64_raw, str):
                return idx, None, "INVALID_INPUT"

            if "base64," in img_b64_raw:
                img_b64_clean = img_b64_raw.split("base64,")[1]
            else:
                img_b64_clean = img_b64_raw

            # Guard against oversized single images (max 7MB base64)
            if len(img_b64_clean) > 7 * 1024 * 1024:
                return idx, None, "IMAGE_TOO_LARGE"

            try:
                img_data = base64.b64decode(img_b64_clean, validate=True)
            except Exception:
                return idx, None, "DECODE_ERROR"

            # Verify magic bytes to block non-image payloads
            mime_type = detect_image_mime(img_data)
            if not mime_type:
                return idx, None, "INVALID_MIME"

            try:
                result_text, _ = generate_table_json(img_data, mime_type, prompt)
                if result_text.startswith("```json"):
                    result_text = result_text.replace("```json", "", 1)
                if result_text.startswith("```"):
                    result_text = result_text.replace("```", "", 1)
                if result_text.endswith("```"):
                    result_text = result_text.rsplit("```", 1)[0]
                result_text = result_text.strip()

                try:
                    parsed_data = json.loads(result_text)
                except Exception:
                    start_brace = result_text.find('{')
                    end_brace = result_text.rfind('}')
                    if start_brace != -1 and end_brace != -1 and end_brace > start_brace:
                        parsed_data = json.loads(result_text[start_brace:end_brace+1])
                    else:
                        raise

                if "error" in parsed_data and parsed_data["error"] == "NO_TABLE_FOUND":
                    return idx, None, "NO_TABLE_FOUND"
                if "table" in parsed_data:
                    normalized = normalize_raw_table(parsed_data["table"])
                    if normalized:
                        return idx, normalized, None
            except ResourceExhausted:
                return idx, None, "QUOTA_EXHAUSTED"
            except Exception:
                return idx, None, "PROCESSING_ERROR"
            return idx, None, "UNKNOWN_ERROR"

        image_items = list(enumerate(images_base64, start=1))
        if len(image_items) > 1:
            with ThreadPoolExecutor(max_workers=min(8, len(image_items))) as executor:
                extracted_results = list(executor.map(process_image_item, image_items))
        else:
            extracted_results = [process_image_item(image_items[0])]

        extracted_results.sort(key=lambda x: x[0])

        # Check if any worker encountered quota exhaustion
        if any(res[2] == "QUOTA_EXHAUSTED" for res in extracted_results):
            return jsonify({
                "status": "limit_error",
                "error_type": "GOOGLE_QUOTA_EXHAUSTED",
                "retry_after": 60,
                "message": "Model dakikalık kota sınırına ulaşıldı. Lütfen bir dakika bekleyip tekrar deneyin."
            }), 429

        for idx, table_rows, err_code in extracted_results:
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
                    raw_val = cell_data.get("value", "") if isinstance(cell_data, dict) else str(cell_data)

                    # Defend against CSV/Excel Formula Injection
                    safe_val = sanitize_cell_for_excel(raw_val)
                    cell.value = safe_val
                    cell.border = thin_border
                    is_bold = (cell_data.get("bold") is True if isinstance(cell_data, dict) else False) or is_header
                    cell.font = Font(name="Calibri", size=11, bold=is_bold)

                    if is_header:
                        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
                    elif isinstance(safe_val, (int, float)):
                        cell.alignment = Alignment(horizontal="right", vertical="center")
                    else:
                        cell.alignment = Alignment(horizontal="left", vertical="center")

                    bg_color = cell_data.get("bg_color", "#FFFFFF") if isinstance(cell_data, dict) else "#FFFFFF"
                    if isinstance(bg_color, str) and re.match(r'^#[0-9a-fA-F]{6}$', bg_color):
                        hex_color = bg_color.replace("#", "").upper()
                        if hex_color != "FFFFFF":
                            cell.fill = PatternFill(start_color=hex_color, end_color=hex_color, fill_type="solid")
                    elif is_header:
                        cell.fill = PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid")

            for col in ws.columns:
                if not col:
                    continue
                max_len = 0
                for cell in col:
                    val_str = str(cell.value or "")
                    lines = val_str.split("\n")
                    for line in lines:
                        if len(line) > max_len:
                            max_len = len(line)
                col_letter = get_column_letter(col[0].column)
                ws.column_dimensions[col_letter].width = max(min(max_len + 4, 60), 12)

        if not all_tables:
            return jsonify({
                "status": "error",
                "message": "Görsellerde yapılandırılmış bir tablo tespit edilemedi. Lütfen net bir tablo görseli yükleyin."
            }), 400

        excel_io = io.BytesIO()
        wb.save(excel_io)
        excel_io.seek(0)
        encoded_excel = base64.b64encode(excel_io.getvalue()).decode('utf-8')

        with rate_limit_lock:
            now = time.time()
            valid_requests = [t for t in ip_history[client_ip] if now - t < WINDOW_SECONDS]
            remaining = max(0, IP_LIMIT - len(valid_requests))
            retry_in = 0
            if valid_requests:
                retry_in = max(1, int(WINDOW_SECONDS - (now - valid_requests[0])))

        return jsonify({
            "status": "success",
            "message": "Excel çalışma kitabı başarıyla oluşturuldu.",
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
            "message": "Model dakikalık kota sınırına ulaşıldı. Lütfen bir dakika bekleyip tekrar deneyin."
        }), 429

    except Exception as e:
        safe_err = redact_sensitive_info(str(e))
        # Never leak API key, stack traces, or internal server tokens
        if any(kw in safe_err.lower() for kw in ["api key", "unauthenticated", "permissiondenied", "403"]):
            return jsonify({
                "status": "error",
                "message": "Servis doğrulama hatası oluştu. Lütfen sistem yöneticinizle iletişime geçin."
            }), 500
        return jsonify({
            "status": "error",
            "message": "Görseller işlenirken bir sunucu hatası oluştu. Lütfen geçerli bir görsel yükleyin."
        }), 500
