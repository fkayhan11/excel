# ExcelAs

An automated vision-based table extraction and styling engine that transforms document screenshots, invoices, and receipts into multi-sheet Excel (`.xlsx`) workbooks and UTF-8 CSV exports.

Built with Python (Flask), OpenPyXL, Google Gemini Vision, and modern JavaScript.

---

## Features

- **Multi-Sheet Compilation:** Upload up to 8 images simultaneously. The pipeline processes them in parallel and merges each table into separate worksheets (`Sayfa1`, `Sayfa2`, ...) within a single `.xlsx` workbook.
- **Style & Structure Retention:** Recreates visual hierarchy including header weights, background fills, cell borders, alignment, and auto-computed column widths using OpenPyXL.
- **Smart Type Parsing:** Detects and parses numeric values and currency representations into native integers and floats so Excel formulas (`SUM`, `AVERAGE`) work out of the box.
- **Client-Side Image Pre-Processing:** In-browser Canvas compression resizes high-resolution uploads before transfer to reduce network latency and server memory overhead.
- **Dual Export Options:**
  - Styled binary `.xlsx` download.
  - UTF-8 BOM delimited CSV for seamless Excel and spreadsheet import without character encoding issues.
  - TSV clipboard export for instant `Ctrl+V` pasting directly into Google Sheets or Microsoft Excel.
- **Sliding Window Rate Limiter:** Protects upstream endpoints with an IP-based sliding window rate limiter, real-time quota synchronization, and HTTP 429 cooldown headers.
- **Responsive Workspace:** Clean two-column desktop workspace, intuitive drag-and-drop / clipboard paste (`Ctrl+V`) handlers, and dark/light mode with persistence.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | Python 3.11+, Flask | REST API, multi-threading orchestration, rate limiting |
| **Vision Model** | Google Gemini Vision | Tabular data extraction, boundary analysis, style inference |
| **Spreadsheet Engine** | OpenPyXL | Programmatic workbook construction, cell styling, sheet management |
| **Frontend** | Vanilla JS (ES6+), HTML5, CSS3 | Modular client application, Canvas image optimization, state handling |
| **Deployment** | Vercel Serverless Functions | Serverless deployment with global edge routing |

---

## Architecture & Workflow

```
[User Upload / Paste]
         │
         ▼
[Client-Side Canvas Compression]
         │
         ▼ (Base64 Payload)
[Flask API / Rate Limiter]
         │
         ▼
[Concurrent Vision Extraction (ThreadPoolExecutor)]
         │
         ▼ (JSON Table & Style Metadata)
[OpenPyXL Style Mapper]
         │
         ├──► Styled .xlsx Workbook (Base64 Binary)
         └──► Formatted JSON (Table Data & Dimensions)
         │
         ▼
[Client: Instant Preview, .xlsx Download, UTF-8 CSV, Clipboard TSV]
```

---

## Getting Started

### Prerequisites

- Python 3.11 or higher
- A Google Gemini API Key ([Google AI Studio](https://aistudio.google.com/))

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/fkayhan11/excel.git
   cd excel
   ```

2. **Create and activate a virtual environment:**
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables:**
   Create a `.env` file in the project root:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

5. **Start the local server:**
   ```bash
   python3 local_server.py
   ```
   Open [http://localhost:5999](http://localhost:5999) in your browser.

---

## Deployment (Vercel)

This application is pre-configured for Vercel Serverless Functions via [`vercel.json`](./vercel.json):

1. Connect the repository to your [Vercel Dashboard](https://vercel.com).
2. Set the environment variable in your project settings:
   - **Key:** `GEMINI_API_KEY`
   - **Value:** Your Gemini API Key
3. Deploy. Routing and serverless function packaging are handled automatically.

---

## License

This project is licensed under the [MIT License](./LICENSE).
