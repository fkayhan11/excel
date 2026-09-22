document.addEventListener('DOMContentLoaded', () => {
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

    // Quota and modal DOM elements
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
    
    // Mode and multi-sheet selector elements
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

    // Status indicator element
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
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function initTheme() {
        const savedTheme = localStorage.getItem('asteria_theme') || 'light';
        applyTheme(savedTheme);
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('asteria_theme', theme);
        if (themeIcon) {
            if (theme === 'dark') {
                
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
    const MAX_QUOTA = 8; // Dakika başına güvenli işlem hakkı
    const MAX_SHEETS = 8; // Çoklu sayfada maksimum sayfa sayısı
    const WINDOW_DURATION = 60; // 60 saniyelik pencere

    // Load stored quota or initialize defaults
    function getStoredQuota() {
        const now = Math.floor(Date.now() / 1000);
        let resetTime = parseInt(localStorage.getItem('asteria_quota_reset_time') || '0', 10);
        let currentCount = parseInt(localStorage.getItem('asteria_quota_count'), 10);

        if (isNaN(currentCount) || now >= resetTime) {
            // Window expired: reset quota
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

        
        if (trackerRemainingText) trackerRemainingText.textContent = count;
        if (quotaTimerText) quotaTimerText.textContent = `${secondsRemaining} sn`;

        if (quotaProgressBar) {
            const percent = (count / MAX_QUOTA) * 100;
            quotaProgressBar.style.width = `${percent}%`;
        }

        
        quotaDots.forEach((dot, idx) => {
            dot.classList.remove('active');
            if (idx < count) {
                dot.classList.add('active');
            }
        });

        
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
                    quotaFooterDesc.textContent = `Google AI altyapısıyla dakikada en fazla 8 işlem / sayfa dönüştürülebilir.`;
                }
                if (!isCooldownActive && loader.style.display !== 'inline-block') {
                    btnSubmit.disabled = false;
                    btnText.innerHTML = `Görseli Excel'e Dönüştür <i class="fa-solid fa-wand-magic-sparkles"></i>`;
                }
            }
        }
    }

    // Periodic countdown timer
    setInterval(() => {
        const { count, secondsRemaining } = getStoredQuota();
        if (secondsRemaining <= 1 && count < MAX_QUOTA) {
            // Window expired: reset local quota counter
            saveQuota(MAX_QUOTA, WINDOW_DURATION);
            syncQuotaWithServer();
        } else {
            updateQuotaDisplay();
        }
    }, 1000);

    // Sync rate limit with backend
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
            // Fallback to local storage if endpoint is unreachable
        }
    }

    
    updateQuotaDisplay();
    syncQuotaWithServer();
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
    const processingModal = document.getElementById('processing-modal');
    const processingTitle = document.getElementById('processing-title');
    const processingDesc = document.getElementById('processing-desc');
    const processingStepText = document.getElementById('processing-step-text');
    const processingTimerText = document.getElementById('processing-timer-text');
    const processingTipText = document.getElementById('processing-tip-text');
    let processingTimerInterval = null;
    let processingStepInterval = null;
    let processingStartTime = 0;

    function showProcessingModal(sheetCount) {
        if (!processingModal) return;
        processingStartTime = Date.now();
        if (processingTimerText) processingTimerText.textContent = '0 sn';

        if (processingTitle) {
            processingTitle.textContent = sheetCount > 1 
                ? `${sheetCount} Sayfalı Tablonuz İşleniyor...` 
                : `Tablonuz Excel'e Dönüştürülüyor...`;
        }

        if (processingDesc) {
            processingDesc.textContent = sheetCount > 1
                ? `Yapay zeka ${sheetCount} ayrı sayfadaki tüm tabloları, hücre renklerini ve formülleri ayrıştırıyor. Lütfen sayfayı kapatmadan bekleyiniz.`
                : `Yapay zeka tablodaki satır, sütun ve sayısal verileri inceliyor. Lütfen bekleyiniz.`;
        }

        const dynamicSteps = sheetCount > 1 ? [
            "Sayfalar taranıyor ve yapay zeka modeline aktarılıyor...",
            "Çoklu sekmeler, sütun başlıkları ve tablolar tespit ediliyor...",
            "Hücre arka plan renkleri, kalın yazılar ve formatlar ayrıştırılıyor...",
            "Sayısal değerler ve para birimleri formüle uygun derleniyor...",
            "Çok sayfalı Excel (.xlsx) çalışma kitabı inşa ediliyor...",
            "Tüm sayfalar doğrulanıyor, son rötuşlar yapılıyor..."
        ] : [
            "Görsel taranıyor ve yapay zeka modeline aktarılıyor...",
            "Tablo ızgaraları ve sütun başlıkları tespit ediliyor...",
            "Hücre formatları, renkler ve sayılar ayrıştırılıyor...",
            "Excel (.xlsx) ve CSV dosyaları oluşturuluyor..."
        ];

        let currentStep = 0;
        if (processingStepText) processingStepText.textContent = dynamicSteps[0];

        if (processingStepInterval) clearInterval(processingStepInterval);
        processingStepInterval = setInterval(() => {
            currentStep = (currentStep + 1) % dynamicSteps.length;
            if (processingStepText) {
                processingStepText.textContent = dynamicSteps[currentStep];
            }
        }, 3200);

        if (processingTimerInterval) clearInterval(processingTimerInterval);
        processingTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - processingStartTime) / 1000);
            if (processingTimerText) processingTimerText.textContent = `${elapsed} sn`;

            if (processingTipText) {
                if (elapsed > 12 && sheetCount >= 4) {
                    processingTipText.textContent = `${sheetCount} sayfalık geniş dokümanlar paralel olarak işleniyor. Dosyanız kusursuz şekilde hazırlandıktan sonra otomatik olarak indirilecektir.`;
                } else if (elapsed > 20) {
                    processingTipText.textContent = `Model detaylı hücre analizi yapıyor. Sunucu yanıtı birazdan tamamlanacaktır, lütfen bekleyiniz...`;
                }
            }
        }, 1000);

        processingModal.classList.add('active');
        processingModal.setAttribute('aria-hidden', 'false');
    }

    function hideProcessingModal() {
        if (!processingModal) return;
        if (processingTimerInterval) clearInterval(processingTimerInterval);
        if (processingStepInterval) clearInterval(processingStepInterval);
        processingModal.classList.remove('active');
        processingModal.setAttribute('aria-hidden', 'true');
    }
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

    // Handle sheet count selection
    if (countChips) {
        countChips.forEach(chip => {
            chip.addEventListener('click', () => {
                const count = parseInt(chip.getAttribute('data-count'), 10);
                setSheetCount(count);
            });
        });
    }

    function setSheetCount(count) {
        if (count < 2 || count > MAX_SHEETS) return;
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
            if (sheets.length < MAX_SHEETS) {
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

        
        if (btnAddSheet) {
            btnAddSheet.style.display = sheets.length >= MAX_SHEETS ? 'none' : 'inline-flex';
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
                        ${sheet.base64 && sheet.base64.startsWith('data:image/') ? `<img src="${sheet.base64}" alt="Sayfa ${idx + 1}" />` : `<i class="fa-regular fa-file"></i>`}
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

            
            card.addEventListener('click', (ev) => {
                if (ev.target.closest('.sheet-order-arrows') || ev.target.closest('.sheet-btn-delete')) return;
                activeSheetIndex = idx;
                renderSheetNavigation();
                displayActiveSheet();
            });

            
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

            // Card drag-and-drop handling
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

    // Generate sample mock table data for testing
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

            
            ctx.fillStyle = headerColor;
            ctx.fillRect(10, 10, canvas.width - 20, 48);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 16px Inter, sans-serif';
            ctx.fillText(title, 25, 40);

            const startX = 25;
            const startY = 75;
            const colWidth = (canvas.width - 50) / headers.length;
            const rowHeight = 36;

            
            ctx.fillStyle = '#f1f5f9';
            ctx.fillRect(startX, startY, canvas.width - 50, rowHeight);
            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 13px Inter, sans-serif';
            headers.forEach((h, idx) => {
                ctx.fillText(h, startX + idx * colWidth + 8, startY + 23);
            });

            
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

    // Clipboard paste support
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
    async function compressImageFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const tempImg = new Image();
                tempImg.src = e.target.result;
                tempImg.onload = () => {
                    const MAX_DIMENSION = 2000;
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
                    // Fill white background to prevent transparent PNGs from becoming solid black in JPEG format
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(tempImg, 0, 0, width, height);
                    const base64 = canvas.toDataURL('image/jpeg', 0.88);
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
            
            if (incoming.length === 1) {
                const b64 = await compressImageFile(incoming[0]);
                sheets[activeSheetIndex] = { name: incoming[0].name, base64: b64 };
                if (!excelTargetInput.value.trim()) {
                    excelTargetInput.value = incoming[0].name.replace(/\.[^/.]+$/, "");
                }
                
                if (activeSheetIndex + 1 < sheets.length && !sheets[activeSheetIndex + 1].base64) {
                    activeSheetIndex++;
                }
            } else {
                
                let targetIdx = activeSheetIndex;
                for (let file of incoming) {
                    if (targetIdx >= sheets.length && sheets.length < MAX_SHEETS) {
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
    formExcel.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Check quota limit
        const quotaInfo = getStoredQuota();
        if (quotaInfo.count <= 0) {
            triggerErrorShake();
            showLimitModal(quotaInfo.secondsRemaining);
            return;
        }

        // Check cooldown state
        if (isCooldownActive) {
            triggerErrorShake();
            showResult('Lütfen önceki işlemin tamamlanmasını veya bekleme süresinin bitmesini bekleyin.', 'error');
            return;
        }

        // Validate selected files
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

        setLoadingState(true);
        showProcessingModal(imagesToConvert.length);
        let progressInterval;
        let wakeupTimeout;

        try {
            let targetName = excelTargetInput.value.trim() || 'tablo_verisi';
            // Sanitize target file name against path traversal, special characters, and quotes
            targetName = targetName.replace(/[\/\\:\*\?"<>\|]/g, '_').replace(/\.\./g, '_').trim();
            if (!targetName.toLowerCase().endsWith('.xlsx')) {
                targetName += '.xlsx';
            }

            const requestPayload = {
                images_base64: imagesToConvert,
                target_xlsx: targetName
            };

            // Progress step animation
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

            // Show limit modal on 429 response
            if (response.status === 429) {
                hideProcessingModal();
                const limitData = await response.json().catch(() => ({}));
                const retrySeconds = limitData.retry_after || 60;
                saveQuota(0, retrySeconds);
                triggerErrorShake();
                showLimitModal(retrySeconds, limitData.message);
                throw new Error(limitData.message || "Dakikalık kullanım sınırına ulaşıldı.");
            }

            if (response.status === 413) {
                hideProcessingModal();
                throw new Error("Görsel çok büyük. Sistemin 4.5 MB sınırı aşıldı.");
            }
            if (response.status === 504) {
                hideProcessingModal();
                throw new Error("Zaman aşımı: Tablo çok karmaşık olduğu için sunucu yanıt veremedi. Lütfen daha net ve küçük bir kesit yükleyin.");
            }
            if (!response.ok) {
                hideProcessingModal();
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `Sunucu hatası (Kod: ${response.status}).`);
            }

            const data = await response.json();
            hideProcessingModal();

            if (data.status === 'success' && data.excel_base64) {
                
                const updatedCount = typeof data.remaining_quota === 'number' ? data.remaining_quota : Math.max(0, quotaInfo.count - imagesToConvert.length);
                const retrySeconds = typeof data.retry_in === 'number' && data.retry_in > 0 ? data.retry_in : null;
                saveQuota(updatedCount, retrySeconds);

                // Trigger short cooldown between conversions
                startAntiSpamCooldown(2);

                // Create binary download URL
                const byteCharacters = atob(data.excel_base64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], {type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
                
                const downloadUrl = URL.createObjectURL(blob);
                const finalFileName = targetName;
                const safeDownloadName = escapeHtml(finalFileName);
                const sheetBadgeText = data.sheet_count > 1 ? ` (${data.sheet_count} Sayfalı Excel)` : '';
                
                
                const actionHtml = `
                    <div class="result-actions">
                        <a href="${downloadUrl}" class="btn-download" download="${safeDownloadName}">
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
                                                let bg = '';
                                                if (cell.bg_color && /^#[0-9a-fA-F]{6}$/.test(cell.bg_color) && cell.bg_color.toUpperCase() !== '#FFFFFF') {
                                                    bg = `background-color:${cell.bg_color};`;
                                                }
                                                const rawVal = cell.value !== undefined && cell.value !== null ? cell.value : '';
                                                return `<${tag} style="${isBold}${bg}">${escapeHtml(rawVal)}</${tag}>`;
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

                // Sheet preview tab switching
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

                
                const btnCsv = document.getElementById('btn-csv-download');
                if (btnCsv) {
                    btnCsv.addEventListener('click', () => {
                        downloadTableAsCsv(data.table_data, finalFileName, data.all_tables);
                    });
                }

                // Clipboard export (TSV format)
                const btnCopy = document.getElementById('btn-copy-table');
                if (btnCopy) {
                    btnCopy.addEventListener('click', () => {
                        let tsv = '';
                        const formatCellForTsv = (c) => {
                            let text = (c.value !== undefined && c.value !== null ? c.value.toString() : '').replace(/[\t\n\r]/g, ' ');
                            const trimmed = text.trim();
                            if (/^[=\+\-@\t\r|%]/.test(trimmed)) {
                                const numTest = trimmed.replace(/\s+/g, '').replace(',', '.');
                                if (isNaN(Number(numTest))) {
                                    text = "'" + text;
                                }
                            }
                            return text;
                        };
                        if (Array.isArray(data.all_tables) && data.all_tables.length > 1) {
                            tsv = data.all_tables.map((tbl, idx) => {
                                const header = `--- Sayfa ${idx + 1} ---`;
                                const rows = tbl.map(row => 
                                    row.map(formatCellForTsv).join('\t')
                                ).join('\n');
                                return `${header}\n${rows}`;
                            }).join('\n\n');
                        } else if (Array.isArray(data.table_data)) {
                            tsv = data.table_data.map(row => 
                                row.map(formatCellForTsv).join('\t')
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
            hideProcessingModal();
            clearInterval(progressInterval);
            clearTimeout(wakeupTimeout);
            progressTextNode.style.display = 'none';
            triggerErrorShake();
            
            let rawMsg = err.message || 'Bilinmeyen bir hata oluştu.';
            if (rawMsg === "Failed to fetch") rawMsg = "İnternet bağlantınızı veya sunucu durumunu kontrol edin.";
            const errorMsg = escapeHtml(rawMsg);

            showResult(`<strong><i class="fa-solid fa-circle-exclamation"></i> Bilgi:</strong> ${errorMsg}`, 'error');
        } finally {
            hideProcessingModal();
            setLoadingState(false);
        }
    });
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
                    // Prevent CSV/Formula Injection (DDE attacks in spreadsheet software)
                    const trimmed = val.trim();
                    if (/^[=\+\-@\t\r|%]/.test(trimmed)) {
                        const numTest = trimmed.replace(/\s+/g, '').replace(',', '.');
                        if (isNaN(Number(numTest))) {
                            val = "'" + val;
                        }
                    }
                    if (val.includes('"') || val.includes(';') || val.includes(',') || val.includes('\n') || val.includes('\r')) {
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
        const safeBaseName = (filename || 'tablo_verisi').replace(/[^a-zA-Z0-9_\-\u00C0-\u017F\s.]/g, '_');
        a.download = safeBaseName.replace(/\.xlsx$/i, '') + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
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
