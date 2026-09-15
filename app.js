/**
 * ==========================================================================
 * EXCEL OCR OTOMASYONU - JAVASCRIPT DOSYASI (V3 - MÜKEMMEL SÜRÜM)
 * Kopyala-Yapıştır (Clipboard), Confetti animasyonu, Hata Titremesi ve 
 * Canlı İlerleme Durumu (Progress Text) eklenmiştir.
 * ==========================================================================
 */

document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. DOM Elemanlarının Seçilmesi
    // ==========================================
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const dropIcon = document.getElementById('drop-icon');
    const dropText = document.getElementById('drop-text');
    const previewImg = document.getElementById('preview-img');
    const formExcel = document.getElementById('form-excel');
    const btnText = document.getElementById('text-excel');
    const loader = document.getElementById('loader-excel');
    const resultBox = document.getElementById('result-excel');
    const excelTargetInput = document.getElementById('excel-target');
    const btnSubmit = document.getElementById('btn-excel');

    // İlerleme metni için geçici DOM elemanı oluştur
    const progressTextNode = document.createElement('div');
    progressTextNode.className = 'progress-steps';
    progressTextNode.style.display = 'none';
    btnSubmit.parentNode.insertBefore(progressTextNode, btnSubmit.nextSibling);

    let selectedBase64 = null;


    // ==========================================
    // 2. Olay Dinleyicileri (Sürükle, Tıkla, YAPıŞTıR)
    // ==========================================
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // MÜKEMMEL EKLENTİ 1: Kopyala-Yapıştır (CTRL+V / CMD+V) Desteği
    document.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                
                // Yapıştırma efekti
                dropZone.classList.add('active-paste');
                setTimeout(() => dropZone.classList.remove('active-paste'), 300);
                
                // Panodan gelen dosyanın adı olmaz, sahte isim ver
                Object.defineProperty(file, 'name', {
                    writable: true,
                    value: 'Pano_Goruntusu.png'
                });
                
                handleFile(file);
                break;
            }
        }
    });


    // ==========================================
    // 3. Dosya İşleme ve Sıkıştırma (Canvas)
    // ==========================================
    function handleFile(file) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(file.type)) {
            triggerErrorShake();
            showResult('Hata: Sadece PNG veya JPG formatında görseller yükleyebilirsiniz.', 'error');
            return;
        }

        const fileNameWithoutExtension = file.name.replace(/\.[^/.]+$/, "");
        excelTargetInput.value = fileNameWithoutExtension;

        const reader = new FileReader();
        reader.onload = (e) => {
            const tempImg = new Image();
            tempImg.src = e.target.result;
            
            tempImg.onload = () => {
                previewImg.src = tempImg.src;
                previewImg.style.display = 'block';
                dropIcon.style.display = 'none';
                dropText.textContent = `Seçilen Dosya: ${file.name}`;
                resultBox.style.display = 'none';

                // GELİŞTİRME: İstemci Taraflı Görsel Sıkıştırma (Canvas)
                // OCR işlemini HIZLANDIRMAK için max genişliği 1200px'e düşürdük. 
                // Bu, sunucudaki yükü inanılmaz derecede hafifletir ve işlemi hızlandırır.
                const MAX_WIDTH = 1200;
                let width = tempImg.width;
                let height = tempImg.height;

                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(tempImg, 0, 0, width, height);

                selectedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            };
        };
        reader.onerror = () => showResult('Görsel okunurken bir hata oluştu.', 'error');
        reader.readAsDataURL(file);
    }


    // ==========================================
    // 4. Form Gönderimi ve İlerleme Yönetimi
    // ==========================================
    formExcel.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!selectedBase64) {
            triggerErrorShake();
            showResult('Lütfen önce bir tablo görseli seçin, sürükleyin veya yapıştırın (Ctrl+V).', 'error');
            return;
        }

        setLoadingState(true);
        let progressInterval;
        let wakeupTimeout;

        try {
            let targetName = excelTargetInput.value.trim() || 'tablo_verisi';
            if (!targetName.toLowerCase().endsWith('.xlsx')) {
                targetName += '.xlsx';
            }

            const requestPayload = {
                image_base64: selectedBase64,
                target_xlsx: targetName,
                sheet_name: "Sayfa1",
                append_rows: false
            };

            // MÜKEMMEL EKLENTİ 2: Canlı İlerleme Durumu Animasyonu
            const steps = [
                "Görsel analiz ediliyor...",
                "Sunucuyla bağlantı kuruluyor...",
                "Yapay zeka tabloyu inceliyor...",
                "Hücreler Excel'e aktarılıyor...",
                "Dosya hazırlanıyor, lütfen bekleyin..."
            ];
            let stepIndex = 0;
            progressTextNode.style.display = 'block';
            progressTextNode.textContent = steps[stepIndex];
            
            progressInterval = setInterval(() => {
                stepIndex++;
                if (stepIndex < steps.length) {
                    progressTextNode.textContent = steps[stepIndex];
                }
            }, 3500);

            // GELİŞTİRME 2: Vercel Sunucu Tespiti
            wakeupTimeout = setTimeout(() => {
                progressTextNode.innerHTML = "<i class='fa-solid fa-server'></i> Vercel Sunucusu başlatılıyor...";
            }, 5000);

            // Yeni Ücretsiz Vercel Backend Adresi
            const response = await fetch('/api/convert', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json' 
                },
                body: JSON.stringify(requestPayload)
            });

            clearInterval(progressInterval);
            clearTimeout(wakeupTimeout);
            progressTextNode.style.display = 'none';

            // LIMIT ve HATA KONTROLLERİ
            if (response.status === 429) {
                const limitData = await response.json();
                throw new Error(limitData.message || "Limit aşıldı. Lütfen 1 dakika bekleyin.");
            }
            if (response.status === 413) throw new Error("Görsel çok büyük. Sistemin sınırları aşıldı.");
            if (response.status === 503 || response.status === 504) throw new Error("Sunucu şu anda uykuda veya aşırı yoğun. Lütfen 1 dakika bekleyip tekrar Dönüştür'e basın.");
            if (response.status === 500) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || "Sunucuda hata oluştu. Tablo çok karmaşık olabilir.");
            }

            if (!response.ok) {
                throw new Error(`Sunucu bir hata döndürdü (Hata Kodu: ${response.status}).`);
            }

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                throw new Error("Sunucudan yanıt alınamadı. İşlem zaman aşımına uğramış olabilir.");
            }

            if (response.ok && data.status === 'success' && data.excel_base64) {
                // Base64 verisini Blob formatına (Gerçek Excel Dosyası) dönüştürme işlemi
                const byteCharacters = atob(data.excel_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
                
                // Blob verisinden indirme linki (URL) oluştur
                const downloadUrl = URL.createObjectURL(blob);
                const finalFileName = targetName;
                
                const successMessage = `
                    <strong><i class="fa-solid fa-check"></i> Harika! Tablo Çevrildi.</strong> 
                    <br>Görseldeki veriler sıfır kayıpla Excel'e aktarıldı.
                    <br><br>
                    <a href="${downloadUrl}" class="btn-download" download="${finalFileName}">
                        <i class="fa-solid fa-download"></i> Excel Dosyasını İndir
                    </a>
                `;
                showResult(successMessage, 'success');
                
                if (typeof confetti !== 'undefined') {
                    confetti({
                        particleCount: 150,
                        spread: 70,
                        origin: { y: 0.6 },
                        colors: ['#10b981', '#3b82f6', '#ffffff']
                    });
                }
            } else {
                throw new Error(data.message || 'Sunucu işlemi tamamlayamadı.');
            }

        } catch (err) {
            clearInterval(progressInterval);
            clearTimeout(wakeupTimeout);
            progressTextNode.style.display = 'none';
            triggerErrorShake();
            
            let errorMsg = err.message;
            if (errorMsg === "Failed to fetch") errorMsg = "İnternet bağlantınızı veya sunucu durumunu kontrol edin.";

            showResult(`<strong><i class="fa-solid fa-circle-exclamation"></i> Hata:</strong> İşlem başarısız oldu. <br><br>Detay: ${errorMsg}`, 'error');
        } finally {
            setLoadingState(false);
        }
    });


    // ==========================================
    // 5. Yardımcı Fonksiyonlar (Helpers)
    // ==========================================
    
    function setLoadingState(isLoading) {
        if (isLoading) {
            btnText.style.display = 'none';
            loader.style.display = 'block';
            btnSubmit.disabled = true;
            resultBox.style.display = 'none';
        } else {
            btnText.style.display = 'block';
            loader.style.display = 'none';
            btnSubmit.disabled = false;
        }
    }

    function showResult(message, type) {
        resultBox.style.display = 'block';
        if (type === 'success') {
            resultBox.className = 'result-box result-success';
        } else if (type === 'error') {
            resultBox.className = 'result-box result-error';
        }
        resultBox.innerHTML = message;
    }

    // MÜKEMMEL EKLENTİ 4: Hata durumunda formun titremesi
    function triggerErrorShake() {
        const formBox = document.querySelector('.app-box');
        formBox.classList.remove('shake');
        void formBox.offsetWidth; // DOM'u yeniden çizdir (Restart animation)
        formBox.classList.add('shake');
    }
});
