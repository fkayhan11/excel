import os
import io
import json
import base64
import time
from collections import defaultdict
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from concurrent.futures import ThreadPoolExecutor
import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted

# Excel oluşturma işlemleri için OpenPyXL (Stil ve Renk Desteği)
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

app = Flask(__name__)
CORS(app)

# Kök dizini dinamik olarak tespit et (Vercel ve Lokal uyumlu)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

@app.route('/')
def home():
    """Ana sayfayı (index.html) tarayıcıya sunar."""
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_static_files(filename):
    """CSS, JS, ikon ve görsel dosyalarını sunar."""
    target = os.path.join(BASE_DIR, filename)
    if os.path.exists(target) and os.path.isfile(target):
        return send_from_directory(BASE_DIR, filename)
    return send_from_directory(BASE_DIR, 'index.html')

# Vercel ve Güvenlik için İstek Boyutu Sınırı (5 MB)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024

# Vercel Environment Variables kısmından çekilecek
api_key = os.environ.get("GEMINI_API_KEY", "")
if api_key:
    genai.configure(api_key=api_key)

def parse_cell_value(val):
    """Metin içindeki saf sayıları float/int tipine çevirir, Excel formüllerine uygun hale getirir."""
    if val is None:
        return ""
    if isinstance(val, (int, float)):
        return val
    cleaned = str(val).strip()
    if not cleaned:
        return ""
    
    # 1. Tam sayı kontrolü (örn: "150", "-42")
    if cleaned.isdigit() or (cleaned.startswith('-') and cleaned[1:].isdigit()):
        try:
            return int(cleaned)
        except ValueError:
            pass
    
    # 2. Ondalık sayı kontrolü (örn: "1250.50" veya "45,75")
    # Para birimi veya harf içeriyorsa orijinal metni koru
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

# =========================================================
# GÜVENLİK VE KOTA TAKİBİ (Rate Limiting)
# Google Free Tier: 5 istek / dakika.
# Tek bir IP'nin tüm kotayı tüketmemesi için IP başı sınır: 4 istek / dakika.
# =========================================================
IP_LIMIT = 4
WINDOW_SECONDS = 60
ip_history = defaultdict(list)

def get_client_ip():
    """Kullanıcının gerçek IP adresini tespit eder (Vercel proxy desteği ile)."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "127.0.0.1"

def check_rate_limit(ip, count=1):
    """IP bazlı hız sınırını denetler."""
    now = time.time()
    # 60 saniyeden eski kayıtları sil
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
    """Ön yüzün anlık kota durumunu sorgulaması için endpoint."""
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

AVAILABLE_MODELS = [
    'gemini-flash-lite-latest',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.7-flash',
    'gemini-3.6-flash'
]

def generate_table_json(img_data, prompt):
    """Kullanılabilir modelleri sırayla dener, kota doluluğunda otomatik sonraki modele geçer."""
    last_error = None
    gen_config = genai.GenerationConfig(
        response_mime_type="application/json",
        temperature=0.0
    )
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
            return response.text.strip(), model_name
        except ResourceExhausted as e:
            print(f"[Model Fallback] {model_name} kotası dolu, sonraki modele geçiliyor...")
            last_error = e
            continue
        except Exception as e:
            print(f"[Model Fallback] {model_name} hata verdi ({type(e).__name__}): {e}, sonraki modele geçiliyor...")
            last_error = e
            continue
    if last_error:
        raise last_error
    raise Exception("Yapay zeka modellerine erişilemedi.")

@app.route('/api/convert', methods=['POST'])
@app.route('/convert', methods=['POST'])
def convert():
    if not api_key:
        return jsonify({
            "status": "error", 
            "message": "Sistem Hatası: GEMINI_API_KEY bulunamadı. Lütfen Vercel ayarlarından API anahtarınızı ekleyin."
        }), 500

    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({"status": "error", "message": "Geçersiz istek gövdesi."}), 400

        # Çoklu veya Tekli Görsel Listesini Hazırla
        images_base64 = data.get('images_base64', [])
        if not images_base64 and data.get('image_base64'):
            images_base64 = [data.get('image_base64')]

        if not images_base64:
            return jsonify({"status": "error", "message": "Lütfen en az bir tablo görseli yükleyin."}), 400

        if len(images_base64) > IP_LIMIT:
            return jsonify({
                "status": "error", 
                "message": f"Tek seferde en fazla {IP_LIMIT} sayfa dönüştürebilirsiniz."
            }), 400

        # 1. GÜVENLİK ADIMI: IP Bazlı Rate Limit Kontrolü (Görsel Sayısı Kadar Kota Düşülür)
        client_ip = get_client_ip()
        allowed, quota_data = check_rate_limit(client_ip, count=len(images_base64))
        if not allowed:
            return jsonify({
                "status": "limit_error",
                "error_type": "IP_RATE_LIMIT",
                "retry_after": quota_data,
                "message": f"KULLANIM SINIRI: Dakikada en fazla {IP_LIMIT} işlem yapabilirsiniz. Lütfen {quota_data} saniye bekleyin."
            }), 429
        
        # Tablo ve Stil Analizi Promptu
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

        # OpenPyXL Çalışma Kitabı Oluştur
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
                result_text, used_model = generate_table_json(img_data, prompt)
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
            except Exception as ex:
                print(f"[Process Error] Image {idx}: {ex}")
                return idx, None
            return idx, None

        # Çoklu görselleri eşzamanlı (paralel) işle -> Süre dramatik kısalır
        image_items = list(enumerate(images_base64, start=1))
        if len(image_items) > 1:
            with ThreadPoolExecutor(max_workers=min(4, len(image_items))) as executor:
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

            # Otomatik sütun genişliği
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
                "message": "Görsellerde bir tablo bulunamadı. Lütfen geçerli tablo içeren ekran görüntüleri yükleyin."
            }), 400

        # Hafızada Kaydet ve Base64'e çevir
        excel_io = io.BytesIO()
        wb.save(excel_io)
        excel_io.seek(0)
        encoded_excel = base64.b64encode(excel_io.getvalue()).decode('utf-8')
        
        # Güncel kalan kota
        now = time.time()
        valid_requests = [t for t in ip_history[client_ip] if now - t < WINDOW_SECONDS]
        remaining = max(0, IP_LIMIT - len(valid_requests))
        retry_in = 0
        if valid_requests:
            retry_in = max(1, int(WINDOW_SECONDS - (now - valid_requests[0])))

        return jsonify({
            "status": "success",
            "message": "Excel created successfully",
            "excel_base64": encoded_excel,
            "table_data": all_tables[0],
            "all_tables": all_tables,
            "sheet_count": len(all_tables),
            "remaining_quota": remaining,
            "max_limit": IP_LIMIT,
            "retry_in": retry_in
        })

    except ResourceExhausted as e:
        return jsonify({
            "status": "limit_error",
            "error_type": "GOOGLE_QUOTA_EXHAUSTED",
            "retry_after": 60,
            "message": "ÜCRETSİZ KOTA DOLDU: Google AI dakikalık işlem sınırına ulaşıldı. Lütfen 1 dakika bekleyip tekrar deneyin."
        }), 429
        
    except Exception as e:
        return jsonify({
            "status": "error", 
            "message": f"Sistemde beklenmeyen bir hata oluştu: {str(e)}"
        }), 500
