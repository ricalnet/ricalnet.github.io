(function () {
  'use strict';

  const PGP_FINGERPRINT = '45688382B815821F033115B8D92D6A10D29C8380';
  const MAX_DECODE_FILE_SIZE = 10 * 1024 * 1024;

  AOS.init({
    once: true,
    offset: 30,
    easing: 'ease-out-expo',
    duration: 900,
    disable: window.innerWidth < 768 ? true : false,
  });

  function showToast(message, isError) {
    const existing = document.querySelector('.qr-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'qr-toast fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-full text-sm shadow-2xl border border-tor-violet/30 z-[9999] transition-all duration-300 opacity-0 translate-y-4';
    t.innerHTML = `<i class="fas ${isError ? 'fa-circle-exclamation text-red-400' : 'fa-check-circle text-tor-accent'} mr-2"></i> ${message}`;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.remove('opacity-0', 'translate-y-4'));
    setTimeout(() => {
      t.classList.add('opacity-0', 'translate-y-4');
      setTimeout(() => t.remove(), 300);
    }, 2500);
  }

  function copyToClipboard(text, silent) {
    if (!text) {
      if (!silent) showToast('Nothing to copy.', true);
      return Promise.reject();
    }
    return navigator.clipboard.writeText(text).then(() => {
      if (!silent) showToast('Copied to clipboard!');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      if (!silent) showToast('Copied to clipboard!');
    });
  }

  window.copyPGP = function () {
    copyToClipboard(PGP_FINGERPRINT);
  };

  const $ = (id) => document.getElementById(id);

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function formatBytes(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(2) + ' MB';
  }

  const tabButtons = document.querySelectorAll('.qr-tab-btn');
  const tabPanels = {
    generate: $('tab-generate'),
    read: $('tab-read'),
  };

  function switchTab(tabId) {
    tabButtons.forEach(btn => {
      const active = btn.dataset.tab === tabId;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    Object.keys(tabPanels).forEach(key => {
      tabPanels[key].classList.toggle('active', key === tabId);
    });
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  const genDom = {
    text: $('qr-text'),
    charCount: $('qr-char-count'),
    size: $('qr-size'),
    sizeDisplay: $('qr-size-display'),
    fg: $('qr-fg'),
    bg: $('qr-bg'),
    ec: $('qr-ec'),
    margin: $('qr-margin'),
    marginDisplay: $('qr-margin-display'),
    generateBtn: $('qr-generate-btn'),
    downloadBtn: $('qr-download-btn'),
    copyImgBtn: $('qr-copy-img-btn'),
    display: $('qrcode'),
    placeholder: $('qr-placeholder'),
    container: $('qr-display'),
    info: $('qr-info'),
    infoChars: $('qr-info-chars'),
    infoSize: $('qr-info-size'),
    infoEc: $('qr-info-ec'),
    infoVersion: $('qr-info-version'),
    advancedToggle: $('qr-advanced-toggle'),
    advancedPanel: $('qr-advanced-panel'),
  };

  let qrInstance = null;
  let currentQrDataUrl = null;

  const ecMap = {
    'L': QRCode.CorrectLevel.L,
    'M': QRCode.CorrectLevel.M,
    'Q': QRCode.CorrectLevel.Q,
    'H': QRCode.CorrectLevel.H
  };

  function updateRangeFill(el, min, max) {
    const pct = ((parseFloat(el.value) - min) / (max - min)) * 100;
    el.style.setProperty('--range-fill', pct + '%');
  }

  function updateCharCount() {
    const len = genDom.text.value.length;
    genDom.charCount.textContent = `(${len} chars)`;
  }

  genDom.text.addEventListener('input', () => {
    updateCharCount();
    clearTimeout(genDom._debounce);
    genDom._debounce = setTimeout(() => {
      if (genDom.text.value.trim()) generateQR(true);
    }, 500);
  });

  genDom.size.addEventListener('input', () => {
    genDom.sizeDisplay.textContent = genDom.size.value;
    updateRangeFill(genDom.size, 100, 1024);
    if (genDom.text.value.trim()) {
      clearTimeout(genDom._sizeDebounce);
      genDom._sizeDebounce = setTimeout(() => generateQR(true), 200);
    }
  });

  genDom.margin.addEventListener('input', () => {
    genDom.marginDisplay.textContent = genDom.margin.value;
    updateRangeFill(genDom.margin, 0, 10);
    if (genDom.text.value.trim()) {
      clearTimeout(genDom._marginDebounce);
      genDom._marginDebounce = setTimeout(() => generateQR(true), 200);
    }
  });

  genDom.fg.addEventListener('input', () => {
    if (genDom.text.value.trim()) generateQR(true);
  });

  genDom.bg.addEventListener('input', () => {
    if (genDom.text.value.trim()) generateQR(true);
  });

  genDom.ec.addEventListener('change', () => {
    if (genDom.text.value.trim()) generateQR(true);
  });

  genDom.advancedToggle.addEventListener('click', () => {
    const isOpen = genDom.advancedPanel.classList.toggle('open');
    genDom.advancedToggle.classList.toggle('open', isOpen);
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      genDom.fg.value = btn.dataset.fg;
      genDom.bg.value = btn.dataset.bg;
      if (genDom.text.value.trim()) generateQR(true);
    });
  });

  document.querySelectorAll('.sample-text-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      genDom.text.value = btn.dataset.text;
      updateCharCount();
      generateQR();
    });
  });

  function generateQR(silent) {
    const text = genDom.text.value.trim();
    if (!text) {
      if (!silent) showToast('Please enter text or a URL to encode.', true);
      return;
    }

    const size = parseInt(genDom.size.value, 10) || 256;
    const fg = genDom.fg.value;
    const bg = genDom.bg.value;
    const ecLevel = genDom.ec.value;
    const margin = parseInt(genDom.margin.value, 10) || 0;

    genDom.display.innerHTML = '';
    genDom.placeholder.classList.add('hidden');

    try {
      qrInstance = new QRCode(genDom.display, {
        text: text,
        width: size,
        height: size,
        colorDark: fg,
        colorLight: bg,
        correctLevel: ecMap[ecLevel] || QRCode.CorrectLevel.M,
      });

      const canvas = genDom.display.querySelector('canvas');
      const img = genDom.display.querySelector('img');

      if (canvas && img) {
        img.remove();
      }

      if (canvas) {
        if (margin > 0) {
          const moduleSize = canvas.width / (canvas.width / 8);
          const padCanvas = document.createElement('canvas');
          const pad = Math.round((canvas.width / 25) * margin);
          padCanvas.width = canvas.width + pad * 2;
          padCanvas.height = canvas.height + pad * 2;
          const pctx = padCanvas.getContext('2d');
          pctx.fillStyle = bg;
          pctx.fillRect(0, 0, padCanvas.width, padCanvas.height);
          pctx.drawImage(canvas, pad, pad);

          genDom.display.innerHTML = '';
          genDom.display.appendChild(padCanvas);
          currentQrDataUrl = padCanvas.toDataURL('image/png');
        } else {
          currentQrDataUrl = canvas.toDataURL('image/png');
        }
      } else if (img) {
        currentQrDataUrl = img.src;
      }

      genDom.container.classList.add('has-qr');

      genDom.info.classList.remove('hidden');
      genDom.infoChars.textContent = text.length;
      genDom.infoSize.textContent = size + '×' + size;
      genDom.infoEc.textContent = ecLevel;
      const estimatedVersion = Math.max(1, Math.min(40, Math.ceil(text.length / 10)));
      genDom.infoVersion.textContent = estimatedVersion;

      genDom.downloadBtn.disabled = false;
      genDom.copyImgBtn.disabled = false;

      if (!silent) showToast('QR code generated!');

    } catch (err) {
      console.error('QR generation error:', err);
      if (!silent) showToast('Error: ' + err.message + ' (data may be too long)', true);
      genDom.placeholder.classList.remove('hidden');
      genDom.container.classList.remove('has-qr');
      genDom.info.classList.add('hidden');
      currentQrDataUrl = null;
      genDom.downloadBtn.disabled = true;
      genDom.copyImgBtn.disabled = true;
    }
  }

  genDom.generateBtn.addEventListener('click', () => generateQR(false));

  genDom.text.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      generateQR(false);
    }
  });

  genDom.downloadBtn.addEventListener('click', () => {
    if (!currentQrDataUrl) {
      showToast('Generate a QR code first.', true);
      return;
    }
    const link = document.createElement('a');
    link.download = `qrcode_${Date.now()}.png`;
    link.href = currentQrDataUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded as PNG.');
  });

  genDom.copyImgBtn.addEventListener('click', async () => {
    if (!currentQrDataUrl) {
      showToast('Generate a QR code first.', true);
      return;
    }
    try {
      const res = await fetch(currentQrDataUrl);
      const blob = await res.blob();
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        showToast('QR image copied to clipboard!');
      } else {
        throw new Error('Clipboard image API not supported');
      }
    } catch (err) {
      console.warn('Copy image error:', err);
      copyToClipboard(genDom.text.value.trim());
    }
  });

  const readDom = {
    dropZone: $('qr-drop-zone'),
    fileInput: $('qr-file-input'),
    previewContainer: $('qr-preview-container'),
    preview: $('qr-preview'),
    decodeBtn: $('qr-decode-btn'),
    clearBtn: $('qr-clear-btn'),
    resultPlaceholder: $('qr-result-placeholder'),
    resultContent: $('qr-result-content'),
    resultText: $('qr-result-text'),
    resultChars: $('qr-result-chars'),
    resultLoc: $('qr-result-loc'),
    resultType: $('qr-type-label'),
    resultError: $('qr-result-error'),
    errorMsg: $('qr-error-msg'),
    copyBtn: $('qr-result-copy'),
    openBtn: $('qr-result-open'),
  };

  let currentFileData = null;
  let currentDecodedText = '';

  function detectQRType(text) {
    if (/^https?:\/\//i.test(text)) return { label: 'URL', icon: 'fa-link', openable: true };
    if (/^mailto:/i.test(text)) return { label: 'Email', icon: 'fa-envelope', openable: true };
    if (/^tel:/i.test(text)) return { label: 'Phone', icon: 'fa-phone', openable: true };
    if (/^sms:/i.test(text)) return { label: 'SMS', icon: 'fa-comment-sms', openable: true };
    if (/^WIFI:/i.test(text)) return { label: 'Wi‑Fi', icon: 'fa-wifi', openable: false };
    if (/^BEGIN:VCARD/i.test(text)) return { label: 'Contact (vCard)', icon: 'fa-address-card', openable: false };
    if (/^BEGIN:VEVENT/i.test(text)) return { label: 'Calendar Event', icon: 'fa-calendar', openable: false };
    if (/^geo:/i.test(text)) return { label: 'Geo Location', icon: 'fa-map-pin', openable: true };
    if (/^bitcoin:/i.test(text)) return { label: 'Bitcoin', icon: 'fa-bitcoin-sign', openable: false };
    if (/^ethereum:/i.test(text)) return { label: 'Ethereum', icon: 'fa-ethereum', openable: false };
    if (/^otpauth:/i.test(text)) return { label: '2FA (OTP)', icon: 'fa-key', openable: false };
    return { label: 'Text', icon: 'fa-font', openable: false };
  }

  function resetRead() {
    currentFileData = null;
    currentDecodedText = '';
    readDom.fileInput.value = '';
    readDom.preview.src = '';
    readDom.previewContainer.classList.add('hidden');
    readDom.decodeBtn.disabled = true;
    readDom.clearBtn.disabled = true;
    readDom.resultPlaceholder.classList.remove('hidden');
    readDom.resultContent.classList.add('hidden');
    readDom.resultError.classList.add('hidden');
  }

  function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file.', true);
      return;
    }
    if (file.size > MAX_DECODE_FILE_SIZE) {
      showToast(`File too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_DECODE_FILE_SIZE)}.`, true);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      currentFileData = e.target.result;
      readDom.preview.src = currentFileData;
      readDom.previewContainer.classList.remove('hidden');
      readDom.decodeBtn.disabled = false;
      readDom.clearBtn.disabled = false;
      readDom.resultContent.classList.add('hidden');
      readDom.resultError.classList.add('hidden');
      readDom.resultPlaceholder.classList.remove('hidden');
    };
    reader.onerror = () => showToast('Error reading file.', true);
    reader.readAsDataURL(file);
  }

  readDom.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    readDom.dropZone.classList.add('dragover');
  });
  readDom.dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    readDom.dropZone.classList.remove('dragover');
  });
  readDom.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    readDom.dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
  });
  readDom.dropZone.addEventListener('click', () => readDom.fileInput.click());

  readDom.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
    e.target.value = '';
  });

  document.addEventListener('paste', (e) => {
    if (!tabPanels.read.classList.contains('active')) return;
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) handleFile(file);
        return;
      }
    }
  });

  readDom.clearBtn.addEventListener('click', () => {
    resetRead();
    showToast('Cleared.');
  });

  readDom.decodeBtn.addEventListener('click', () => {
    if (!currentFileData) {
      showToast('Please upload an image first.', true);
      return;
    }

    readDom.decodeBtn.disabled = true;
    readDom.decodeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Decoding…';

    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        let code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth'
        });

        if (!code && canvas.width < 500) {
          const scale = 2;
          const bigCanvas = document.createElement('canvas');
          bigCanvas.width = canvas.width * scale;
          bigCanvas.height = canvas.height * scale;
          const bctx = bigCanvas.getContext('2d');
          bctx.imageSmoothingEnabled = false;
          bctx.drawImage(canvas, 0, 0, bigCanvas.width, bigCanvas.height);
          const bigData = bctx.getImageData(0, 0, bigCanvas.width, bigCanvas.height);
          code = jsQR(bigData.data, bigData.width, bigData.height, {
            inversionAttempts: 'attemptBoth'
          });
        }

        if (code && code.data) {
          currentDecodedText = code.data;
          readDom.resultPlaceholder.classList.add('hidden');
          readDom.resultError.classList.add('hidden');
          readDom.resultContent.classList.remove('hidden');
          readDom.resultText.textContent = code.data;
          readDom.resultChars.textContent = code.data.length;

          const type = detectQRType(code.data);
          readDom.resultType.innerHTML = `<i class="fas ${type.icon}"></i> ${type.label}`;
          readDom.openBtn.classList.toggle('hidden', !type.openable);

          if (code.location) {
            readDom.resultLoc.textContent = `(${code.location.topLeftCorner.x}, ${code.location.topLeftCorner.y}) → (${code.location.bottomRightCorner.x}, ${code.location.bottomRightCorner.y})`;
          } else {
            readDom.resultLoc.textContent = '—';
          }

          showToast('QR code decoded successfully!');
        } else {
          readDom.resultPlaceholder.classList.add('hidden');
          readDom.resultContent.classList.add('hidden');
          readDom.resultError.classList.remove('hidden');
          readDom.errorMsg.textContent = 'No QR code found in the image. Try a clearer image, or crop tighter around the QR code.';
        }
      } catch (err) {
        console.error('Decode error:', err);
        readDom.resultPlaceholder.classList.add('hidden');
        readDom.resultContent.classList.add('hidden');
        readDom.resultError.classList.remove('hidden');
        readDom.errorMsg.textContent = 'Error decoding image: ' + err.message;
      } finally {
        readDom.decodeBtn.disabled = false;
        readDom.decodeBtn.innerHTML = '<i class="fas fa-qrcode"></i> Decode QR Code';
      }
    };

    img.onerror = () => {
      showToast('Error loading image for decoding.', true);
      readDom.decodeBtn.disabled = false;
      readDom.decodeBtn.innerHTML = '<i class="fas fa-qrcode"></i> Decode QR Code';
    };

    img.src = currentFileData;
  });

  readDom.copyBtn.addEventListener('click', () => {
    if (!currentDecodedText) return;
    copyToClipboard(currentDecodedText, true).then(() => {
      readDom.copyBtn.classList.add('copied');
      setTimeout(() => readDom.copyBtn.classList.remove('copied'), 2000);
      showToast('Copied decoded text!');
    });
  });

  readDom.openBtn.addEventListener('click', () => {
    if (!currentDecodedText) return;
    const type = detectQRType(currentDecodedText);
    if (type.openable) {
      window.open(currentDecodedText, '_blank', 'noopener,noreferrer');
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#' || href.length < 2) return;
      e.preventDefault();
      const t = document.querySelector(href);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  function init() {
    updateCharCount();
    updateRangeFill(genDom.size, 100, 1024);
    updateRangeFill(genDom.margin, 0, 10);

    setTimeout(() => {
      if (genDom.text.value.trim()) {
        generateQR(true);
      }
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();