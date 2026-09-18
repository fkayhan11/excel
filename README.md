# 📊 Asteria Excel OCR | Yapay Zeka Destekli Akıllı Tablo Dönüştürücü

<div align="center">

![Python](https://img.shields.io/badge/Python-3.11%2B-blue?style=for-the-badge&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.0%2B-black?style=for-the-badge&logo=flask&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Google_Gemini_AI-Flash_Vision-4285F4?style=for-the-badge&logo=google&logoColor=white)
![OpenPyXL](https://img.shields.io/badge/OpenPyXL-Styled_Excel-217346?style=for-the-badge&logo=microsoftexcel&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Serverless-000000?style=for-the-badge&logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/License-All_Rights_Reserved-red?style=for-the-badge)

<p align="center">
  <b>Fatura, makbuz, finansal tablo veya veri ekran görüntülerini saniyeler içinde biçimlendirilmiş Excel (.xlsx) ve CSV dosyalarına dönüştüren yeni nesil web otomasyonu.</b>
</p>

</div>

---

## 🌟 Öne Çıkan Özellikler

- ⚡ **Ultra Yüksek Hız (1.5 - 2.0 Saniye):** `gemini-flash-lite` ve `gemini-flash` modelleriyle optimize edilmiş deterministik görsel analiz motoru.
- 📑 **Çoklu Görsel & Çok Sekmeli Excel (Multi-Sheet):** Tek seferde 1-4 arası görsel yükleyin; sistem tüm görselleri tek bir Excel dosyasında `Sayfa1`, `Sayfa2`, `Sayfa3` sekmeleri olarak birleştirir.
- 🧵 **Paralel AI İşleme (`ThreadPoolExecutor`):** Çoklu sayfalar ardışık bekletilmez, eşzamanlı işlenerek süre 4 kat kısaltılır.
- 🔄 **Akıllı Model Yedekleme Zinciri (Auto-Fallback):** Bir modelin ücretsiz dakikalık kotası dolduğunda sistem kullanıcıya hissettirmeden sıradaki modele (`gemini-flash-lite` ➡️ `gemini-flash` ➡️ `gemini-3.7-flash`) otomatik geçiş yapar.
- ⏱️ **Canlı Dakikalık Sayaç & Güvenlik Kalkanı:** Google AI ücretsiz sınırlarını korumak amacıyla dakikada 4 istek sınırlandırması, canlı slot göstergesi ve otomatik yenilenme sayacı.
- 🌙 **Modern Koyu / Açık Tema (Dark Mode):** `localStorage` kalıcı tercihi, altın sarısı ışıltılı özel Güneş (`☀️`) ve Hilal Ay (`🌙`) vektör simgeleri.
- 📋 **Panoya Hızlı Kopyalama & Türkçe Uyumlu CSV:**
  - Tek tıkla Excel veya Google Sheets'e doğrudan `Ctrl+V` ile yapıştırmak için **TSV Pano Kopyalama**.
  - Türkçe karakterleri bozmayan `UTF-8 BOM` ve `;` noktalı virgül ayrımlı **CSV İndirme**.
- 📐 **Akıllı Hücre & Sütun Biçimlendirme:**
  - Sayısal değerleri otomatik algılar (`SUM`, `AVERAGE` gibi formüller çalışır).
  - Başlık hücrelerini, koyu metinleri ve arka plan renklerini orijinal görseldeki gibi renklendirir.
  - Sütun genişliklerini metin uzunluğuna göre otomatik ayarlar (`Auto-fit Width`).

---

## 🏗️ Mimari ve Teknoloji Yığını

| Alan | Teknoloji | Açıklama |
|---|---|---|
| **Yapay Zeka** | Google Gemini Vision AI | Görseldeki tablo yapısını, hücreleri ve görsel stilleri JSON formatında ayrıştırır |
| **Backend** | Python & Flask | RESTful API, IP tabanlı hız sınırlayıcı (Rate Limiter), Model Fallback |
| **Excel Motoru** | OpenPyXL | Hücre kenarlıkları, dolgu renkleri, fontlar ve çalışma kitabı sayfaları |
| **Frontend** | Vanilla JS, HTML5, Modern CSS | 2 kolonlu masaüstü çalışma alanı, Canvas görsel sıkıştırması |
| **Dağıtım** | Vercel Serverless Functions | Sunucusuz, sıfır maliyetli ve global CDN üzerinde ölçeklenebilir çalışma |

---

## 🚀 Yerel Geliştirme (Local Setup)

### 1. Depoyu Klonlayın
```bash
git clone https://github.com/KULLANICI_ADINIZ/Asteria-Excel.git
cd Asteria-Excel
```

### 2. Sanal Ortam Oluşturun ve Bağımlılıkları Yükleyin
```bash
python3 -m venv .venv
source .venv/bin/activate  # Windows için: .venv\Scripts\activate
pip install -r requirements.txt
```

### 3. API Anahtarınızı Tanımlayın
Proje kök dizininde bir `.env` dosyası oluşturun:
```env
GEMINI_API_KEY=AIzaSy...SizinGoogleGeminiAnahtariniz
```
> **Not:** Google AI Studio üzerinden ücretsiz bir API anahtarı edinebilirsiniz: [aistudio.google.com](https://aistudio.google.com/)

### 4. Lokal Sunucuyu Başlatın
```bash
python3 local_server.py
```
Tarayıcınızda açın: **`http://localhost:5999`**

---

## ☁️ Vercel Canlı Dağıtım (Deployment)

Proje, Vercel Serverless mimarisiyle %100 uyumlu olarak tasarlanmıştır.

1. Depoyu GitHub'a yükleyin.
2. [Vercel Dashboard](https://vercel.com/dashboard) üzerinden **"Add New Project"** diyerek depoyu seçin.
3. **Environment Variables** bölümüne şu anahtarı ekleyin:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** `Google AI API Anahtarınız`
4. **Deploy** butonuna tıklayın. Saniyeler içinde global canlı linkiniz hazır olacaktır!

---

## 🔒 Lisans ve Telif Hakkı (Copyright Notice)

**Telif Hakkı (c) 2026 Furkan. Tüm Hakları Saklıdır.**

Bu proje **özel mülkiyet (proprietary)** lisansına sahiptir:
- Bu kod deposundaki kaynak kodların, kullanıcı arayüzü tasarımlarının veya algoritmaların yazılı izin olmaksızın **kısmen veya tamamen kopyalanması, çalınması, çoğaltılması, dağıtılması veya ticari/ticari olmayan projelerde kullanılması KESİNLİKLE YASAKTIR**.
- Kodların GitHub'da yer alması yalnızca inceleme amaçlıdır; izinsiz kopyalama veya klonlama durumlarında yasal işlem hakkı saklıdır.

Detaylı lisans şartları için [`LICENSE`](./LICENSE) dosyasını inceleyebilirsiniz.
