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
    
    // Çoklu Sayfa ve Mod Seçici Elemanları
    const modeSingleBtn = document.getElementById('mode-single');
    const modeMultiBtn = document.getElementById('mode-multi');
    const multiCountSelector = document.getElementById('multi-count-selector');
    const countChips = document.querySelectorAll('.count-chip');
    const btnLoadSample = document.getElementById('btn-load-sample');
    const activeSheetBadge = document.getElementById('active-sheet-badge');
    const activeSheetName = document.getElementById('active-sheet-name');
    const sheetNavBar = document.getElementById('sheet-nav-bar');
    const sheetTabsList = document.getElementById('sheet-tabs-list');
    const btnAddSheet = document.getElementById('btn-add-sheet');

    // İlerleme metni için DOM elemanı oluştur
    const progressTextNode = document.createElement('div');
    progressTextNode.className = 'progress-steps';
    progressTextNode.style.display = 'none';
    btnSubmit.parentNode.insertBefore(progressTextNode, btnSubmit.nextSibling);

    let currentMode = 'single'; // 'single' veya 'multi'
    let singleImage = null; // Tek sayfa modunda tutulan görsel: { name, base64 }
    let sheets = [
        { name: '', base64: '' },
        { name: '', base64: '' }
    ]; // Çoklu sayfa listesi (Varsayılan 2 sayfa)
    let activeSheetIndex = 0; // O an seçili olan / yapıştırma yapılan sayfa indeksi
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

    // ==========================================
    // 3. Mod Yönetimi ve Alt Sayfa Kontrolleri
    // ==========================================
    function switchMode(mode) {
        currentMode = mode;
        if (mode === 'multi') {
            if (modeSingleBtn) {
                modeSingleBtn.classList.remove('active');
                modeSingleBtn.setAttribute('aria-selected', 'false');
            }
            if (modeMultiBtn) {
                modeMultiBtn.classList.add('active');
                modeMultiBtn.setAttribute('aria-selected', 'true');
            }
            if (multiCountSelector) multiCountSelector.style.display = 'inline-flex';
            if (activeSheetBadge) activeSheetBadge.style.display = 'inline-flex';
            if (sheetNavBar) sheetNavBar.style.display = 'flex';

            if (sheets.length < 2) {
                sheets = [
                    { name: '', base64: '' },
                    { name: '', base64: '' }
                ];
            }
            if (singleImage && !sheets[0].base64) {
                sheets[0] = { ...singleImage };
            }

            renderSheetNavigation();
            displayActiveSheet();
        } else {
            if (modeMultiBtn) {
                modeMultiBtn.classList.remove('active');
                modeMultiBtn.setAttribute('aria-selected', 'false');
            }
            if (modeSingleBtn) {
                modeSingleBtn.classList.add('active');
                modeSingleBtn.setAttribute('aria-selected', 'true');
            }
            if (multiCountSelector) multiCountSelector.style.display = 'none';
            if (activeSheetBadge) activeSheetBadge.style.display = 'none';
            if (sheetNavBar) sheetNavBar.style.display = 'none';

            displayActiveSheet();
        }
    }

    if (modeSingleBtn) {
        modeSingleBtn.addEventListener('click', () => switchMode('single'));
    }
    if (modeMultiBtn) {
        modeMultiBtn.addEventListener('click', () => switchMode('multi'));
    }

    // Sayfa Sayısı Seçimi (2, 3, 4 Sayfa Butonları)
    if (countChips) {
        countChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const count = parseInt(chip.getAttribute('data-count'), 10);
                setSheetCount(count);
            });
        });
    }

    function setSheetCount(count) {
        if (count < 2 || count > 4) return;
        while (sheets.length < count) {
            sheets.push({ name: '', base64: '' });
        }
        while (sheets.length > count) {
            sheets.pop();
        }
        if (activeSheetIndex >= sheets.length) {
            activeSheetIndex = sheets.length - 1;
        }
        renderSheetNavigation();
        displayActiveSheet();
    }

    if (btnAddSheet) {
        btnAddSheet.addEventListener('click', () => {
            if (sheets.length < 4) {
                sheets.push({ name: '', base64: '' });
                activeSheetIndex = sheets.length - 1;
                renderSheetNavigation();
                displayActiveSheet();
            }
        });
    }

    function renderSheetNavigation() {
        if (!sheetTabsList) return;
        sheetTabsList.innerHTML = '';

        // Üstteki sayfa sayısı butonlarını güncelle
        if (countChips) {
            countChips.forEach(chip => {
                const c = parseInt(chip.getAttribute('data-count'), 10);
                if (c === sheets.length) {
                    chip.classList.add('active');
                } else {
                    chip.classList.remove('active');
                }
            });
        }

        // Sayfa ekle butonunun görünürlüğü
        if (btnAddSheet) {
            btnAddSheet.style.display = sheets.length >= 4 ? 'none' : 'inline-flex';
        }

        sheets.forEach((sheet, idx) => {
            const card = document.createElement('div');
            card.className = `sheet-tab-card ${idx === activeSheetIndex ? 'active' : ''}`;
            card.setAttribute('data-index', idx);
            card.innerHTML = `
                <div class="sheet-tab-header">
                    <div class="sheet-tab-title-wrap">
                        <span class="sheet-status-dot ${sheet.base64 ? 'filled' : ''}"></span>
                        <span class="sheet-tab-title">${idx + 1}. Sayfa</span>
                    </div>
                    ${sheets.length > 2 ? `<button type="button" class="sheet-btn-delete" title="Bu sayfayı kaldır" data-index="${idx}"><i class="fa-solid fa-xmark"></i></button>` : ''}
                </div>
                <div class="sheet-tab-body">
                    <div class="sheet-preview-mini">
                        ${sheet.base64 ? `<img src="${sheet.base64}" alt="Sayfa ${idx + 1}" />` : `<i class="fa-regular fa-file"></i>`}
                    </div>
                    <div class="sheet-order-arrows">
                        <button type="button" class="btn-order-arrow btn-move-left" title="Sola Taşı (Önceki Sekme Yap)" data-index="${idx}" ${idx === 0 ? 'disabled' : ''}>
                            <i class="fa-solid fa-arrow-left"></i>
                        </button>
                        <button type="button" class="btn-order-arrow btn-move-right" title="Sağa Taşı (Sonraki Sekme Yap)" data-index="${idx}" ${idx === sheets.length - 1 ? 'disabled' : ''}>
                            <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </div>
                </div>
            `;

            // Sekmeye tıklayınca aktif sayfa yap
            card.addEventListener('click', (ev) => {
                if (ev.target.closest('.sheet-order-arrows') || ev.target.closest('.sheet-btn-delete')) return;
                activeSheetIndex = idx;
                renderSheetNavigation();
                displayActiveSheet();
            });

            // Sola Taşı (Sıra Değiştirme)
            const btnLeft = card.querySelector('.btn-move-left');
            if (btnLeft && idx > 0) {
                btnLeft.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const temp = sheets[idx];
                    sheets[idx] = sheets[idx - 1];
                    sheets[idx - 1] = temp;
                    if (activeSheetIndex === idx) activeSheetIndex = idx - 1;
                    else if (activeSheetIndex === idx - 1) activeSheetIndex = idx;
                    renderSheetNavigation();
                    displayActiveSheet();
                });
            }

            // Sağa Taşı (Sıra Değiştirme)
            const btnRight = card.querySelector('.btn-move-right');
            if (btnRight && idx < sheets.length - 1) {
                btnRight.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const temp = sheets[idx];
                    sheets[idx] = sheets[idx + 1];
                    sheets[idx + 1] = temp;
                    if (activeSheetIndex === idx) activeSheetIndex = idx + 1;
                    else if (activeSheetIndex === idx + 1) activeSheetIndex = idx;
                    renderSheetNavigation();
                    displayActiveSheet();
                });
            }

            // Sayfa Silme Butonu
            const btnDel = card.querySelector('.sheet-btn-delete');
            if (btnDel) {
                btnDel.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    sheets.splice(idx, 1);
                    if (activeSheetIndex >= sheets.length) activeSheetIndex = sheets.length - 1;
                    renderSheetNavigation();
                    displayActiveSheet();
                });
            }

            // Kart üzerine sürükle-bırak desteği
            card.addEventListener('dragover', (ev) => {
                ev.preventDefault();
                card.classList.add('dragover');
            });
            card.addEventListener('dragleave', () => {
                card.classList.remove('dragover');
            });
            card.addEventListener('drop', (ev) => {
                ev.preventDefault();
                card.classList.remove('dragover');
                if (ev.dataTransfer.files && ev.dataTransfer.files.length > 0) {
                    activeSheetIndex = idx;
                    handleFiles(ev.dataTransfer.files);
                }
            });

            sheetTabsList.appendChild(card);
        });
    }

    function displayActiveSheet() {
        if (currentMode === 'single') {
            if (activeSheetBadge) activeSheetBadge.style.display = 'none';
            if (singleImage && singleImage.base64) {
                previewImg.src = singleImage.base64;
                previewImg.style.display = 'block';
                dropIcon.style.display = 'none';
                dropText.textContent = `Seçilen Dosya: ${singleImage.name}`;
                if (btnClearImage) btnClearImage.style.display = 'inline-flex';
            } else {
                previewImg.src = '';
                previewImg.style.display = 'none';
                dropIcon.style.display = 'block';
                dropText.innerHTML = 'Tablo Görselini Sürükle, Seç veya <b>Yapıştır (Ctrl+V)</b>';
                if (btnClearImage) btnClearImage.style.display = 'none';
            }
            btnText.innerHTML = 'Görseli Excel\'e Dönüştür <i class="fa-solid fa-wand-magic-sparkles"></i>';
        } else {
            if (activeSheetBadge) {
                activeSheetBadge.style.display = 'inline-flex';
                if (activeSheetName) {
                    activeSheetName.textContent = `${activeSheetIndex + 1}. Sayfa Düzenleniyor (Excel Sekmesi: Sayfa${activeSheetIndex + 1})`;
                }
            }

            const cur = sheets[activeSheetIndex];
            if (cur && cur.base64) {
                previewImg.src = cur.base64;
                previewImg.style.display = 'block';
                dropIcon.style.display = 'none';
                dropText.textContent = `${activeSheetIndex + 1}. Sayfa: ${cur.name}`;
                if (btnClearImage) btnClearImage.style.display = 'inline-flex';
            } else {
                previewImg.src = '';
                previewImg.style.display = 'none';
                dropIcon.style.display = 'block';
                dropText.innerHTML = `${activeSheetIndex + 1}. Sayfa İçin Tablo Görseli Seç veya <b>Yapıştır (Ctrl+V)</b>`;
                if (btnClearImage) btnClearImage.style.display = 'none';
            }

            const filledCount = sheets.filter(s => s && s.base64).length;
            if (filledCount > 1) {
                btnText.innerHTML = `${filledCount} Sayfayı Tek Excel Yap <i class="fa-solid fa-wand-magic-sparkles"></i>`;
            } else {
                btnText.innerHTML = 'Görselleri Excel\'e Dönüştür <i class="fa-solid fa-wand-magic-sparkles"></i>';
            }
        }
    }

    function clearSelectedImage(e) {
        if (e) e.stopPropagation();
        fileInput.value = '';
        if (currentMode === 'single') {
            singleImage = null;
            excelTargetInput.value = '';
        } else {
            sheets[activeSheetIndex] = { name: '', base64: '' };
            renderSheetNavigation();
        }
        displayActiveSheet();
        resultBox.style.display = 'none';
    }

    if (btnClearImage) {
        btnClearImage.addEventListener('click', clearSelectedImage);
    }

    // 1-Tıkla Örnek Çoklu Tablo Oluşturucu (Test İçin)
    function generateSampleTableImages() {
        function createTableCanvas(title, headerColor, headers, rows, totalRow) {
            const canvas = document.createElement('canvas');
            canvas.width = 640;
            canvas.height = 340;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 2;
            ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

            // Üst Başlık Şeridi
            ctx.fillStyle = headerColor;
            ctx.fillRect(10, 10, canvas.width - 20, 48);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px Inter, sans-serif';
            ctx.fillText(title, 25, 40);

            const startX = 25;
            const startY = 75;
            const colWidth = (canvas.width - 50) / headers.length;
            const rowHeight = 36;

            // Başlık Satırı
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(startX, startY, canvas.width - 50, rowHeight);
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 13px Inter, sans-serif';
            headers.forEach((h, idx) => {
                ctx.fillText(h, startX + idx * colWidth + 8, startY + 23);
            });

            // Veri Satırları
            rows.forEach((r, rIdx) => {
                const y = startY + (rIdx + 1) * rowHeight;
                ctx.fillStyle = (rIdx % 2 === 0) ? '#ffffff' : '#f8fafc';
                ctx.fillRect(startX, y, canvas.width - 50, rowHeight);
                ctx.fillStyle = '#334155';
                ctx.font = '12px Inter, sans-serif';
                r.forEach((cell, cIdx) => {
                    ctx.fillText(cell, startX + cIdx * colWidth + 8, y + 23);
                });

                ctx.strokeStyle = '#e2e8f0';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(startX, y + rowHeight);
                ctx.lineTo(canvas.width - 25, y + rowHeight);
                ctx.stroke();
            });

            // Toplam Satırı
            if (totalRow) {
                const totalY = startY + (rows.length + 1) * rowHeight;
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(startX, totalY, canvas.width - 50, rowHeight);
                ctx.fillStyle = '#0f172a';
                ctx.font = 'bold 13px Inter, sans-serif';
                totalRow.forEach((cell, cIdx) => {
                    ctx.fillText(cell, startX + cIdx * colWidth + 8, totalY + 23);
                });
            }

            return canvas.toDataURL('image/jpeg', 0.90);
        }

        const img1 = createTableCanvas(
            "Ocak 2024 Satış ve Ciro Tablosu",
            "#1e40af",
            ["Ürün Kodu", "Ürün Adı", "Kategori", "Adet", "Birim Fiyat", "Ciro (TL)"],
            [
                ["P-101", "Laptop Pro 15", "Bilgisayar", "12", "28.500", "342.000"],
                ["P-102", "Kablosuz Mouse", "Aksesuar", "85", "450", "38.250"],
                ["P-103", "27\" 4K Monitör", "Ekran", "18", "9.200", "165.600"],
                ["P-104", "Mekanik Klavye", "Donanım", "42", "1.850", "77.700"]
            ],
            ["TOPLAM", "4 Kalem", "-", "157", "-", "623.550 TL"]
        );

        const img2 = createTableCanvas(
            "Şubat 2024 Bölgesel Performans Tablosu",
            "#047857",
            ["Bölge", "Temsilci", "Hedef (TL)", "Satış (TL)", "Kalan (TL)", "Başarı %"],
            [
                ["Marmara", "Ahmet Yılmaz", "400.000", "485.000", "+85.000", "%121"],
                ["Ege", "Zeynep Kaya", "300.000", "315.000", "+15.000", "%105"],
                ["İç Anadolu", "Mehmet Demir", "250.000", "240.000", "-10.000", "%96"],
                ["Akdeniz", "Elif Çelik", "200.000", "230.000", "+30.000", "%115"]
            ],
            ["GENEL TOPLAM", "4 Bölge", "1.150.000", "1.270.000", "+120.000", "%110"]
        );

        return [
            { name: "Ocak_2024_Satis_Tablosu.jpg", base64: img1 },
            { name: "Subat_2024_Performans_Tablosu.jpg", base64: img2 }
        ];
    }

    if (btnLoadSample) {
        btnLoadSample.addEventListener('click', () => {
            const samples = generateSampleTableImages();
            setSheetCount(2);
            sheets[0] = samples[0];
            sheets[1] = samples[1];
            activeSheetIndex = 0;
            excelTargetInput.value = "Sirket_2024_Cift_Sayfa_Raporu";
            switchMode('multi');
            renderSheetNavigation();
            displayActiveSheet();
            
            showResult(`
                <strong><i class="fa-solid fa-wand-magic-sparkles"></i> 2 Adet Örnek Sayfa Dolduruldu!</strong><br>
                1. Sayfa: <em>Ocak 2024 Satış ve Ciro Tablosu</em><br>
                2. Sayfa: <em>Şubat 2024 Bölgesel Performans Tablosu</em><br>
                Alttaki <strong>◀ ve ▶</strong> oklarına tıklayarak sayfaların sırasını anında değiştirebilirsiniz.
            `, 'info');
        });
    }

    // ==========================================
    // 4. Olay Dinleyicileri (Sürükle, Tıkla, YAPıŞTıR)
    // ==========================================
    dropZone.addEventListener('click', (e) => {
        if (e.target.closest('#btn-clear-image')) return;
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
                
                const pageLabel = currentMode === 'multi' ? `Sayfa_${activeSheetIndex + 1}` : 'Gorsel';
                Object.defineProperty(file, 'name', {
                    writable: true,
                    value: `Pano_${pageLabel}.png`
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
        fileInput.value = '';
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        const incoming = Array.from(fileList).filter(f => validTypes.includes(f.type));

        if (incoming.length === 0) {
            triggerErrorShake();
            showResult('Hata: Sadece PNG veya JPG formatında görseller yükleyebilirsiniz.', 'error');
            return;
        }

        if (currentMode === 'single') {
            if (incoming.length > 1) {
                // Çoklu dosya seçildiyse çoklu moda geç ve doldur
                switchMode('multi');
                setSheetCount(Math.min(4, Math.max(2, incoming.length)));
                for (let i = 0; i < Math.min(sheets.length, incoming.length); i++) {
                    const b64 = await compressImageFile(incoming[i]);
                    sheets[i] = { name: incoming[i].name, base64: b64 };
                }
                if (!excelTargetInput.value.trim()) {
                    excelTargetInput.value = incoming[0].name.replace(/\.[^/.]+$/, "");
                }
                renderSheetNavigation();
                displayActiveSheet();
                return;
            } else {
                const b64 = await compressImageFile(incoming[0]);
                singleImage = { name: incoming[0].name, base64: b64 };
                if (!excelTargetInput.value.trim()) {
                    excelTargetInput.value = incoming[0].name.replace(/\.[^/.]+$/, "");
                }
                displayActiveSheet();
                return;
            }
        } else {
            // Çoklu Sayfa Modu
            if (incoming.length === 1) {
                const b64 = await compressImageFile(incoming[0]);
                sheets[activeSheetIndex] = { name: incoming[0].name, base64: b64 };
                if (!excelTargetInput.value.trim()) {
                    excelTargetInput.value = incoming[0].name.replace(/\.[^/.]+$/, "");
                }
                // Bir sonraki sayfa boşsa otomatik oraya geçiş yap (hızlı yapıştırma için)
                if (activeSheetIndex + 1 < sheets.length && !sheets[activeSheetIndex + 1].base64) {
                    activeSheetIndex++;
                }
            } else {
                // Birden çok görsel sürüklendiyse sayfaları sırayla doldur
                let targetIdx = activeSheetIndex;
                for (let file of incoming) {
                    if (targetIdx >= sheets.length && sheets.length < 4) {
                        sheets.push({ name: '', base64: '' });
                    }
                    if (targetIdx < sheets.length) {
                        const b64 = await compressImageFile(file);
                        sheets[targetIdx] = { name: file.name, base64: b64 };
                        targetIdx++;
                    }
                }
                if (!excelTargetInput.value.trim()) {
                    excelTargetInput.value = incoming[0].name.replace(/\.[^/.]+$/, "");
                }
            }
            renderSheetNavigation();
            displayActiveSheet();
        }
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
        let imagesToConvert = [];
        if (currentMode === 'single') {
            if (singleImage && singleImage.base64) {
                imagesToConvert = [singleImage.base64];
            }
        } else {
            imagesToConvert = sheets.filter(s => s && s.base64).map(s => s.base64);
        }

        if (imagesToConvert.length === 0) {
            triggerErrorShake();
            showResult('Lütfen önce bir tablo görseli seçin, sürükleyin veya yapıştırın (Ctrl+V).', 'error');
            return;
        }

        // 4. KONTROL: KOTA YETERLİ Mİ? (Çoklu sayfa için)
        if (quotaInfo.count < imagesToConvert.length) {
            triggerErrorShake();
            showResult(`Bu işlem ${imagesToConvert.length} sayfa içeriyor ancak kalan hakkınız: ${quotaInfo.count}. Lütfen sayacın sıfırlanmasını bekleyin veya sayfa sayısını azaltın.`, 'error');
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
                images_base64: imagesToConvert,
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
                const updatedCount = typeof data.remaining_quota === 'number' ? data.remaining_quota : Math.max(0, quotaInfo.count - imagesToConvert.length);
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

                // 2. Web Üzerinde Tablo Önizleme Akordiyonu (Çoklu Sayfa Sekmeleri ile)
                let tablePreviewHtml = '';
                const tablesToRender = Array.isArray(data.all_tables) && data.all_tables.length > 0 ? data.all_tables : (data.table_data ? [data.table_data] : []);
                if (tablesToRender.length > 0) {
                    const totalRows = tablesToRender.reduce((sum, t) => sum + (Array.isArray(t) ? t.length : 0), 0);
                    
                    let sheetTabsHtml = '';
                    let sheetPanesHtml = '';

                    if (tablesToRender.length > 1) {
                        sheetTabsHtml = `
                            <div class="preview-sheet-tabs">
                                ${tablesToRender.map((tbl, tIdx) => `
                                    <button type="button" class="sheet-tab-btn ${tIdx === 0 ? 'active' : ''}" data-target-pane="sheet-pane-${tIdx}">
                                        <i class="fa-solid fa-file-excel"></i> Sayfa ${tIdx + 1} (${tbl.length} Satır)
                                    </button>
                                `).join('')}
                            </div>
                        `;
                    }

                    sheetPanesHtml = tablesToRender.map((tbl, tIdx) => `
                        <div class="sheet-tab-pane ${tIdx === 0 ? 'active' : ''}" id="sheet-pane-${tIdx}">
                            ${tablesToRender.length > 1 ? `<div class="preview-sheet-header" style="font-weight:700; font-size:13px; margin: 8px 0; color: var(--app-primary);"><i class="fa-solid fa-table"></i> Sayfa ${tIdx + 1} İçeriği (${tbl.length} Satır)</div>` : ''}
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
                        </div>
                    `).join('');

                    tablePreviewHtml = `
                        <details class="table-preview-details" open>
                            <summary>
                                <i class="fa-solid fa-table-cells"></i> 
                                Tablo Önizlemesini Gör (${tablesToRender.length > 1 ? tablesToRender.length + ' Sayfa, Toplam ' + totalRows + ' Satır' : totalRows + ' Satır'})
                            </summary>
                            <div class="preview-table-container">
                                ${sheetTabsHtml}
                                ${sheetPanesHtml}
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

                // Çoklu Sayfa Önizleme Sekme Değiştirici Dinleyicileri
                document.querySelectorAll('.sheet-tab-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        document.querySelectorAll('.sheet-tab-btn').forEach(b => b.classList.remove('active'));
                        document.querySelectorAll('.sheet-tab-pane').forEach(p => p.classList.remove('active'));
                        btn.classList.add('active');
                        const targetId = btn.getAttribute('data-target-pane');
                        const targetPane = document.getElementById(targetId);
                        if (targetPane) targetPane.classList.add('active');
                    });
                });

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

    // ==========================================
    // 9. Özel Tasarım İmleç (Custom Interactive Cursor)
    // ==========================================
    function initCustomCursor() {
        const cursorDot = document.getElementById('custom-cursor-dot');
        const cursorRing = document.getElementById('custom-cursor-ring');
        if (!cursorDot || !cursorRing) return;

        // Dokunmatik ekranlı cihazlarda imleci devreye sokma
        if (window.matchMedia('(pointer: coarse)').matches) return;

        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let ringX = mouseX;
        let ringY = mouseY;
        let isInitialized = false;

        // Mouse hareketlerini dinle (Dot anında takip eder)
        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;

            cursorDot.style.left = `${mouseX}px`;
            cursorDot.style.top = `${mouseY}px`;

            if (!isInitialized) {
                isInitialized = true;
                ringX = mouseX;
                ringY = mouseY;
                cursorDot.classList.add('active');
                cursorRing.classList.add('active');
            }
        });

        // Mouse tıklamalarında içe çekilme animasyonu
        window.addEventListener('mousedown', () => {
            cursorRing.classList.add('cursor-down');
            cursorDot.classList.add('cursor-down');
        });

        window.addEventListener('mouseup', () => {
            cursorRing.classList.remove('cursor-down');
            cursorDot.classList.remove('cursor-down');
        });

        // Tarayıcı penceresinden çıkıldığında gizle, girildiğinde göster
        document.addEventListener('mouseleave', () => {
            cursorDot.classList.add('cursor-hidden');
            cursorRing.classList.add('cursor-hidden');
        });

        document.addEventListener('mouseenter', () => {
            cursorDot.classList.remove('cursor-hidden');
            cursorRing.classList.remove('cursor-hidden');
        });

        // Tıklanabilir / Etkileşimli eleman hover tespiti (Dinamik sekmeler için delegasyon)
        const interactiveSelector = 'button, a, input, textarea, select, label, [role="button"], [role="tab"], .drop-zone, .sheet-tab-card, .btn-order-arrow, .count-chip, .mode-seg-btn, .theme-toggle-btn, .btn-add-sheet, .btn-sample-inline, .status-badge, summary';

        document.addEventListener('mouseover', (e) => {
            if (e.target.closest && e.target.closest(interactiveSelector)) {
                cursorRing.classList.add('cursor-hover');
                cursorDot.classList.add('cursor-hover');
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (e.target.closest && e.target.closest(interactiveSelector)) {
                cursorRing.classList.remove('cursor-hover');
                cursorDot.classList.remove('cursor-hover');
            }
        });

        // Ring için yumuşak interpolasyon döngüsü (Lerp - 60/120fps)
        function renderCursorRing() {
            if (isInitialized) {
                const ease = 0.22;
                ringX += (mouseX - ringX) * ease;
                ringY += (mouseY - ringY) * ease;
                cursorRing.style.left = `${ringX}px`;
                cursorRing.style.top = `${ringY}px`;
            }
            requestAnimationFrame(renderCursorRing);
        }

        requestAnimationFrame(renderCursorRing);
    }

    initCustomCursor();
});
