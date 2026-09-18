import os
from flask import send_from_directory

# 1. Ortam değişkenlerini (.env) API yüklenmeden ÖNCE sisteme tanıt
if os.path.exists('.env'):
    with open('.env', 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value

# 2. Asıl Vercel arka plan kodumuzu (Flask app) içe aktar
from api.index import app
import google.generativeai as genai

# Vercel'deki gibi Gemini API'yi lokal ortamdaki anahtarla aktifleştir
api_key = os.environ.get("GEMINI_API_KEY", "")
if api_key and api_key != "buraya_google_api_kodunuzu_yapistirin":
    genai.configure(api_key=api_key)

# 3. HTML, CSS ve JS dosyalarımızı tarayıcıya sunmak için Route'lar (Sadece lokal test için)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory(BASE_DIR, filename)

if __name__ == '__main__':
    print("=====================================================")
    if not api_key or api_key == "buraya_google_api_kodunuzu_yapistirin":
        print("UYARI: .env dosyasına henüz gerçek bir GEMINI_API_KEY girmediniz!")
        print("API anahtarı olmadan Excel dönüştürme işlemi hata verecektir.")
    else:
        print("✅ API Anahtarı Algılandı!")
    
    print("🚀 Lokal Sunucu Başlatılıyor: http://localhost:5999")
    print("Tarayıcınızda bu adresi açarak sistemi test edebilirsiniz.")
    print("Sunucuyu durdurmak için: CTRL + C")
    print("=====================================================")
    
    app.run(port=5999, debug=True)
