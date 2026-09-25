(function() {
  'use strict';

  const workspace = document.getElementById('workspace');
  const placeholder = document.getElementById('uploadPlaceholder');
  const canvasWrap = document.getElementById('canvasWrap');
  const canvas = document.getElementById('censorCanvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const fileInput = document.getElementById('fileInput');
  const uploadBtn = document.getElementById('uploadBtn');
  const pasteBtn = document.getElementById('pasteBtn');
  const resetBtn = document.getElementById('resetBtn');
  const undoBtn = document.getElementById('undoBtn');
  const modeBtns = document.querySelectorAll('.censor-mode-btn');
  const sizeSlider = document.getElementById('sizeSlider');
  const sizeValue = document.getElementById('sizeValue');
  const solidColor = document.getElementById('solidColor');
  const colorHex = document.getElementById('colorHex');
  const historyList = document.getElementById('historyList');
  const progressBar = document.getElementById('progressBar');

  const statDimensions = document.getElementById('statDimensions');
  const statRedactions = document.getElementById('statRedactions');
  const statFileSize = document.getElementById('statFileSize');
  const statFormat = document.getElementById('statFormat');

  const downloadPng = document.getElementById('downloadPng');
  const downloadJpg = document.getElementById('downloadJpg');
  const downloadWebp = document.getElementById('downloadWebp');

  let originalImage = null;
  let currentMode = 'pixelate';
  let currentSize = 12;
  let currentColor = '#0f0e1a';
  let editHistory = [];
  let isDrawing = false;
  let startX = 0, startY = 0;
  let selectionRect = null;
  let hasImage = false;
  let fileName = '';
  let originalFileSize = 0;
  let originalFormat = '';
  let overlayEl = null;

  AOS.init({
    once: true,
    offset: 30,
    easing: 'ease-out-expo',
    duration: 900,
    disable: window.innerWidth < 768 ? true : false,
  });

  function showToast(message, isError) {
    const existing = document.querySelector('.censor-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'censor-toast hidden-toast' + (isError ? ' error' : '');
    toast.innerHTML = `<i class="fas ${isError ? 'fa-circle-exclamation' : 'fa-check-circle'}"></i> ${message}`;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove('hidden-toast');
    });

    setTimeout(() => {
      toast.classList.add('hidden-toast');
      setTimeout(() => toast.remove(), 350);
    }, 2200);
  }

  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function updateStats() {
    if (!hasImage || !originalImage) {
      statDimensions.textContent = '—';
      statRedactions.textContent = '0';
      statFileSize.textContent = '—';
      statFormat.textContent = '—';
      return;
    }
    statDimensions.textContent = originalImage.naturalWidth + ' × ' + originalImage.naturalHeight;
    statRedactions.textContent = editHistory.length;
    statFileSize.textContent = formatBytes(originalFileSize);
    statFormat.textContent = originalFormat || 'PNG';
  }

  function updateHistoryList() {
    historyList.innerHTML = '';
    if (editHistory.length === 0) {
      historyList.innerHTML = '<span class="text-[0.6rem] text-text-muted italic">No edits yet</span>';
      undoBtn.disabled = true;
      return;
    }
    editHistory.forEach((edit, i) => {
      const chip = document.createElement('span');
      chip.className = 'censor-history-item';
      const iconMap = { pixelate: 'fa-square', blur: 'fa-droplet', solid: 'fa-fill-drip' };
      chip.innerHTML = `<i class="fas ${iconMap[edit.mode] || 'fa-edit'}"></i> ${edit.mode}`;
      chip.title = `Edit ${i + 1}: ${edit.mode}, size ${edit.size}px`;
      historyList.appendChild(chip);
    });
    undoBtn.disabled = false;
  }

  function updateProgress() {
    const maxEdits = 20;
    const pct = Math.min((editHistory.length / maxEdits) * 100, 100);
    progressBar.style.width = pct + '%';
  }

  function updateModeButtons() {
    modeBtns.forEach(btn => {
      const isActive = btn.dataset.mode === currentMode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });
  }

  function updateSizeSliderFill() {
    const pct = ((currentSize - 4) / (48 - 4)) * 100;
    sizeSlider.style.setProperty('--slider-fill', pct + '%');
    sizeValue.textContent = currentSize;
  }

  function renderCanvas() {
    if (!originalImage) return;

    canvas.width = originalImage.naturalWidth;
    canvas.height = originalImage.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(originalImage, 0, 0);

    for (const edit of editHistory) {
      applyRedaction(edit);
    }
  }

  function applyRedaction(edit) {
    const { mode, size, color, x, y, w, h } = edit;

    const sx = Math.max(0, Math.round(x));
    const sy = Math.max(0, Math.round(y));
    const sw = Math.min(Math.round(w), canvas.width - sx);
    const sh = Math.min(Math.round(h), canvas.height - sy);

    if (sw <= 0 || sh <= 0) return;

    if (mode === 'solid') {
      ctx.save();
      ctx.fillStyle = color || '#0f0e1a';
      ctx.fillRect(sx, sy, sw, sh);
      ctx.restore();
    } else if (mode === 'pixelate') {
      const blockSize = Math.max(2, Math.floor(size));

      const imageData = ctx.getImageData(sx, sy, sw, sh);
      const data = imageData.data;

      const cols = Math.ceil(sw / blockSize);
      const rows = Math.ceil(sh / blockSize);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const bx = col * blockSize;
          const by = row * blockSize;
          const bw = Math.min(blockSize, sw - bx);
          const bh = Math.min(blockSize, sh - by);

          let r = 0, g = 0, b = 0, a = 0, count = 0;

          for (let dy = 0; dy < bh; dy++) {
            for (let dx = 0; dx < bw; dx++) {
              const idx = ((by + dy) * sw + (bx + dx)) * 4;
              r += data[idx];
              g += data[idx + 1];
              b += data[idx + 2];
              a += data[idx + 3];
              count++;
            }
          }

          if (count === 0) continue;
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          a = Math.round(a / count);

          for (let dy = 0; dy < bh; dy++) {
            for (let dx = 0; dx < bw; dx++) {
              const idx = ((by + dy) * sw + (bx + dx)) * 4;
              data[idx] = r;
              data[idx + 1] = g;
              data[idx + 2] = b;
              data[idx + 3] = a;
            }
          }
        }
      }

      ctx.putImageData(imageData, sx, sy);
    } else if (mode === 'blur') {
      const imageData = ctx.getImageData(sx, sy, sw, sh);

      const tmpCanvas = document.createElement('canvas');
      tmpCanvas.width = sw;
      tmpCanvas.height = sh;
      const tmpCtx = tmpCanvas.getContext('2d');
      tmpCtx.putImageData(imageData, 0, 0);

      ctx.clearRect(sx, sy, sw, sh);
      ctx.save();
      ctx.filter = `blur(${Math.max(2, Math.floor(size / 2))}px)`;
      ctx.drawImage(tmpCanvas, sx, sy);
      ctx.restore();
    }
  }

  function loadImage(file) {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file.', true);
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      showToast('File too large. Maximum size is 20 MB.', true);
      return;
    }

    fileName = file.name;
    originalFileSize = file.size;
    originalFormat = file.type.split('/')[1].toUpperCase() || 'PNG';

    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        originalImage = img;
        editHistory = [];
        hasImage = true;

        placeholder.style.display = 'none';
        canvasWrap.classList.remove('hidden');
        workspace.classList.add('has-image');

        renderCanvas();
        updateStats();
        updateHistoryList();
        updateProgress();
        resetBtn.disabled = false;
        undoBtn.disabled = true;
        downloadPng.disabled = false;
        downloadJpg.disabled = false;
        downloadWebp.disabled = false;

        showToast('Image loaded — ' + img.naturalWidth + ' × ' + img.naturalHeight);
      };
      img.onerror = function() {
        showToast('Failed to load image. The file may be corrupted.', true);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function resetImage() {
    if (!originalImage) return;
    editHistory = [];
    renderCanvas();
    updateStats();
    updateHistoryList();
    updateProgress();
    undoBtn.disabled = true;
    removeOverlay();
    showToast('Reset to original image');
  }

  function undoLast() {
    if (editHistory.length === 0) return;
    editHistory.pop();
    renderCanvas();
    updateStats();
    updateHistoryList();
    updateProgress();
    removeOverlay();
    showToast('Undo — ' + editHistory.length + ' edit(s) remaining');
  }

  function downloadImage(format) {
    if (!hasImage || !canvas.width) return;

    const mimeMap = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };
    const extMap = { png: 'png', jpg: 'jpg', webp: 'webp' };

    const mime = mimeMap[format] || 'image/png';
    const ext = extMap[format] || 'png';

    canvas.toBlob(function(blob) {
      if (!blob) {
        showToast('Export failed. Try a different format.', true);
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'censored-' + (fileName.replace(/\.[^.]+$/, '') || 'image') + '.' + ext;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Downloaded as ' + ext.toUpperCase() + ' (' + formatBytes(blob.size) + ')');
    }, mime, format === 'jpg' ? 0.92 : undefined);
  }

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if (e.touches && e.touches.length) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;

    return {
      x: Math.max(0, Math.min(canvas.width, canvasX)),
      y: Math.max(0, Math.min(canvas.height, canvasY)),
      displayX: clientX - rect.left,
      displayY: clientY - rect.top,
      rect: rect,
      scaleX: scaleX,
      scaleY: scaleY
    };
  }

  function createOverlay(x, y, w, h, labelText) {
    if (!overlayEl) {
      overlayEl = document.createElement('div');
      overlayEl.className = 'selection-overlay';
      overlayEl.innerHTML = `
        <span class="handle tl"></span>
        <span class="handle tr"></span>
        <span class="handle bl"></span>
        <span class="handle br"></span>
      `;
      canvasWrap.appendChild(overlayEl);
    }

    overlayEl.style.left = x + 'px';
    overlayEl.style.top = y + 'px';
    overlayEl.style.width = w + 'px';
    overlayEl.style.height = h + 'px';
    overlayEl.style.display = 'block';

    let label = overlayEl.querySelector('.selection-label');
    if (!label) {
      label = document.createElement('span');
      label.className = 'selection-label';
      overlayEl.appendChild(label);
    }
    label.textContent = labelText || '';
  }

  function removeOverlay() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
  }

  canvas.addEventListener('pointerdown', function(e) {
    if (!hasImage) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);

    const coords = getCanvasCoords(e);
    isDrawing = true;
    startX = coords.x;
    startY = coords.y;
    selectionRect = null;
  });

  canvas.addEventListener('pointermove', function(e) {
    if (!isDrawing || !hasImage) return;
    e.preventDefault();

    const coords = getCanvasCoords(e);
    const curX = coords.x;
    const curY = coords.y;

    const x = Math.min(startX, curX);
    const y = Math.min(startY, curY);
    const w = Math.abs(curX - startX);
    const h = Math.abs(curY - startY);

    if (w < 2 || h < 2) return;

    selectionRect = { x, y, w, h };

    const displayX = x / coords.scaleX;
    const displayY = y / coords.scaleY;
    const displayW = w / coords.scaleX;
    const displayH = h / coords.scaleY;

    createOverlay(displayX, displayY, displayW, displayH,
      `${Math.round(w)} × ${Math.round(h)} px`);
  });

  canvas.addEventListener('pointerup', function(e) {
    if (!isDrawing || !hasImage) return;
    e.preventDefault();
    isDrawing = false;
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }

    removeOverlay();

    if (selectionRect && selectionRect.w >= 4 && selectionRect.h >= 4) {
      const edit = {
        mode: currentMode,
        size: currentSize,
        color: currentColor,
        x: selectionRect.x,
        y: selectionRect.y,
        w: selectionRect.w,
        h: selectionRect.h
      };

      editHistory.push(edit);
      renderCanvas();
      updateStats();
      updateHistoryList();
      updateProgress();
      undoBtn.disabled = false;

      const modeLabel = currentMode.charAt(0).toUpperCase() + currentMode.slice(1);
      showToast(modeLabel + ' applied at ' + Math.round(selectionRect.w) + '×' + Math.round(selectionRect.h) + 'px');
    }

    selectionRect = null;
  });

  canvas.addEventListener('pointercancel', function(e) {
    isDrawing = false;
    removeOverlay();
    selectionRect = null;
  });

  canvas.addEventListener('contextmenu', e => e.preventDefault());

  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', function() {
    if (this.files && this.files[0]) {
      loadImage(this.files[0]);
    }
    this.value = '';
  });

  placeholder.addEventListener('click', () => fileInput.click());

  workspace.addEventListener('dragover', function(e) {
    e.preventDefault();
    this.classList.add('dragover');
  });

  workspace.addEventListener('dragleave', function(e) {
    e.preventDefault();
    this.classList.remove('dragover');
  });

  workspace.addEventListener('drop', function(e) {
    e.preventDefault();
    this.classList.remove('dragover');

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadImage(e.dataTransfer.files[0]);
    } else if (e.dataTransfer.items && e.dataTransfer.items[0]) {
      const item = e.dataTransfer.items[0];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) loadImage(file);
      }
    }
  });

  pasteBtn.addEventListener('click', async function() {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const file = new File([blob], 'clipboard.png', { type });
            loadImage(file);
            return;
          }
        }
      }
      showToast('No image found in clipboard.', true);
    } catch (err) {
      showToast('Clipboard access denied. Use Ctrl+V or drag & drop.', true);
    }
  });

  document.addEventListener('paste', function(e) {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) loadImage(file);
        return;
      }
    }
  });

  modeBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      currentMode = this.dataset.mode;
      updateModeButtons();
    });
  });

  sizeSlider.addEventListener('input', function() {
    currentSize = parseInt(this.value);
    updateSizeSliderFill();
  });

  solidColor.addEventListener('input', function() {
    currentColor = this.value;
    colorHex.textContent = this.value;
  });

  resetBtn.addEventListener('click', resetImage);
  undoBtn.addEventListener('click', undoLast);
  downloadPng.addEventListener('click', () => downloadImage('png'));
  downloadJpg.addEventListener('click', () => downloadImage('jpg'));
  downloadWebp.addEventListener('click', () => downloadImage('webp'));

  document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (editHistory.length > 0) undoLast();
    }
  });

  const PGP_FINGERPRINT = '45688382B815821F033115B8D92D6A10D29C8380';
  window.copyPGP = function() {
    navigator.clipboard.writeText(PGP_FINGERPRINT).then(() => {
      showToast('PGP fingerprint copied!');
    }).catch(() => {
      const textArea = document.createElement('textarea');
      textArea.value = PGP_FINGERPRINT;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('PGP fingerprint copied!');
    });
  };

  window.toggleFaq = function(element) {
    const answer = element.nextElementSibling;
    const icon = element.querySelector('.faq-icon');
    const isOpen = answer.classList.contains('open');

    document.querySelectorAll('.faq-answer').forEach(el => {
      if (el !== answer) {
        el.classList.remove('open');
        el.previousElementSibling.querySelector('.faq-icon').classList.remove('open');
      }
    });

    if (isOpen) {
      answer.classList.remove('open');
      icon.classList.remove('open');
    } else {
      answer.classList.add('open');
      icon.classList.add('open');
    }
  };

  document.addEventListener('DOMContentLoaded', function() {
    const firstFaq = document.querySelector('.faq-answer');
    if (firstFaq) {
      firstFaq.classList.add('open');
      firstFaq.previousElementSibling.querySelector('.faq-icon').classList.add('open');
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  updateModeButtons();
  updateSizeSliderFill();
  colorHex.textContent = currentColor;

})();