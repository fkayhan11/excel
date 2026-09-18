/**
 * ==========================================================================
 * EXCEL OCR OTOMASYONU - JAVASCRIPT DOSYASI (V4 - GÜVENLİK VE KOTA SÜRÜMÜ)
 * - Kopyala-Yapıştır (Clipboard)
 * - İstemci Taraflı Yüksek Güvenlikli Görsel Sıkıştırma (Canvas)
 * - Canlı Kullanım Sayacı (Quota Badge)
 * - Kullanım Limiti Uyarı Modalı (Popup) ve Canlı Geri Sayım
 * - Anti-Spam Bekleme Süresi (Cooldown)
 * - Confetti Animasyonu ve Hata Titremesi
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
    const btnClearImage = document.getElementById('btn-clear-image');

    // Sayaç ve Modal Elemanları
    const quotaBadge = document.getElementById('quota-badge');
    const quotaCountEl = document.getElementById('quota-count');
    const quotaMaxEl = document.getElementById('quota-max');
    const quotaBadgeSeconds = document.getElementById('quota-badge-seconds');
    const quotaCard = document.getElementById('quota-card');
    const quotaTimerText = document.getElementById('quota-timer-text');
    const trackerRemainingText = document.getElementById('tracker-remaining-text');
    const quotaProgressBar = document.getElementById('quota-progress-bar');
    const quotaFooterDesc = document.getElementById('quota-footer-desc');
    const quotaDots = document.querySelectorAll('.quota-dot');
    const limitModal = document.getElementById('limit-modal');
    const modalDescEl = document.getElementById('modal-desc');
    const modalTimerText = document.getElementById('modal-timer-text');
    const btnModalClose = document.getElementById('btn-modal-close');
    const themeToggleBtn = document.getElementById('theme-toggle');
    const themeIcon = document.getElementById('theme-icon');
    const multiPreviewContainer = document.getElementById('multi-preview-container');

    // İlerleme metni için DOM elemanı oluştur
    const progressTextNode = document.createElement('div');
    progressTextNode.className = 'progress-steps';
    progressTextNode.style.display = 'none';
    btnSubmit.parentNode.insertBefore(progressTextNode, btnSubmit.nextSibling);

    let selectedImages = []; // Çoklu sayfa/görsel listesi: [{ name, base64 }]
    let isCooldownActive = false;
    let modalCountdownTimer = null;

    // ==========================================
    // 1.1 Tema Yönetimi (Koyu / Açık Mod)
    // ==========================================
    function initTheme() {
        const savedTheme = localStorage.getItem('asteria_theme') || 'light';
        applyTheme(savedTheme);
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('asteria_theme', theme);
        if (themeIcon) {
            if (theme === 'dark') {
                // Karanlık moddayken: Açık moda geçiş için IŞILDAYAN GÜNEŞ (Asla ayarlar/dişli gibi görünmeyen)
                themeIcon.innerHTML = `
                    <svg class="theme-svg sun-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="4.5" fill="#f59e0b" fill-opacity="0.25"></circle>
                        <line x1="12" y1="1.5" x2="12" y2="4"></line>
                        <line x1="12" y1="20" x2="12" y2="22.5"></line>
                        <line x1="4.2" y1="4.2" x2="6" y2="6"></line>
                        <line x1="18" y1="18" x2="19.8" y2="19.8"></line>
                        <line x1="1.5" y1="12" x2="4" y2="12"></line>
                        <line x1="20" y1="12" x2="22.5" y2="12"></line>
                        <line x1="4.2" y1="19.8" x2="6" y2="18"></line>
                        <line x1="18" y1="6" x2="19.8" y2="4.2"></line>
                    </svg>
                `;
            } else {
                // Açık moddayken: Karanlık moda geçiş için HİLAL AY
                themeIcon.innerHTML = `
                    <svg class="theme-svg moon-svg" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
                    </svg>
                `;
            }
        }
    }

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const next = current === 'dark' ? 'light' : 'dark';
            applyTheme(next);
        });
    }

    initTheme();

    // ==========================================
    // 2. KOTA VE LİMİT YÖNETİMİ (Rate Limiter)
    // ==========================================
    const MAX_QUOTA = 4; // Dakika başına güvenli işlem hakkı
    const WINDOW_DURATION = 60; // 60 saniyelik pencere

    // Yerel depolamadan kota bilgisini yükle veya başlat
    function getStoredQuota() {
        const now = Math.floor(Date.now() / 1000);
        let resetTime = parseInt(localStorage.getItem('asteria_quota_reset_time') || '0', 10);
        let currentCount = parseInt(localStorage.getItem('asteria_quota_count'), 10);

        if (isNaN(currentCount) || now >= resetTime) {
            // Süre dolmuş veya ilk giriş: Kotayı yenile
            currentCount = MAX_QUOTA;
            resetTime = now + WINDOW_DURATION;
            localStorage.setItem('asteria_quota_count', currentCount);
            localStorage.setItem('asteria_quota_reset_time', resetTime);
        }

        return {
            count: Math.min(MAX_QUOTA, Math.max(0, currentCount)),
            secondsRemaining: Math.max(1, resetTime - now)
        };
    }

    function saveQuota(count, resetSeconds = null) {
        localStorage.setItem('asteria_quota_count', Math.min(MAX_QUOTA, Math.max(0, count)));
        if (resetSeconds && resetSeconds > 0) {
            const resetTime = Math.floor(Date.now() / 1000) + resetSeconds;
            localStorage.setItem('asteria_quota_reset_time', resetTime);
        }
        updateQuotaDisplay();
    }

    function updateQuotaDisplay() {
        const { count, secondsRemaining } = getStoredQuota();
        
        // 1. Üst Rozet Güncellemesi
        if (quotaCountEl) quotaCountEl.textContent = count;
        if (quotaMaxEl) quotaMaxEl.textContent = MAX_QUOTA;
        if (quotaBadgeSeconds) quotaBadgeSeconds.textContent = `${secondsRemaining}s`;

        if (quotaBadge) {
            quotaBadge.classList.remove('quota-empty', 'quota-warning');
            if (count === 0) {
                quotaBadge.classList.add('quota-empty');
            } else if (count === 1) {
                quotaBadge.classList.add('quota-warning');
            }
        }

        // 2. Form İçi Sayaç Kartı Güncellemesi
        if (trackerRemainingText) trackerRemainingText.textContent = count;
        if (quotaTimerText) quotaTimerText.textContent = `${secondsRemaining} sn`;

        if (quotaProgressBar) {
            const percent = (count / MAX_QUOTA) * 100;
            quotaProgressBar.style.width = `${percent}%`;
        }

        // 3. Slot Noktaları (Dot Pills)
        quotaDots.forEach((dot, idx) => {
            dot.classList.remove('active');
            if (idx < count) {
                dot.classList.add('active');
            }
        });

        // 4. Kart Durum ve Buton Yönetimi
        if (quotaCard) {
            quotaCard.classList.remove('quota-card-empty', 'quota-card-warning');
            if (count === 0) {
                quotaCard.classList.add('quota-card-empty');
                if (quotaFooterDesc) {
                    quotaFooterDesc.textContent = `Dakikalık sınır doldu. Haklarınız ${secondsRemaining} sn sonra otomatik yenilenecektir.`;
                }
                if (!isCooldownActive && loader.style.display !== 'inline-block') {
                    btnSubmit.disabled = true;
                    btnText.innerHTML = `Dakikalık Limit Doldu (${secondsRemaining}s) <i class="fa-solid fa-clock"></i>`;
                }
            } else if (count === 1) {
                quotaCard.classList.add('quota-card-warning');
                if (quotaFooterDesc) {
                    quotaFooterDesc.textContent = `Son 1 dönüştürme hakkınız kaldı. Sıfırlanmaya kalan: ${secondsRemaining} sn.`;
                }
                if (!isCooldownActive && loader.style.display !== 'inline-block') {
                    btnSubmit.disabled = false;
                    btnText.innerHTML = `Görseli Excel'e Dönüştür <i class="fa-solid fa-wand-magic-sparkles"></i>`;
                }
            } else {
                if (quotaFooterDesc) {
                    quotaFooterDesc.textContent = `Google AI ücretsiz planı gereği dakikada en fazla 4 dönüştürme yapılabilir.`;
                }
                if (!isCooldownActive && loader.style.display !== 'inline-block') {
                    btnSubmit.disabled = false;
                    btnText.innerHTML = `Görseli Excel'e Dönüştür <i class="fa-solid fa-wand-magic-sparkles"></i>`;
                }
            }
        }
    }

    // Her saniye çalışan master geri sayım sayacı
    setInterval(() => {
        const { count, secondsRemaining } = getStoredQuota();
        if (secondsRemaining <= 1 && count < MAX_QUOTA) {
            // Dakikalık pencere doldu: Kotayı 4'e yenile
            saveQuota(MAX_QUOTA, WINDOW_DURATION);
            syncQuotaWithServer();
        } else {
            updateQuotaDisplay();
        }
    }, 1000);

    // Backend'den gerçek IP kotasını sorgula ve senkronize et
    async function syncQuotaWithServer() {
        try {
            const res = await fetch('/api/quota');
            if (res.ok) {
                const data = await res.json();
                if (typeof data.remaining === 'number') {
                    saveQuota(data.remaining, data.retry_in > 0 ? data.retry_in : null);
                }
            }
        } catch (e) {
            // Sunucu offline veya yerel test ise localStorage kullanılmaya devam eder
        }
    }

    // Sayfa açıldığında kota durumunu hazırla
    updateQuotaDisplay();
    syncQuotaWithServer();

    // ==========================================
    // 3. KULLANIM LİMİTİ UYARI MODALI
    // ==========================================
    function showLimitModal(secondsRemaining, customMessage = null) {
        if (customMessage) {
            modalDescEl.textContent = customMessage;
        } else {
            modalDescEl.textContent = `Google AI ücretsiz dakikalık kullanım sınırını korumak ve sunucu kilitlenmelerini önlemek adına yeni istekler geçici olarak duraklatıldı.`;
        }

        limitModal.classList.add('active');
        limitModal.setAttribute('aria-hidden', 'false');

        if (modalCountdownTimer) clearInterval(modalCountdownTimer);

        let remaining = Math.max(1, secondsRemaining);
        modalTimerText.textContent = `${remaining} sn`;

        modalCountdownTimer = setInterval(() => {
            remaining--;
            if (remaining > 0) {
                modalTimerText.textContent = `${remaining} sn`;
            } else {
                clearInterval(modalCountdownTimer);
                modalTimerText.textContent = 'Yenilendi!';
                // Kotayı tekrar tazele
                saveQuota(MAX_QUOTA, WINDOW_DURATION);
                setTimeout(() => {
                    closeLimitModal();
                }, 1000);
            }
        }, 1000);
    }

    function closeLimitModal() {
        limitModal.classList.remove('active');
        limitModal.setAttribute('aria-hidden', 'true');
        if (modalCountdownTimer) clearInterval(modalCountdownTimer);
        updateQuotaDisplay();
    }

    btnModalClose.addEventListener('click', closeLimitModal);
    limitModal.addEventListener('click', (e) => {
        if (e.target === limitModal) closeLimitModal();
    });

    function clearSelectedImage(e) {
        if (e) e.stopPropagation();
        selectedImages = [];
        fileInput.value = '';
        previewImg.src = '';
        previewImg.style.display = 'none';
        if (multiPreviewContainer) {
            multiPreviewContainer.innerHTML = '';
            multiPreviewContainer.style.display = 'none';
        }
        dropIcon.style.display = 'block';
        dropText.innerHTML = 'Tablo Görselini Sürükle, Seç veya <b>Yapıştır (Ctrl+V)</b>';
        if (btnClearImage) btnClearImage.style.display = 'none';
        resultBox.style.display = 'none';
        excelTargetInput.value = '';
    }

    if (btnClearImage) {
        btnClearImage.addEventListener('click', clearSelectedImage);
    }

    function renderSelectedImages() {
        if (selectedImages.length === 0) {
            clearSelectedImage();
            return;
        }

        if (btnClearImage) btnClearImage.style.display = 'inline-flex';
        dropIcon.style.display = 'none';
        resultBox.style.display = 'none';

        if (selectedImages.length === 1) {
            previewImg.src = selectedImages[0].base64;
            previewImg.style.display = 'block';
            if (multiPreviewContainer) {
                multiPreviewContainer.innerHTML = '';
                multiPreviewContainer.style.display = 'none';
            }
            dropText.textContent = `Seçilen Dosya: ${selectedImages[0].name}`;
        } else {
            previewImg.style.display = 'none';
            if (multiPreviewContainer) {
                multiPreviewContainer.style.display = 'flex';
                multiPreviewContainer.innerHTML = '';
                selectedImages.forEach((item, idx) => {
                    const card = document.createElement('div');
                    card.className = 'multi-thumb-card';
                    card.innerHTML = `
                        <img src="${item.base64}" alt="Sayfa ${idx + 1}" />
                        <span class="multi-thumb-badge">Sayfa ${idx + 1}</span>
                        <button type="button" class="multi-thumb-remove" title="Bu sayfayı kaldır" data-idx="${idx}">&times;</button>
                    `;
                    card.querySelector('.multi-thumb-remove').addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        selectedImages.splice(idx, 1);
                        renderSelectedImages();
                    });
                    multiPreviewContainer.appendChild(card);
                });
            }
            dropText.textContent = `${selectedImages.length} Sayfa Seçildi (Tek Excel'de birleştirilecek)`;
        }
    }

    // ==========================================
    // 4. Olay Dinleyicileri (Sürükle, Tıkla, YAPıŞTıR)
    // ==========================================
    dropZone.addEventListener('click', (e) => {
        if (e.target.closest('#btn-clear-image') || e.target.closest('.multi-thumb-remove')) return;
        fileInput.click();
    });

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
            handleFiles(e.dataTransfer.files);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFiles(e.target.files);
        }
    });

    // Kopyala-Yapıştır (CTRL+V / CMD+V) Desteği
    document.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (let index in items) {
            const item = items[index];
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                const file = item.getAsFile();
                
                dropZone.classList.add('active-paste');
                setTimeout(() => dropZone.classList.remove('active-paste'), 300);
                
                Object.defineProperty(file, 'name', {
                    writable: true,
                    value: `Pano_Goruntusu_${selectedImages.length + 1}.png`
                });
                
                handleFiles([file]);
                break;
            }
        }
    });

    // ==========================================
    // 5. Görsel İşleme ve Güvenli Sıkıştırma (Canvas)
    // ==========================================
    async function compressImageFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const tempImg = new Image();
                tempImg.src = e.target.result;
                tempImg.onload = () => {
                    const MAX_DIMENSION = 1200;
                    let width = tempImg.width;
                    let height = tempImg.height;

                    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
                        if (width > height) {
                            height = Math.round((height * MAX_DIMENSION) / width);
                            width = MAX_DIMENSION;
                        } else {
                            width = Math.round((width * MAX_DIMENSION) / height);
                            height = MAX_DIMENSION;
                        }
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(tempImg, 0, 0, width, height);
                    const base64 = canvas.toDataURL('image/jpeg', 0.80);
                    resolve(base64);
                };
                tempImg.onerror = reject;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    async function handleFiles(fileList) {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        const incoming = Array.from(fileList).filter(f => validTypes.includes(f.type));

        if (incoming.length === 0) {
            triggerErrorShake();
            showResult('Hata: Sadece PNG veya JPG formatında görseller yükleyebilirsiniz.', 'error');
            return;
        }

        if (selectedImages.length + incoming.length > 4) {
            triggerErrorShake();
            showResult('Bilgi: Tek seferde en fazla 4 sayfa birleştirebilirsiniz. İlk 4 görsel işleme alındı.', 'error');
        }

        const remainingSlots = 4 - selectedImages.length;
        const toProcess = incoming.slice(0, remainingSlots);

        for (let file of toProcess) {
            try {
                const base64 = await compressImageFile(file);
                selectedImages.push({
                    name: file.name,
                    base64: base64
                });
            } catch (err) {
                console.error("Görsel sıkıştırma hatası:", err);
            }
        }

        if (selectedImages.length > 0 && !excelTargetInput.value.trim()) {
            const firstClean = selectedImages[0].name.replace(/\.[^/.]+$/, "");
            excelTargetInput.value = firstClean;
        }

        renderSelectedImages();
    }

    // ==========================================
    // 6. Form Gönderimi, Güvenlik Kontrolleri ve API
    // ==========================================
    formExcel.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. KONTROL: KULLANIM LİMİTİ DOLDU MU?
        const quotaInfo = getStoredQuota();
        if (quotaInfo.count <= 0) {
            triggerErrorShake();
            showLimitModal(quotaInfo.secondsRemaining);
            return;
        }

        // 2. KONTROL: ANTI-SPAM BEKLEME SÜRESİ
        if (isCooldownActive) {
            triggerErrorShake();
            showResult('Lütfen önceki işlemin tamamlanmasını veya bekleme süresinin bitmesini bekleyin.', 'error');
            return;
        }

        // 3. KONTROL: GÖRSEL SEÇİLDİ Mİ?
        if (selectedImages.length === 0) {
            triggerErrorShake();
            showResult('Lütfen önce bir tablo görseli seçin, sürükleyin veya yapıştırın (Ctrl+V).', 'error');
            return;
        }

        // 4. KONTROL: KOTA YETERLİ Mİ? (Çoklu sayfa için)
        if (quotaInfo.count < selectedImages.length) {
            triggerErrorShake();
            showResult(`Bu işlem ${selectedImages.length} sayfa içeriyor ancak kalan hakkınız: ${quotaInfo.count}. Lütfen sayacın sıfırlanmasını bekleyin veya sayfa sayısını azaltın.`, 'error');
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
                images_base64: selectedImages.map(img => img.base64),
                target_xlsx: targetName
            };

            // Canlı İlerleme Durumu Animasyonu
            const steps = [
                "Görseller analiz ediliyor...",
                "Yapay zeka tabloları ve sekmeleri inceliyor...",
                "Hücreler, sayılar ve renkler ayrıştırılıyor...",
                "Excel ve CSV dosyaları oluşturuluyor...",
                "Çok sayfalı rapor hazırlanıyor, lütfen bekleyin..."
            ];
            let stepIndex = 0;
            progressTextNode.style.display = 'block';
            progressTextNode.textContent = steps[stepIndex];
            
            progressInterval = setInterval(() => {
                stepIndex++;
                if (stepIndex < steps.length) {
                    progressTextNode.textContent = steps[stepIndex];
                }
            }, 1200);

            wakeupTimeout = setTimeout(() => {
                progressTextNode.innerHTML = "<i class='fa-solid fa-server'></i> Sunucu yanıt hazırlıyor...";
            }, 4000);

            // API İsteği
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

            // LIMIT DOLDUĞUNDA (HTTP 429) DOĞRUDAN UYARI MODALINI AÇ
            if (response.status === 429) {
                const limitData = await response.json().catch(() => ({}));
                const retrySeconds = limitData.retry_after || 60;
                saveQuota(0, retrySeconds);
                triggerErrorShake();
                showLimitModal(retrySeconds, limitData.message);
                throw new Error(limitData.message || "Dakikalık kullanım sınırına ulaşıldı.");
            }

            if (response.status === 413) {
                throw new Error("Görsel çok büyük. Sistemin 4.5 MB sınırı aşıldı.");
            }
            if (response.status === 504) {
                throw new Error("Zaman aşımı: Tablo çok karmaşık olduğu için sunucu yanıt veremedi. Lütfen daha net ve küçük bir kesit yükleyin.");
            }
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Sunucu hatası (Kod: ${response.status}).`);
            }

            const data = await response.json();

            if (data.status === 'success' && data.excel_base64) {
                // Başarılı işlemde kotayı güncelle
                const updatedCount = typeof data.remaining_quota === 'number' ? data.remaining_quota : Math.max(0, quotaInfo.count - selectedImages.length);
                const retrySeconds = typeof data.retry_in === 'number' && data.retry_in > 0 ? data.retry_in : null;
                saveQuota(updatedCount, retrySeconds);

                // Anti-spam bekleme süresini başlat (Hızlı deneyim için 2 saniye)
                startAntiSpamCooldown(2);

                // Base64 -> Blob Excel indirme bağlantısı
                const byteCharacters = atob(data.excel_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
                
                const downloadUrl = URL.createObjectURL(blob);
                const finalFileName = targetName;
                const sheetBadgeText = data.sheet_count > 1 ? ` (${data.sheet_count} Sayfalı Excel)` : '';
                
                // 1. Eylem Butonları (Excel İndir + CSV İndir + Panoya Kopyala)
                const actionHtml = `
                    <div class="result-actions">
                        <a href="${downloadUrl}" class="btn-download" download="${finalFileName}">
                            <i class="fa-solid fa-file-excel"></i> Excel İndir (.xlsx)${sheetBadgeText}
                        </a>
                        <button type="button" class="btn-csv-download" id="btn-csv-download" title="UTF-8 formatında virgülle ayrılmış değerler">
                            <i class="fa-solid fa-file-csv"></i> CSV Olarak İndir
                        </button>
                        <button type="button" class="btn-copy-clipboard" id="btn-copy-table" title="Google Sheets veya Excel'e doğrudan yapıştırmak için kopyala">
                            <i class="fa-solid fa-copy"></i> Panoya Kopyala
                        </button>
                    </div>
                `;

                // 2. Web Üzerinde Tablo Önizleme Akordiyonu
                let tablePreviewHtml = '';
                const tablesToRender = Array.isArray(data.all_tables) && data.all_tables.length > 0 ? data.all_tables : (data.table_data ? [data.table_data] : []);
                if (tablesToRender.length > 0) {
                    const totalRows = tablesToRender.reduce((sum, t) => sum + (Array.isArray(t) ? t.length : 0), 0);
                    tablePreviewHtml = `
                        <details class="table-preview-details">
                            <summary>
                                <i class="fa-solid fa-table-cells"></i> 
                                Tablo Önizlemesini Gör (${tablesToRender.length > 1 ? tablesToRender.length + ' Sayfa, Toplam ' + totalRows + ' Satır' : totalRows + ' Satır'})
                            </summary>
                            <div class="preview-table-container">
                                ${tablesToRender.map((tbl, tIdx) => `
                                    ${tablesToRender.length > 1 ? `<div class="preview-sheet-header" style="font-weight:700; font-size:13px; margin: 12px 0 6px; color: var(--primary-color);"><i class="fa-solid fa-file-lines"></i> Sayfa ${tIdx + 1} (${tbl.length} Satır)</div>` : ''}
                                    <table class="web-preview-table" style="margin-bottom: 16px;">
                                        <tbody>
                                            ${tbl.map((row, rIdx) => `
                                                <tr>
                                                    ${row.map(cell => {
                                                        const tag = rIdx === 0 ? 'th' : 'td';
                                                        const isBold = cell.bold ? 'font-weight:700;' : '';
                                                        const bg = cell.bg_color && cell.bg_color !== '#FFFFFF' ? `background-color:${cell.bg_color};` : '';
                                                        return `<${tag} style="${isBold}${bg}">${cell.value !== undefined && cell.value !== null ? cell.value : ''}</${tag}>`;
                                                    }).join('')}
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                `).join('')}
                            </div>
                        </details>
                    `;
                }

                const successMessage = `
                    <strong><i class="fa-solid fa-check"></i> Harika! Tablo Çevrildi.</strong> 
                    <br>Görseldeki tüm veriler, hücre formatları ve stiller başarıyla Excel'e aktarıldı.
                    ${actionHtml}
                    ${tablePreviewHtml}
                `;
                showResult(successMessage, 'success');

                // CSV İndirme Butonu Dinleyicisi
                const btnCsv = document.getElementById('btn-csv-download');
                if (btnCsv) {
                    btnCsv.addEventListener('click', () => {
                        downloadTableAsCsv(data.table_data, finalFileName, data.all_tables);
                    });
                }

                // Panoya Kopyalama Olay Dinleyicisi (TSV formatı: Sheets/Excel ile birebir uyumlu)
                const btnCopy = document.getElementById('btn-copy-table');
                if (btnCopy) {
                    btnCopy.addEventListener('click', () => {
                        let tsv = '';
                        if (Array.isArray(data.all_tables) && data.all_tables.length > 1) {
                            tsv = data.all_tables.map((tbl, idx) => {
                                const header = `--- Sayfa ${idx + 1} ---`;
                                const rows = tbl.map(row => 
                                    row.map(c => (c.value !== undefined && c.value !== null ? c.value.toString() : '').replace(/[\t\n]/g, ' ')).join('\t')
                                ).join('\n');
                                return `${header}\n${rows}`;
                            }).join('\n\n');
                        } else if (Array.isArray(data.table_data)) {
                            tsv = data.table_data.map(row => 
                                row.map(c => (c.value !== undefined && c.value !== null ? c.value.toString() : '').replace(/[\t\n]/g, ' ')).join('\t')
                            ).join('\n');
                        }
                        
                        navigator.clipboard.writeText(tsv).then(() => {
                            btnCopy.classList.add('copied');
                            btnCopy.innerHTML = `<i class="fa-solid fa-check"></i> Kopyalandı!`;
                            setTimeout(() => {
                                btnCopy.classList.remove('copied');
                                btnCopy.innerHTML = `<i class="fa-solid fa-copy"></i> Panoya Kopyala`;
                            }, 2500);
                        }).catch(() => {
                            btnCopy.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Kopyalanamadı`;
                        });
                    });
                }
                
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

            showResult(`<strong><i class="fa-solid fa-circle-exclamation"></i> Bilgi:</strong> ${errorMsg}`, 'error');
        } finally {
            setLoadingState(false);
        }
    });

    // ==========================================
    // 7. CSV İndirme Fonksiyonu (UTF-8 BOM Desteği ile)
    // ==========================================
    function downloadTableAsCsv(tableData, filename, allTables = null) {
        const tables = Array.isArray(allTables) && allTables.length > 0 ? allTables : (tableData ? [tableData] : []);
        if (tables.length === 0) return;

        let csvSections = [];
        tables.forEach((tbl, idx) => {
            if (!Array.isArray(tbl) || tbl.length === 0) return;
            const rows = [];
            if (tables.length > 1) {
                rows.push(`"--- Sayfa ${idx + 1} ---"`);
            }
            tbl.forEach(row => {
                const line = row.map(cell => {
                    let val = cell.value !== undefined && cell.value !== null ? cell.value.toString() : '';
                    if (val.includes('"') || val.includes(';') || val.includes(',') || val.includes('\n')) {
                        val = '"' + val.replace(/"/g, '""') + '"';
                    }
                    return val;
                }).join(';');
                rows.push(line);
            });
            csvSections.push(rows.join('\r\n'));
        });

        // UTF-8 BOM (\uFEFF) eklenerek Excel'de Türkçe karakterlerin bozulmadan açılması sağlanır
        const csvContent = '\uFEFF' + csvSections.join('\r\n\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.replace(/\.xlsx$/i, '') + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ==========================================
    // 8. Anti-Spam Cooldown Mekanizması
    // ==========================================
    function startAntiSpamCooldown(seconds) {
        isCooldownActive = true;
        let left = seconds;
        btnSubmit.disabled = true;
        btnText.innerHTML = `Lütfen bekleyin (${left}s) <i class="fa-solid fa-shield-halved"></i>`;

        const cdInterval = setInterval(() => {
            left--;
            if (left > 0) {
                btnText.innerHTML = `Lütfen bekleyin (${left}s) <i class="fa-solid fa-shield-halved"></i>`;
            } else {
                clearInterval(cdInterval);
                isCooldownActive = false;
                updateQuotaDisplay();
            }
        }, 1000);
    }

    // ==========================================
    // 8. Yardımcı Fonksiyonlar
    // ==========================================
    function setLoadingState(isLoading) {
        if (isLoading) {
            btnText.style.display = 'none';
            loader.style.display = 'block';
            btnSubmit.disabled = true;
            resultBox.style.display = 'none';
        } else {
            loader.style.display = 'none';
            btnText.style.display = 'block';
            if (!isCooldownActive) {
                updateQuotaDisplay();
            }
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

    function triggerErrorShake() {
        const formBox = document.querySelector('.app-box');
        formBox.classList.remove('shake');
        void formBox.offsetWidth;
        formBox.classList.add('shake');
    }
});
