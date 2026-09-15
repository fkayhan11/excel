import os
import io
import json
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai
import pandas as pd
from google.api_core.exceptions import ResourceExhausted

app = Flask(__name__)
CORS(app)

# Vercel Environment Variables kısmından çekilecek
api_key = os.environ.get("GEMINI_API_KEY", "")
if api_key:
    genai.configure(api_key=api_key)

@app.route('/api/convert', methods=['POST'])
def convert():
    if not api_key:
        return jsonify({
            "status": "error", 
            "message": "Sistem Hatası: GEMINI_API_KEY bulunamadı. Lütfen Vercel ayarlarından API anahtarınızı ekleyin."
        }), 500

    try:
        data = request.get_json()
        image_base64 = data.get('image_base64', '')
        
        if not image_base64:
            return jsonify({"status": "error", "message": "Görsel verisi alınamadı."}), 400

        # Base64 başlığını temizle (data:image/jpeg;base64, ...)
        if "base64," in image_base64:
            image_base64 = image_base64.split("base64,")[1]
            
        img_data = base64.b64decode(image_base64)
        
        # Yapay Zeka Modelini Hazırla (Ücretsiz ve Çok Hızlı: Gemini 1.5 Flash)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = """
        Analyze this image containing a table. Extract all the tabular data.
        Return ONLY valid JSON format. The JSON should be a list of dictionaries, where each dictionary represents a row and keys are the column headers.
        Example: [{"Column1": "Value1", "Column2": "Value2"}]
        Do not include markdown blocks like ```json or anything else. Just the raw JSON array.
        """
        
        # Gemini'ye Görseli ve Promptu Gönder
        response = model.generate_content([
            {'mime_type': 'image/jpeg', 'data': img_data},
            prompt
        ])
        
        result_text = response.text.strip()
        
        # Olası Markdown (```json) kalıntılarını temizle
        if result_text.startswith("```json"):
            result_text = result_text.replace("```json", "", 1)
        if result_text.startswith("```"):
            result_text = result_text.replace("```", "", 1)
        if result_text.endswith("```"):
            result_text = result_text.rsplit("```", 1)[0]
            
        result_text = result_text.strip()
        
        # JSON'u Python listesine çevir
        try:
            table_data = json.loads(result_text)
            if not isinstance(table_data, list):
                table_data = [table_data]
        except Exception as e:
            return jsonify({
                "status": "error", 
                "message": "Yapay zeka tabloyu okuyamadı veya tabloda veri bulunamadı. Lütfen görselin net olduğundan emin olun."
            }), 400
            
        # Pandas ile Excel'e Dönüştür (Hafızada)
        df = pd.DataFrame(table_data)
        excel_io = io.BytesIO()
        df.to_excel(excel_io, index=False, engine='openpyxl')
        excel_io.seek(0)
        
        # Excel dosyasını Base64 formatına çevir (Vercel Serverless dosya indirmeye izin vermediği için veri olarak döneceğiz)
        encoded_excel = base64.b64encode(excel_io.getvalue()).decode('utf-8')
        
        return jsonify({
            "status": "success",
            "message": "Excel created successfully",
            "excel_base64": encoded_excel
        })

    except ResourceExhausted as e:
        # GEMINI LIMIT HATASI (429)
        return jsonify({
            "status": "limit_error",
            "message": "ÜCRETSİZ LİMİT DOLDU: Dakikada maksimum 15 istek yapabilirsiniz. Lütfen 1 dakika bekleyip tekrar deneyin. (Veya günlük 1500 işlem limitine ulaştınız, yarın sıfırlanacaktır.)"
        }), 429
        
    except Exception as e:
        return jsonify({
            "status": "error", 
            "message": f"Sistemde beklenmeyen bir hata oluştu: {str(e)}"
        }), 500

# Vercel Serverless adaptasyonu
def handler(request, context):
    return app(request, context)
