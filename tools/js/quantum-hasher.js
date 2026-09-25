(function () {
  'use strict';

  const PGP_FINGERPRINT = '45688382B815821F033115B8D92D6A10D29C8380';
  const HISTORY_KEY = 'quantumHasherHistory';
  const MAX_HISTORY = 20;

  AOS.init({
    once: true,
    offset: 30,
    easing: 'ease-out-expo',
    duration: 900,
    disable: window.innerWidth < 768 ? true : false,
  });

  function showToast(message, isError) {
    const existing = document.querySelector('.qh-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'qh-toast fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-full text-sm shadow-2xl border border-tor-violet/30 z-[9999] transition-all duration-300 opacity-0 translate-y-4';
    t.innerHTML = `<i class="fas ${isError ? 'fa-circle-exclamation text-red-400' : 'fa-check-circle text-tor-accent'} mr-2"></i> ${message}`;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.remove('opacity-0', 'translate-y-4'));
    setTimeout(() => {
      t.classList.add('opacity-0', 'translate-y-4');
      setTimeout(() => t.remove(), 300);
    }, 2500);
  }

  function copyToClipboard(text, onSuccess) {
    if (!text) {
      showToast('Nothing to copy.', true);
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!');
      if (onSuccess) onSuccess();
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Copied to clipboard!');
      if (onSuccess) onSuccess();
    });
  }

  function downloadText(text, filename) {
    if (!text) {
      showToast('Nothing to download.', true);
      return;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  let hashFormat = 'lower';

  function applyFormat(hash) {
    if (!hash) return hash;
    return hashFormat === 'upper' ? hash.toUpperCase() : hash.toLowerCase();
  }

  const ALGORITHMS = {
    sha1: { label: 'SHA-1', fn: (input) => CryptoJS.SHA1(input).toString(CryptoJS.enc.Hex), hmac: (input, key) => CryptoJS.HmacSHA1(input, key).toString(CryptoJS.enc.Hex) },
    sha256: { label: 'SHA-256', fn: (input) => CryptoJS.SHA256(input).toString(CryptoJS.enc.Hex), hmac: (input, key) => CryptoJS.HmacSHA256(input, key).toString(CryptoJS.enc.Hex) },
    sha384: { label: 'SHA-384', fn: (input) => CryptoJS.SHA384(input).toString(CryptoJS.enc.Hex), hmac: (input, key) => CryptoJS.HmacSHA384(input, key).toString(CryptoJS.enc.Hex) },
    sha512: { label: 'SHA-512', fn: (input) => CryptoJS.SHA512(input).toString(CryptoJS.enc.Hex), hmac: (input, key) => CryptoJS.HmacSHA512(input, key).toString(CryptoJS.enc.Hex) },
    md5: { label: 'MD5', fn: (input) => CryptoJS.MD5(input).toString(CryptoJS.enc.Hex), hmac: (input, key) => CryptoJS.HmacMD5(input, key).toString(CryptoJS.enc.Hex) },
  };

  document.querySelectorAll('.format-toggle').forEach(toggle => {
    const btns = toggle.querySelectorAll('button');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        hashFormat = btn.dataset.format;
        refreshAllDisplayedHashes();
        if (document.getElementById('tab-compare').classList.contains('active')) {
          compareHashes();
        }
        showToast('Format: ' + (hashFormat === 'upper' ? 'UPPERCASE' : 'lowercase'));
      });
    });
  });

  const $ = (id) => document.getElementById(id);

  const hashRefs = {
    input: $('hash-input'),
    result: $('hash-result'),
    btn: $('hash-btn'),
    copyBtn: $('hash-copy-btn'),
    downloadBtn: $('hash-download-btn'),
    len: $('hash-len'),
    algLabel: $('hash-alg-label'),
    status: $('hash-status'),
    algBtns: document.querySelectorAll('#tab-hash .hash-alg-btn[data-alg]'),
    _lastRawHash: null,
  };

  const hmacRefs = {
    input: $('hmac-input'),
    key: $('hmac-key'),
    result: $('hmac-result'),
    btn: $('hmac-btn'),
    copyBtn: $('hmac-copy-btn'),
    downloadBtn: $('hmac-download-btn'),
    len: $('hmac-len'),
    algLabel: $('hmac-alg-label'),
    status: $('hmac-status'),
    algBtns: document.querySelectorAll('#tab-hmac .hash-alg-btn[data-hmac]'),
    _lastRawHash: null,
  };

  const verifyRefs = {
    modeFileBtn: $('verify-mode-file'),
    modeTextBtn: $('verify-mode-text'),
    fileZone: $('verify-file-zone'),
    fileInput: $('verify-file-input'),
    filePreview: $('verify-file-preview'),
    fileName: $('verify-file-name'),
    fileSize: $('verify-file-size'),
    fileClear: $('verify-file-clear'),
    textArea: $('verify-text-area'),
    textInput: $('verify-text-input'),
    expected: $('verify-expected'),
    verifyBtn: $('verify-btn'),
    calcBtn: $('verify-calc-btn'),
    status: $('verify-status'),
    computed: $('verify-computed'),
    expectedDisplay: $('verify-expected-display'),
    detail: $('verify-detail'),
    matchDetail: $('verify-match-detail'),
    mismatchDetail: $('verify-mismatch-detail'),
    algBtns: document.querySelectorAll('#tab-verify .hash-alg-btn[data-veralg]'),
    _lastRawComputed: null,
  };

  const batchRefs = {
    fileInput: $('batch-file-input'),
    dropZone: $('batch-drop-zone'),
    hashBtn: $('batch-hash-btn'),
    clearBtn: $('batch-clear-btn'),
    downloadBtn: $('batch-download-btn'),
    body: $('batch-body'),
    tableWrap: $('batch-table-wrap'),
    status: $('batch-status'),
    count: $('batch-count'),
    progressBar: $('batch-progress-bar'),
    progressWrap: $('batch-progress'),
    algBtns: document.querySelectorAll('#tab-batch .hash-alg-btn[data-batch-alg]'),
  };

  const compareRefs = {
    hash1: $('compare-hash-1'),
    hash2: $('compare-hash-2'),
    alg1: $('compare-alg-1'),
    alg2: $('compare-alg-2'),
    len1: $('compare-len-1'),
    len2: $('compare-len-2'),
    clear1: $('compare-clear-1'),
    clear2: $('compare-clear-2'),
    swapBtn: $('compare-swap-btn'),
    clearBtn: $('compare-clear-btn'),
    compareBtn: $('compare-btn'),
    resultBadge: $('compare-result-badge'),
    detail: $('compare-detail'),
    diffContainer: $('compare-diff-container'),
    diffView: $('compare-diff-view'),
    matchCount: $('compare-match-count'),
    mismatchCount: $('compare-mismatch-count'),
    lengthDiff: $('compare-length-diff'),
    stats: $('compare-stats'),
  };

  let currentHashAlg = 'sha256';
  let currentHmacAlg = 'sha256';
  let verifyMode = 'file';
  let currentVerAlg = 'sha256';
  let currentFileArrayBuffer = null;
  let currentBatchAlg = 'sha256';
  let batchFiles = [];
  let batchHashing = false;

  const tabButtons = document.querySelectorAll('.hash-tab-btn');
  const tabPanels = {
    hash: $('tab-hash'),
    hmac: $('tab-hmac'),
    verify: $('tab-verify'),
    batch: $('tab-batch'),
    compare: $('tab-compare'),
    history: $('tab-history'),
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
    if (tabId === 'hash') computeHash();
    if (tabId === 'hmac') computeHmac();
    if (tabId === 'history') renderHistory();
    if (tabId === 'batch') renderBatchTable();
    if (tabId === 'compare') compareHashes();
    if (tabId === 'verify') liveVerify();
  }

  tabButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));

  function getHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistoryEntry(entry) {
    try {
      const history = getHistory();
      history.unshift({ ...entry, timestamp: Date.now() });
      if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
      renderHistory();
    } catch (e) {
      console.warn('Failed to save history:', e);
    }
  }

  function renderHistory() {
    const container = $('history-list');
    const countEl = $('history-count');
    const history = getHistory();
    countEl.textContent = history.length;

    if (history.length === 0) {
      container.innerHTML = '<div class="text-text-muted text-sm text-center py-8">No history yet. Generate a hash to get started.</div>';
      return;
    }

    let html = '';
    history.forEach((item, index) => {
      const time = new Date(item.timestamp).toLocaleString();
      const preview = item.text
        ? (item.text.length > 40 ? item.text.substring(0, 40) + '…' : item.text)
        : '[file]';
      const displayHash = applyFormat(item.hash);
      const algLabel = (item.algorithm || 'SHA-256').replace(/^HMAC-/, 'HMAC ');
      const algKey = (item.algorithm || 'sha256').toLowerCase().replace('hmac-', '');
      html += `
        <div class="history-item flex flex-wrap items-center gap-2 justify-between" data-index="${index}">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="h-alg">${algLabel}</span>
              <span class="h-preview" title="${preview.replace(/"/g, '&quot;')}">${preview}</span>
            </div>
            <div class="h-hash">${displayHash}</div>
          </div>
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <span class="h-time hidden sm:inline">${time}</span>
            <button class="history-copy-btn text-text-muted hover:text-tor-violet text-sm p-1" data-hash="${item.hash}" title="Copy hash" type="button">
              <i class="fas fa-copy"></i>
            </button>
            <button class="history-load-btn text-text-muted hover:text-tor-violet text-sm p-1" data-hash="${item.hash}" data-text="${(item.text || '').replace(/"/g, '&quot;')}" data-alg="${algKey}" title="Load into Hash tab" type="button">
              <i class="fas fa-arrow-right-to-bracket"></i>
            </button>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;

    container.querySelectorAll('.history-copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(applyFormat(btn.dataset.hash));
      });
    });
    container.querySelectorAll('.history-load-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = btn.dataset.text || '';
        const alg = btn.dataset.alg || 'sha256';
        switchTab('hash');
        hashRefs.input.value = text;
        const targetAlg = ALGORITHMS[alg] ? alg : 'sha256';
        hashRefs.algBtns.forEach(b => b.classList.toggle('active', b.dataset.alg === targetAlg));
        currentHashAlg = targetAlg;
        computeHash();
        showToast('Loaded into Hash tab');
      });
    });
  }

  function exportHistory() {
    const history = getHistory();
    if (history.length === 0) {
      showToast('No history to export.', true);
      return;
    }
    const data = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      app: 'RICALNET Quantum Hasher',
      count: history.length,
      entries: history
    };
    const json = JSON.stringify(data, null, 2);
    downloadText(json, `quantum_hasher_history_${new Date().toISOString().slice(0, 10)}.json`);
    showToast(`Exported ${history.length} entries.`);
  }

  function importHistory(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        let entries = [];
        if (Array.isArray(data)) entries = data;
        else if (data.entries && Array.isArray(data.entries)) entries = data.entries;
        else {
          showToast('Invalid backup file format.', true);
          return;
        }
        if (entries.length === 0) {
          showToast('No entries found in backup.', true);
          return;
        }
        const currentCount = getHistory().length;
        if (!confirm(`This will replace your current history (${currentCount} entries) with ${entries.length} entries from backup. Continue?`)) {
          return;
        }
        localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
        renderHistory();
        showToast(`Imported ${entries.length} entries successfully.`);
      } catch (err) {
        showToast('Error reading backup file: ' + err.message, true);
      }
    };
    reader.onerror = () => showToast('Error reading file.', true);
    reader.readAsText(file);
  }

  function computeHash() {
    const text = hashRefs.input.value;
    if (!text) {
      hashRefs.result.value = '';
      hashRefs.len.textContent = '0';
      hashRefs.status.textContent = 'Empty input';
      hashRefs.status.className = 'text-text-muted';
      hashRefs._lastRawHash = null;
      hashRefs.copyBtn.disabled = true;
      hashRefs.downloadBtn.disabled = true;
      return;
    }
    try {
      const algo = ALGORITHMS[currentHashAlg];
      const raw = algo.fn(text);
      hashRefs._lastRawHash = raw;
      hashRefs.result.value = applyFormat(raw);
      hashRefs.len.textContent = raw.length;
      hashRefs.algLabel.textContent = algo.label;
      hashRefs.status.textContent = '✓ Done';
      hashRefs.status.className = 'text-tor-violet';
      hashRefs.copyBtn.disabled = false;
      hashRefs.downloadBtn.disabled = false;
      saveHistoryEntry({ text, hash: raw, algorithm: currentHashAlg.toUpperCase(), type: 'hash' });
    } catch (err) {
      hashRefs.result.value = 'Error: ' + err.message;
      hashRefs.status.textContent = 'Error';
      hashRefs.status.className = 'text-red-500';
      hashRefs._lastRawHash = null;
      hashRefs.copyBtn.disabled = true;
      hashRefs.downloadBtn.disabled = true;
    }
  }

  hashRefs.algBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      hashRefs.algBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentHashAlg = btn.dataset.alg;
      computeHash();
    });
  });

  hashRefs.btn.addEventListener('click', computeHash);
  hashRefs.input.addEventListener('input', computeHash);

  hashRefs.copyBtn.addEventListener('click', () => {
    if (hashRefs.result.value) {
      copyToClipboard(hashRefs.result.value, () => {
        hashRefs.copyBtn.classList.add('copied');
        setTimeout(() => hashRefs.copyBtn.classList.remove('copied'), 2000);
      });
    }
  });

  hashRefs.downloadBtn.addEventListener('click', () => {
    if (hashRefs._lastRawHash) {
      downloadText(applyFormat(hashRefs._lastRawHash), `hash_${currentHashAlg}_${Date.now()}.txt`);
      hashRefs.downloadBtn.classList.add('copied');
      setTimeout(() => hashRefs.downloadBtn.classList.remove('copied'), 2000);
    }
  });

  document.querySelectorAll('.sample-hash-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      hashRefs.input.value = btn.dataset.text;
      computeHash();
    });
  });

  function computeHmac() {
    const text = hmacRefs.input.value;
    const key = hmacRefs.key.value;
    if (!text) {
      hmacRefs.result.value = '';
      hmacRefs.len.textContent = '0';
      hmacRefs.status.textContent = 'Empty input';
      hmacRefs.status.className = 'text-text-muted';
      hmacRefs._lastRawHash = null;
      hmacRefs.copyBtn.disabled = true;
      hmacRefs.downloadBtn.disabled = true;
      return;
    }
    if (!key) {
      hmacRefs.result.value = '';
      hmacRefs.len.textContent = '0';
      hmacRefs.status.textContent = 'Missing secret key';
      hmacRefs.status.className = 'text-amber-600';
      hmacRefs._lastRawHash = null;
      hmacRefs.copyBtn.disabled = true;
      hmacRefs.downloadBtn.disabled = true;
      return;
    }
    try {
      const algo = ALGORITHMS[currentHmacAlg];
      const raw = algo.hmac(text, key);
      hmacRefs._lastRawHash = raw;
      hmacRefs.result.value = applyFormat(raw);
      hmacRefs.len.textContent = raw.length;
      hmacRefs.algLabel.textContent = algo.label;
      hmacRefs.status.textContent = '✓ Done';
      hmacRefs.status.className = 'text-tor-violet';
      hmacRefs.copyBtn.disabled = false;
      hmacRefs.downloadBtn.disabled = false;
      saveHistoryEntry({
        text: text + ' [HMAC key: ' + key + ']',
        hash: raw,
        algorithm: 'HMAC-' + currentHmacAlg.toUpperCase(),
        type: 'hmac'
      });
    } catch (err) {
      hmacRefs.result.value = 'Error: ' + err.message;
      hmacRefs.status.textContent = 'Error';
      hmacRefs.status.className = 'text-red-500';
      hmacRefs._lastRawHash = null;
      hmacRefs.copyBtn.disabled = true;
      hmacRefs.downloadBtn.disabled = true;
    }
  }

  hmacRefs.algBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      hmacRefs.algBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentHmacAlg = btn.dataset.hmac;
      computeHmac();
    });
  });

  hmacRefs.btn.addEventListener('click', computeHmac);
  hmacRefs.input.addEventListener('input', computeHmac);
  hmacRefs.key.addEventListener('input', computeHmac);

  hmacRefs.copyBtn.addEventListener('click', () => {
    if (hmacRefs.result.value) {
      copyToClipboard(hmacRefs.result.value, () => {
        hmacRefs.copyBtn.classList.add('copied');
        setTimeout(() => hmacRefs.copyBtn.classList.remove('copied'), 2000);
      });
    }
  });

  hmacRefs.downloadBtn.addEventListener('click', () => {
    if (hmacRefs._lastRawHash) {
      downloadText(applyFormat(hmacRefs._lastRawHash), `hmac_${currentHmacAlg}_${Date.now()}.txt`);
      hmacRefs.downloadBtn.classList.add('copied');
      setTimeout(() => hmacRefs.downloadBtn.classList.remove('copied'), 2000);
    }
  });

  document.querySelectorAll('.sample-hmac-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      hmacRefs.input.value = btn.dataset.text;
      computeHmac();
    });
  });

  verifyRefs.modeFileBtn.addEventListener('click', () => {
    verifyRefs.modeFileBtn.classList.add('active');
    verifyRefs.modeTextBtn.classList.remove('active');
    verifyMode = 'file';
    verifyRefs.fileZone.style.display = 'block';
    if (currentFileArrayBuffer) verifyRefs.filePreview.classList.remove('hidden');
    verifyRefs.textArea.classList.add('hidden');
    verifyRefs._lastRawComputed = null;
    verifyRefs.computed.textContent = '—';
    verifyRefs.computed.className = 'verify-compare-box mt-1';
    clearVerifyDetail();
    setVerifyStatus('idle', 'Ready');
    liveVerify();
  });

  verifyRefs.modeTextBtn.addEventListener('click', () => {
    verifyRefs.modeTextBtn.classList.add('active');
    verifyRefs.modeFileBtn.classList.remove('active');
    verifyMode = 'text';
    verifyRefs.fileZone.style.display = 'none';
    verifyRefs.filePreview.classList.add('hidden');
    verifyRefs.textArea.classList.remove('hidden');
    verifyRefs._lastRawComputed = null;
    verifyRefs.computed.textContent = '—';
    verifyRefs.computed.className = 'verify-compare-box mt-1';
    clearVerifyDetail();
    setVerifyStatus('idle', 'Ready');
    liveVerify();
  });

  verifyRefs.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleVerifyFile(e.target.files[0]);
  });

  verifyRefs.fileZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    verifyRefs.fileZone.classList.add('dragover');
  });
  verifyRefs.fileZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    verifyRefs.fileZone.classList.remove('dragover');
  });
  verifyRefs.fileZone.addEventListener('drop', (e) => {
    e.preventDefault();
    verifyRefs.fileZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleVerifyFile(e.dataTransfer.files[0]);
  });

  function handleVerifyFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      currentFileArrayBuffer = e.target.result;
      const wordArray = CryptoJS.lib.WordArray.create(currentFileArrayBuffer);
      const raw = ALGORITHMS[currentVerAlg].fn(wordArray);
      verifyRefs._lastRawComputed = raw;
      verifyRefs.computed.textContent = applyFormat(raw);
      verifyRefs.computed.className = 'verify-compare-box mt-1';
      verifyRefs.fileName.textContent = file.name;
      verifyRefs.fileSize.textContent = formatFileSize(file.size);
      verifyRefs.filePreview.classList.remove('hidden');
      verifyRefs.fileZone.style.display = 'none';
      clearVerifyDetail();
      setVerifyStatus('idle', 'File loaded — waiting for expected hash');
      showToast('File loaded: ' + file.name);
      liveVerify();
    };
    reader.onerror = () => showToast('Error reading file.', true);
    reader.readAsArrayBuffer(file);
  }

  verifyRefs.fileClear.addEventListener('click', () => {
    currentFileArrayBuffer = null;
    verifyRefs._lastRawComputed = null;
    verifyRefs.filePreview.classList.add('hidden');
    verifyRefs.fileZone.style.display = 'block';
    verifyRefs.fileInput.value = '';
    verifyRefs.computed.textContent = '—';
    verifyRefs.computed.className = 'verify-compare-box mt-1';
    clearVerifyDetail();
    setVerifyStatus('idle', 'Ready');
    liveVerify();
  });

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  }

  verifyRefs.textInput.addEventListener('input', () => {
    if (verifyMode !== 'text') return;
    const text = verifyRefs.textInput.value;
    if (text) {
      const raw = ALGORITHMS[currentVerAlg].fn(text);
      verifyRefs._lastRawComputed = raw;
      verifyRefs.computed.textContent = applyFormat(raw);
      verifyRefs.computed.className = 'verify-compare-box mt-1';
      setVerifyStatus('idle', 'Text loaded — waiting for expected hash');
    } else {
      verifyRefs._lastRawComputed = null;
      verifyRefs.computed.textContent = '—';
      verifyRefs.computed.className = 'verify-compare-box mt-1';
      setVerifyStatus('idle', 'Ready');
    }
    clearVerifyDetail();
    liveVerify();
  });

  verifyRefs.algBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      verifyRefs.algBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentVerAlg = btn.dataset.veralg;
      if (verifyMode === 'file' && currentFileArrayBuffer) {
        const wordArray = CryptoJS.lib.WordArray.create(currentFileArrayBuffer);
        const raw = ALGORITHMS[currentVerAlg].fn(wordArray);
        verifyRefs._lastRawComputed = raw;
        verifyRefs.computed.textContent = applyFormat(raw);
        verifyRefs.computed.className = 'verify-compare-box mt-1';
      } else if (verifyMode === 'text' && verifyRefs.textInput.value) {
        const raw = ALGORITHMS[currentVerAlg].fn(verifyRefs.textInput.value);
        verifyRefs._lastRawComputed = raw;
        verifyRefs.computed.textContent = applyFormat(raw);
        verifyRefs.computed.className = 'verify-compare-box mt-1';
      }
      clearVerifyDetail();
      setVerifyStatus('idle', 'Algorithm changed');
      liveVerify();
    });
  });

  verifyRefs.calcBtn.addEventListener('click', () => {
    if (computeVerifyHash()) showToast('Hash computed');
  });

  function computeVerifyHash() {
    if (verifyMode === 'file' && currentFileArrayBuffer) {
      const wordArray = CryptoJS.lib.WordArray.create(currentFileArrayBuffer);
      const raw = ALGORITHMS[currentVerAlg].fn(wordArray);
      verifyRefs._lastRawComputed = raw;
      verifyRefs.computed.textContent = applyFormat(raw);
      verifyRefs.computed.className = 'verify-compare-box mt-1';
      setVerifyStatus('idle', 'Hash computed');
      liveVerify();
      return true;
    } else if (verifyMode === 'text' && verifyRefs.textInput.value) {
      const raw = ALGORITHMS[currentVerAlg].fn(verifyRefs.textInput.value);
      verifyRefs._lastRawComputed = raw;
      verifyRefs.computed.textContent = applyFormat(raw);
      verifyRefs.computed.className = 'verify-compare-box mt-1';
      setVerifyStatus('idle', 'Hash computed');
      liveVerify();
      return true;
    } else {
      showToast('No data to hash. Please load a file or enter text.', true);
      return false;
    }
  }

  let liveVerifyTimeout = null;

  function liveVerify() {
    clearTimeout(liveVerifyTimeout);
    liveVerifyTimeout = setTimeout(() => {
      const computedRaw = verifyRefs._lastRawComputed;
      const expectedRaw = verifyRefs.expected.value.trim();

      if (!computedRaw) {
        clearVerifyDetail();
        verifyRefs.expectedDisplay.textContent = '—';
        verifyRefs.expectedDisplay.className = 'verify-compare-box mt-1';
        setVerifyStatus('idle', 'Compute a hash first');
        return;
      }

      verifyRefs.computed.textContent = applyFormat(computedRaw);

      if (!expectedRaw) {
        clearVerifyDetail();
        verifyRefs.expectedDisplay.textContent = '—';
        verifyRefs.expectedDisplay.className = 'verify-compare-box mt-1';
        setVerifyStatus('idle', 'Enter expected hash');
        return;
      }

      verifyRefs.expectedDisplay.textContent = applyFormat(expectedRaw);
      verifyRefs.expectedDisplay.className = 'verify-compare-box mt-1';

      const match = computedRaw.toLowerCase() === expectedRaw.toLowerCase();
      verifyRefs.detail.classList.remove('hidden');

      if (match) {
        verifyRefs.matchDetail.classList.remove('hidden');
        verifyRefs.mismatchDetail.classList.add('hidden');
        verifyRefs.computed.className = 'verify-compare-box mt-1 match';
        verifyRefs.expectedDisplay.className = 'verify-compare-box mt-1 match';
        setVerifyStatus('success', '✓ VERIFIED — Hash matches!');
      } else {
        verifyRefs.mismatchDetail.classList.remove('hidden');
        verifyRefs.matchDetail.classList.add('hidden');
        verifyRefs.computed.className = 'verify-compare-box mt-1 mismatch';
        verifyRefs.expectedDisplay.className = 'verify-compare-box mt-1 mismatch';
        setVerifyStatus('fail', '✗ MISMATCH — Hash does not match');
      }
    }, 250);
  }

  verifyRefs.verifyBtn.addEventListener('click', () => {
    if (!verifyRefs._lastRawComputed) {
      if (!computeVerifyHash()) return;
    }
    const expected = verifyRefs.expected.value.trim();
    if (!expected) {
      showToast('Please enter the expected hash.', true);
      return;
    }
    liveVerify();
  });

  verifyRefs.expected.addEventListener('input', liveVerify);

  function clearVerifyDetail() {
    verifyRefs.detail.classList.add('hidden');
    verifyRefs.matchDetail.classList.add('hidden');
    verifyRefs.mismatchDetail.classList.add('hidden');
  }

  function setVerifyStatus(type, message) {
    const el = verifyRefs.status;
    el.className = 'verify-status ' + type;
    const icons = {
      idle: 'fa-circle',
      success: 'fa-check-circle',
      fail: 'fa-times-circle',
      pending: 'fa-spinner fa-spin'
    };
    el.innerHTML = '<i class="fas ' + (icons[type] || 'fa-circle') + '"></i> ' + message;
  }

  batchRefs.algBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.batchAlg === currentBatchAlg) return;
      const hasHashes = batchFiles.some(f => f.hash);
      if (hasHashes) {
        if (!confirm('Changing algorithm will clear existing hashes. Continue?')) {
          return;
        }
        batchFiles.forEach(f => f.hash = null);
      }
      batchRefs.algBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentBatchAlg = btn.dataset.batchAlg;
      renderBatchTable();
      showToast('Algorithm: ' + currentBatchAlg.toUpperCase());
    });
  });

  batchRefs.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    batchRefs.dropZone.classList.add('dragover');
  });
  batchRefs.dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    batchRefs.dropZone.classList.remove('dragover');
  });
  batchRefs.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    batchRefs.dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) addBatchFiles(files);
  });

  batchRefs.fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) addBatchFiles(files);
    batchRefs.fileInput.value = '';
  });

  function addBatchFiles(files) {
    files.forEach(file => {
      const exists = batchFiles.some(f => f.name === file.name && f.size === file.size);
      if (!exists) {
        batchFiles.push({
          file,
          name: file.name,
          size: file.size,
          hash: null
        });
      }
    });
    renderBatchTable();
    showToast(files.length + ' file(s) added.');
  }

  batchRefs.clearBtn.addEventListener('click', () => {
    if (batchFiles.length === 0) return;
    if (confirm('Clear all batch files?')) {
      batchFiles = [];
      renderBatchTable();
      batchRefs.progressWrap.style.opacity = '0';
      batchRefs.progressBar.style.width = '0%';
      showToast('Batch cleared.');
    }
  });

  batchRefs.hashBtn.addEventListener('click', async () => {
    if (batchHashing) return;
    const pending = batchFiles.filter(f => !f.hash);
    if (pending.length === 0) {
      showToast('All files already hashed.');
      return;
    }
    batchHashing = true;
    batchRefs.hashBtn.disabled = true;
    batchRefs.hashBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Hashing...';
    batchRefs.progressWrap.style.opacity = '1';
    batchRefs.progressBar.style.width = '0%';

    let done = 0;
    const total = pending.length;

    for (const item of pending) {
      try {
        const data = await readFileAsArrayBuffer(item.file);
        const wordArray = CryptoJS.lib.WordArray.create(data);
        item.hash = ALGORITHMS[currentBatchAlg].fn(wordArray);
      } catch (err) {
        item.hash = 'ERROR';
        console.warn('Hash failed for', item.name, err);
      }
      done++;
      batchRefs.progressBar.style.width = ((done / total) * 100) + '%';
      renderBatchTable();
      await new Promise(r => setTimeout(r, 0));
    }

    batchHashing = false;
    batchRefs.hashBtn.disabled = false;
    batchRefs.hashBtn.innerHTML = '<i class="fas fa-play"></i> Hash All';
    setTimeout(() => { batchRefs.progressWrap.style.opacity = '0'; }, 1200);
    showToast('All files hashed with ' + currentBatchAlg.toUpperCase() + '.');
  });

  function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e.target.error);
      reader.readAsArrayBuffer(file);
    });
  }

  function renderBatchTable() {
    batchRefs.count.textContent = batchFiles.length + ' file' + (batchFiles.length === 1 ? '' : 's');

    if (batchFiles.length === 0) {
      batchRefs.tableWrap.style.display = 'none';
      batchRefs.status.textContent = 'Drop files or click to select.';
      batchRefs.downloadBtn.disabled = true;
      return;
    }

    batchRefs.tableWrap.style.display = 'block';
    const hasAllHashes = batchFiles.every(f => f.hash);
    batchRefs.downloadBtn.disabled = !hasAllHashes;

    let html = '';
    batchFiles.forEach((item, idx) => {
      const sizeStr = formatFileSize(item.size);
      const hashDisplay = item.hash
        ? (item.hash === 'ERROR' ? '<span class="text-red-500">ERROR</span>' : applyFormat(item.hash))
        : '—';
      const hasHash = item.hash && item.hash !== 'ERROR';
      html += `
        <tr>
          <td>${idx + 1}</td>
          <td class="file-cell" title="${item.name.replace(/"/g, '&quot;')}">${item.name}</td>
          <td class="size-cell">${sizeStr}</td>
          <td class="hash-cell">${hashDisplay}</td>
          <td>
            ${hasHash ? `<button class="batch-copy-hash text-text-muted hover:text-tor-violet text-sm p-1" data-hash="${item.hash}" title="Copy hash" type="button"><i class="fas fa-copy"></i></button>` : ''}
            ${hasHash ? `<button class="batch-download-hash text-text-muted hover:text-tor-violet text-sm p-1" data-hash="${item.hash}" data-name="${item.name.replace(/"/g, '&quot;')}" title="Download hash" type="button"><i class="fas fa-download"></i></button>` : ''}
            <button class="batch-remove-file text-text-muted hover:text-red-500 text-sm p-1" data-index="${idx}" title="Remove file" type="button"><i class="fas fa-times"></i></button>
          </td>
        </tr>
      `;
    });
    batchRefs.body.innerHTML = html;

    batchRefs.body.querySelectorAll('.batch-copy-hash').forEach(btn => {
      btn.addEventListener('click', () => copyToClipboard(applyFormat(btn.dataset.hash)));
    });
    batchRefs.body.querySelectorAll('.batch-download-hash').forEach(btn => {
      btn.addEventListener('click', () => {
        downloadText(applyFormat(btn.dataset.hash), `hash_${btn.dataset.name}.txt`);
      });
    });
    batchRefs.body.querySelectorAll('.batch-remove-file').forEach(btn => {
      btn.addEventListener('click', () => {
        batchFiles.splice(parseInt(btn.dataset.index), 1);
        renderBatchTable();
        showToast('File removed.');
      });
    });

    const hashedCount = batchFiles.filter(f => f.hash).length;
    batchRefs.status.textContent = hasAllHashes
      ? `All ${batchFiles.length} files hashed with ${currentBatchAlg.toUpperCase()}. Ready to download.`
      : `${hashedCount} / ${batchFiles.length} hashed. Algorithm: ${currentBatchAlg.toUpperCase()}`;
  }

  batchRefs.downloadBtn.addEventListener('click', () => {
    const hashed = batchFiles.filter(f => f.hash && f.hash !== 'ERROR');
    if (hashed.length === 0) {
      showToast('No valid hashes to download.', true);
      return;
    }
    let content = `# RICALNET Quantum Hasher — Batch Hash Export\n`;
    content += `# Algorithm: ${currentBatchAlg.toUpperCase()}\n`;
    content += `# Generated: ${new Date().toISOString()}\n`;
    content += `# Files: ${hashed.length}\n\n`;
    hashed.forEach(item => {
      content += `${applyFormat(item.hash)}  ${item.name}\n`;
    });
    downloadText(content, `batch_hashes_${currentBatchAlg}_${Date.now()}.txt`);
    showToast('Downloaded batch hashes (' + currentBatchAlg.toUpperCase() + ').');
  });

  function detectAlgorithm(hash) {
    if (!hash || hash.trim() === '') return null;
    const trimmed = hash.trim();
    const len = trimmed.length;
    const isHex = /^[0-9a-fA-F]+$/.test(trimmed);
    if (!isHex) return { text: '⚠️ Not hex', warn: true };
    const map = { 32: 'MD5', 40: 'SHA-1', 64: 'SHA-256', 96: 'SHA-384', 128: 'SHA-512' };
    if (map[len]) return { text: map[len], warn: false };
    return { text: `⚠️ Unknown (${len})`, warn: true };
  }

  function updateCompareFields() {
    const h1 = compareRefs.hash1.value.trim();
    const h2 = compareRefs.hash2.value.trim();

    const alg1 = detectAlgorithm(h1);
    const alg2 = detectAlgorithm(h2);

    if (alg1) {
      compareRefs.alg1.textContent = alg1.text;
      compareRefs.alg1.className = 'compare-alg-detect' + (alg1.warn ? ' warn' : '');
    } else {
      compareRefs.alg1.textContent = '—';
      compareRefs.alg1.className = 'compare-alg-detect';
    }

    if (alg2) {
      compareRefs.alg2.textContent = alg2.text;
      compareRefs.alg2.className = 'compare-alg-detect' + (alg2.warn ? ' warn' : '');
    } else {
      compareRefs.alg2.textContent = '—';
      compareRefs.alg2.className = 'compare-alg-detect';
    }

    compareRefs.len1.textContent = h1.length + ' character' + (h1.length === 1 ? '' : 's');
    compareRefs.len2.textContent = h2.length + ' character' + (h2.length === 1 ? '' : 's');

    if (!h1 || !h2) {
      resetCompareResult();
    }
  }

  function resetCompareResult() {
    compareRefs.resultBadge.className = 'compare-result-badge idle';
    compareRefs.resultBadge.innerHTML = '<i class="fas fa-circle"></i> Ready';
    compareRefs.detail.textContent = 'Paste two hashes and click Compare.';
    compareRefs.detail.className = 'text-sm text-text-muted';
    compareRefs.diffContainer.classList.add('hidden');
    compareRefs.stats.classList.add('hidden');
  }

  function compareHashes() {
    const h1Raw = compareRefs.hash1.value.trim();
    const h2Raw = compareRefs.hash2.value.trim();

    if (!h1Raw || !h2Raw) {
      showToast('Please paste both hashes.', true);
      return;
    }

    const h1 = h1Raw.toLowerCase();
    const h2 = h2Raw.toLowerCase();
    const isMatch = h1 === h2;
    const len1 = h1.length;
    const len2 = h2.length;

    if (isMatch) {
      compareRefs.resultBadge.className = 'compare-result-badge match';
      compareRefs.resultBadge.innerHTML = '<i class="fas fa-check-circle"></i> ✅ MATCH';
      compareRefs.detail.textContent = 'The two hashes are identical.';
      compareRefs.detail.className = 'text-sm text-tor-accent';
    } else {
      compareRefs.resultBadge.className = 'compare-result-badge mismatch';
      compareRefs.resultBadge.innerHTML = '<i class="fas fa-times-circle"></i> ❌ MISMATCH';
      if (len1 !== len2) {
        compareRefs.detail.textContent = `Lengths differ: ${len1} vs ${len2} characters.`;
        compareRefs.detail.className = 'text-sm text-amber-600';
      } else {
        compareRefs.detail.textContent = 'The two hashes are different.';
        compareRefs.detail.className = 'text-sm text-red-500';
      }
    }

    compareRefs.diffContainer.classList.remove('hidden');
    compareRefs.stats.classList.remove('hidden');

    const maxLen = Math.max(len1, len2);
    let diffHtml = '';
    let matchCount = 0;
    let mismatchCount = 0;

    for (let i = 0; i < maxLen; i++) {
      const c1 = i < len1 ? h1[i] : '·';
      const c2 = i < len2 ? h2[i] : '·';
      if (c1 === c2) {
        diffHtml += `<span class="diff-match">${escapeHtml(c1)}</span>`;
        matchCount++;
      } else {
        diffHtml += `<span class="diff-mismatch" title="Mismatch at position ${i + 1}">${escapeHtml(c1)}</span>`;
        mismatchCount++;
      }
    }

    compareRefs.diffView.innerHTML = diffHtml;
    compareRefs.matchCount.textContent = matchCount;
    compareRefs.mismatchCount.textContent = mismatchCount;
    compareRefs.lengthDiff.classList.toggle('hidden', len1 === len2);

    showToast(isMatch ? '✅ Hashes match!' : '❌ Hashes do not match.', !isMatch);
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  compareRefs.compareBtn.addEventListener('click', compareHashes);

  compareRefs.swapBtn.addEventListener('click', () => {
    const temp = compareRefs.hash1.value;
    compareRefs.hash1.value = compareRefs.hash2.value;
    compareRefs.hash2.value = temp;
    updateCompareFields();
    if (compareRefs.hash1.value.trim() && compareRefs.hash2.value.trim()) compareHashes();
  });

  compareRefs.clear1.addEventListener('click', () => {
    compareRefs.hash1.value = '';
    updateCompareFields();
    resetCompareResult();
  });

  compareRefs.clear2.addEventListener('click', () => {
    compareRefs.hash2.value = '';
    updateCompareFields();
    resetCompareResult();
  });

  compareRefs.clearBtn.addEventListener('click', () => {
    compareRefs.hash1.value = '';
    compareRefs.hash2.value = '';
    updateCompareFields();
    resetCompareResult();
    showToast('Cleared both hashes.');
  });

  compareRefs.hash1.addEventListener('input', updateCompareFields);
  compareRefs.hash2.addEventListener('input', updateCompareFields);
  compareRefs.hash1.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); compareHashes(); }
  });
  compareRefs.hash2.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); compareHashes(); }
  });

  function refreshAllDisplayedHashes() {
    if (hashRefs._lastRawHash) {
      hashRefs.result.value = applyFormat(hashRefs._lastRawHash);
    }
    if (hmacRefs._lastRawHash) {
      hmacRefs.result.value = applyFormat(hmacRefs._lastRawHash);
    }
    if (verifyRefs._lastRawComputed) {
      verifyRefs.computed.textContent = applyFormat(verifyRefs._lastRawComputed);
      liveVerify();
    }
    renderBatchTable();
    renderHistory();
  }

  $('history-export-btn').addEventListener('click', exportHistory);
  $('history-import-input').addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importHistory(e.target.files[0]);
      e.target.value = '';
    }
  });
  $('history-clear-btn').addEventListener('click', () => {
    if (getHistory().length === 0) {
      showToast('History is already empty.');
      return;
    }
    if (confirm('Clear all hash history? This cannot be undone.')) {
      localStorage.removeItem(HISTORY_KEY);
      renderHistory();
      showToast('History cleared.');
    }
  });

  window.copyPGP = function () {
    copyToClipboard(PGP_FINGERPRINT, () => showToast('PGP fingerprint copied!'));
  };

  function init() {
    computeHash();
    computeHmac();
    setVerifyStatus('idle', 'Ready — load a file or enter text');
    renderHistory();
    renderBatchTable();
    batchRefs.progressWrap.style.opacity = '0';
    updateCompareFields();
    resetCompareResult();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

})();