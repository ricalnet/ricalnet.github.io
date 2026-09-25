(function () {
  'use strict';

  const PGP_FINGERPRINT = '45688382B815821F033115B8D92D6A10D29C8380';
  const MAX_HISTORY = 40;

  AOS.init({
    once: true,
    offset: 30,
    easing: 'ease-out-expo',
    duration: 900,
    disable: window.innerWidth < 768 ? true : false,
  });

  function showToast(message, isError) {
    const existing = document.querySelector('.wb-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'wb-toast fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-full text-sm shadow-2xl border border-tor-violet/30 z-[9999] transition-all duration-300 opacity-0 translate-y-4';
    t.innerHTML = `<i class="fas ${isError ? 'fa-circle-exclamation text-red-400' : 'fa-check-circle text-tor-accent'} mr-2"></i> ${message}`;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.remove('opacity-0', 'translate-y-4'));
    setTimeout(() => {
      t.classList.add('opacity-0', 'translate-y-4');
      setTimeout(() => t.remove(), 300);
    }, 2200);
  }

  window.copyPGP = function () {
    navigator.clipboard.writeText(PGP_FINGERPRINT).then(() => {
      showToast('PGP fingerprint copied!');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = PGP_FINGERPRINT;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('PGP fingerprint copied!');
    });
  };

  const canvas = document.getElementById('whiteboard');
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  const canvasWrap = document.getElementById('canvas-wrap');

  const els = {
    toolStatus: document.getElementById('tool-status'),
    sizeStatus: document.getElementById('size-status'),
    colorStatus: document.getElementById('color-status'),
    coordStatus: document.getElementById('coord-status'),
    stepCount: document.getElementById('step-count'),
    canvasSize: document.getElementById('canvas-size'),
    undoBtn: document.getElementById('undo-btn'),
    redoBtn: document.getElementById('redo-btn'),
    clearBtn: document.getElementById('clear-btn'),
    exportPng: document.getElementById('export-png'),
    exportJpg: document.getElementById('export-jpg'),
    penColor: document.getElementById('pen-color'),
  };

  const state = {
    tool: 'pen',
    color: '#0f0e1a',
    size: 2,
    isDrawing: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    history: [],
    historyIndex: -1,
    preShapeSnapshot: null,
  };

  function initCanvas() {
    canvas.width = 1000;
    canvas.height = 600;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    els.canvasSize.textContent = `${canvas.width} × ${canvas.height}`;
  }

  function snapshot() {
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  function pushHistory() {
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(snapshot());
    if (state.history.length > MAX_HISTORY) {
      state.history.shift();
    }
    state.historyIndex = state.history.length - 1;
    updateHistoryUI();
  }

  function restoreSnapshot(imageData) {
    ctx.putImageData(imageData, 0, 0);
  }

  function undo() {
    if (state.historyIndex <= 0) {
      showToast('Nothing to undo');
      return;
    }
    state.historyIndex--;
    restoreSnapshot(state.history[state.historyIndex]);
    updateHistoryUI();
  }

  function redo() {
    if (state.historyIndex >= state.history.length - 1) {
      showToast('Nothing to redo');
      return;
    }
    state.historyIndex++;
    restoreSnapshot(state.history[state.historyIndex]);
    updateHistoryUI();
  }

  function updateHistoryUI() {
    els.stepCount.textContent = state.historyIndex + 1;
    els.undoBtn.disabled = state.historyIndex <= 0;
    els.redoBtn.disabled = state.historyIndex >= state.history.length - 1;
  }

  function getCoords(e) {
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

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return {
      x: Math.max(0, Math.min(canvas.width, x)),
      y: Math.max(0, Math.min(canvas.height, y))
    };
  }

  function updateCoordStatus(x, y) {
    els.coordStatus.textContent = `${Math.round(x)}, ${Math.round(y)}`;
  }

  function drawShape(x1, y1, x2, y2) {
    ctx.save();
    ctx.strokeStyle = state.color;
    ctx.lineWidth = state.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (state.tool === 'line') {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (state.tool === 'rect') {
      const w = x2 - x1;
      const h = y2 - y1;
      ctx.beginPath();
      ctx.rect(x1, y1, w, h);
      ctx.stroke();
    } else if (state.tool === 'circle') {
      const radius = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      ctx.beginPath();
      ctx.arc(x1, y1, Math.max(1, radius), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function pointerDown(e) {
    e.preventDefault();
    state.isDrawing = true;
    const pos = getCoords(e);
    state.startX = pos.x;
    state.startY = pos.y;
    state.lastX = pos.x;
    state.lastY = pos.y;

    if (state.tool !== 'pen' && state.tool !== 'eraser') {
      state.preShapeSnapshot = snapshot();
    } else {
      ctx.save();
      ctx.fillStyle = state.tool === 'eraser' ? '#ffffff' : state.color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, state.size / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function pointerMove(e) {
    const pos = getCoords(e);
    updateCoordStatus(pos.x, pos.y);
    if (!state.isDrawing) return;
    e.preventDefault();

    if (state.tool === 'pen' || state.tool === 'eraser') {
      ctx.save();
      ctx.strokeStyle = state.tool === 'eraser' ? '#ffffff' : state.color;
      ctx.lineWidth = state.size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(state.lastX, state.lastY);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.restore();
      state.lastX = pos.x;
      state.lastY = pos.y;
    } else {
      if (state.preShapeSnapshot) {
        restoreSnapshot(state.preShapeSnapshot);
      }
      drawShape(state.startX, state.startY, pos.x, pos.y);
    }
  }

  function pointerUp(e) {
    if (!state.isDrawing) return;
    state.isDrawing = false;

    if (state.tool === 'pen' || state.tool === 'eraser') {
      pushHistory();
    } else if (state.preShapeSnapshot) {
      state.preShapeSnapshot = null;
      pushHistory();
    }
  }

  canvas.addEventListener('mousedown', pointerDown);
  canvas.addEventListener('mousemove', pointerMove);
  canvas.addEventListener('mouseup', pointerUp);
  canvas.addEventListener('mouseleave', (e) => {
    if (state.isDrawing) pointerUp(e);
  });

  canvas.addEventListener('touchstart', pointerDown, { passive: false });
  canvas.addEventListener('touchmove', pointerMove, { passive: false });
  canvas.addEventListener('touchend', pointerUp, { passive: false });
  canvas.addEventListener('touchcancel', pointerUp, { passive: false });

  const toolBtns = document.querySelectorAll('[data-tool]');
  const toolLabels = { pen: 'Pen', eraser: 'Eraser', line: 'Line', rect: 'Rectangle', circle: 'Circle' };

  function selectTool(tool) {
    state.tool = tool;
    toolBtns.forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    els.toolStatus.textContent = toolLabels[tool] || tool;
    canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
  }

  toolBtns.forEach(btn => {
    btn.addEventListener('click', () => selectTool(btn.dataset.tool));
  });

  const colorPresets = document.querySelectorAll('.wb-color-preset');

  function setColor(color) {
    state.color = color;
    els.penColor.value = color;
    els.colorStatus.style.background = color;
    colorPresets.forEach(p => {
      p.classList.toggle('active', p.dataset.color.toLowerCase() === color.toLowerCase());
    });
  }

  els.penColor.addEventListener('input', () => {
    state.color = els.penColor.value;
    els.colorStatus.style.background = state.color;
    colorPresets.forEach(p => p.classList.remove('active'));
  });

  colorPresets.forEach(btn => {
    btn.addEventListener('click', () => setColor(btn.dataset.color));
  });

  const sizeBtns = document.querySelectorAll('.wb-size-btn');
  sizeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sizeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.size = parseInt(btn.dataset.size, 10);
      els.sizeStatus.textContent = state.size;
    });
  });

  els.undoBtn.addEventListener('click', undo);
  els.redoBtn.addEventListener('click', redo);

  els.clearBtn.addEventListener('click', () => {
    if (!confirm('Clear the entire canvas?')) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    pushHistory();
    showToast('Canvas cleared');
  });

  function downloadCanvas(type, ext, quality) {
    const filename = `whiteboard_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
    const dataUrl = type === 'image/jpeg'
      ? canvas.toDataURL('image/jpeg', quality)
      : canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Exported as ${ext.toUpperCase()}`);
  }

  els.exportPng.addEventListener('click', () => downloadCanvas('image/png', 'png'));
  els.exportJpg.addEventListener('click', () => downloadCanvas('image/jpeg', 'jpg', 0.95));

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    const key = e.key.toLowerCase();

    if ((e.ctrlKey || e.metaKey) && key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    } else if ((e.ctrlKey || e.metaKey) && (key === 'y' || (key === 'z' && e.shiftKey))) {
      e.preventDefault();
      redo();
    } else if (key === 'p') {
      e.preventDefault();
      selectTool('pen');
    } else if (key === 'e') {
      e.preventDefault();
      selectTool('eraser');
    } else if (key === 'l') {
      e.preventDefault();
      selectTool('line');
    } else if (key === 'r') {
      e.preventDefault();
      selectTool('rect');
    } else if (key === 'o') {
      e.preventDefault();
      selectTool('circle');
    } else if (key === 'c') {
      e.preventDefault();
      els.clearBtn.click();
    }
  });

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  function init() {
    initCanvas();
    setColor('#0f0e1a');
    selectTool('pen');
    state.history = [];
    state.historyIndex = -1;
    pushHistory();
  }

  init();

})();