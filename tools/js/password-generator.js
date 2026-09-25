(function () {
  'use strict';

  const PGP_FINGERPRINT = '45688382B815821F033115B8D92D6A10D29C8380';

  const CHARS = {
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    numbers: '0123456789',
    special: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`\'"\\',
  };

  const AMBIGUOUS = new Set(['l', 'I', '1', 'O', '0', 'o']);

  const WORDS = [
    'apple', 'brave', 'crane', 'drift', 'eagle', 'flame', 'globe', 'honey', 'ivory', 'jolly',
    'kite', 'lemon', 'mango', 'noble', 'ocean', 'piano', 'quartz', 'river', 'storm', 'tiger',
    'unity', 'vivid', 'wheat', 'xenon', 'yacht', 'zebra', 'amber', 'bloom', 'cedar', 'daisy',
    'ember', 'frost', 'grace', 'haven', 'inlet', 'jewel', 'karma', 'lunar', 'maple', 'north',
    'orbit', 'pearl', 'quest', 'raven', 'solar', 'tulip', 'urban', 'valley', 'willow', 'xenial',
    'youth', 'zephyr', 'anchor', 'breeze', 'coral', 'dune', 'echo', 'fjord', 'grove', 'horizon',
    'island', 'jasmine', 'kelp', 'lagoon', 'meadow', 'nebula', 'opal', 'prairie', 'quiet', 'reef',
    'sierra', 'tundra', 'umbra', 'verdant', 'wave', 'azure', 'bliss', 'crisp', 'dusk', 'ether',
    'flint', 'gale', 'haze', 'iris', 'jade', 'knot', 'loft', 'mist', 'nova', 'oasis',
    'pine', 'quill', 'rustic', 'sage', 'thrive', 'uplift', 'vortex', 'wisp', 'yonder', 'zenith'
  ];

  const DOM = {
    display: document.getElementById('password-display'),
    lengthRange: document.getElementById('length-range'),
    lengthDisplay: document.getElementById('length-display'),
    lengthBadge: document.getElementById('pw-length-badge'),
    entropyBadge: document.getElementById('pw-entropy-badge'),
    entropyDisplay: document.getElementById('entropy-display'),
    charsetSize: document.getElementById('charset-size'),
    chkUppercase: document.getElementById('chk-uppercase'),
    chkLowercase: document.getElementById('chk-lowercase'),
    chkNumbers: document.getElementById('chk-numbers'),
    chkSpecial: document.getElementById('chk-special'),
    chkAmbiguous: document.getElementById('chk-ambiguous'),
    minDigits: document.getElementById('min-digits'),
    minSpecial: document.getElementById('min-special'),
    generateBtn: document.getElementById('generate-btn'),
    generatePassphraseBtn: document.getElementById('generate-passphrase-btn'),
    regenerateBtn: document.getElementById('regenerate-btn'),
    copyBtn: document.getElementById('copy-password-btn'),
    toggleVis: document.getElementById('toggle-visibility'),
    strengthSegments: document.querySelectorAll('#strength-segments .pw-strength-segment'),
    strengthLabel: document.getElementById('strength-label'),
    warning: document.getElementById('pw-warning'),
    warningText: document.getElementById('pw-warning-text'),
    quickLengthBtns: document.querySelectorAll('.quick-length-btn'),
    modeTabs: document.querySelectorAll('.pw-mode-tab'),
    modePassword: document.getElementById('pw-mode-password'),
    modePassphrase: document.getElementById('pw-mode-passphrase'),
    ppWordCount: document.getElementById('pp-word-count'),
    ppWordCountDisplay: document.getElementById('pp-word-count-display'),
    ppSeparator: document.getElementById('pp-separator'),
    ppCapitalize: document.getElementById('pp-capitalize'),
    ppAddNumber: document.getElementById('pp-add-number'),
    ppAddSpecial: document.getElementById('pp-add-special'),
    historyWrap: document.getElementById('pw-history-wrap'),
    historyList: document.getElementById('pw-history-list'),
    historyCount: document.getElementById('pw-history-count'),
    clearHistory: document.getElementById('pw-clear-history'),
  };

  let currentPassword = '';
  let isVisible = true;
  let currentMode = 'password';
  let history = [];

  AOS.init({
    once: true,
    offset: 30,
    easing: 'ease-out-expo',
    duration: 900,
    disable: window.innerWidth < 768 ? true : false,
  });

  function showToast(message, isError) {
    const existing = document.querySelector('.pw-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'pw-toast fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-full text-sm shadow-2xl border border-tor-violet/30 z-[9999] transition-all duration-300 opacity-0 translate-y-4';
    toast.innerHTML = `<i class="fas ${isError ? 'fa-circle-exclamation text-red-400' : 'fa-check-circle text-tor-accent'} mr-2"></i> ${message}`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove('opacity-0', 'translate-y-4');
    });
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-4');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  function randomInt(max) {
    if (max <= 0) return 0;
    const limit = Math.floor(0xFFFFFFFF / max) * max;
    const buf = new Uint32Array(1);
    let value;
    do {
      crypto.getRandomValues(buf);
      value = buf[0];
    } while (value >= limit);
    return value % max;
  }

  function pickChar(str) {
    return str.charAt(randomInt(str.length));
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

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!');
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
    });
  }

  function buildCharset(useUpper, useLower, useNumbers, useSpecial, excludeAmbiguous) {
    let pool = '';
    if (useUpper) pool += CHARS.uppercase;
    if (useLower) pool += CHARS.lowercase;
    if (useNumbers) pool += CHARS.numbers;
    if (useSpecial) pool += CHARS.special;

    if (excludeAmbiguous) {
      pool = pool.split('').filter(c => !AMBIGUOUS.has(c)).join('');
    }
    return pool;
  }

  function generatePassword() {
    const length = parseInt(DOM.lengthRange.value) || 12;
    const useUpper = DOM.chkUppercase.checked;
    const useLower = DOM.chkLowercase.checked;
    const useNumbers = DOM.chkNumbers.checked;
    const useSpecial = DOM.chkSpecial.checked;
    const excludeAmbiguous = DOM.chkAmbiguous.checked;
    const minDigits = parseInt(DOM.minDigits.value) || 0;
    const minSpecial = parseInt(DOM.minSpecial.value) || 0;

    hideWarning();

    if (!useUpper && !useLower && !useNumbers && !useSpecial) {
      showWarning('Please select at least one character type.', true);
      return;
    }

    if (minDigits + minSpecial > length) {
      showWarning('Minimum numbers + special cannot exceed password length.', true);
      return;
    }

    if (useNumbers && minDigits > 0 && minDigits > length) {
      showWarning('Minimum numbers cannot exceed password length.', true);
      return;
    }

    const pool = buildCharset(useUpper, useLower, useNumbers, useSpecial, excludeAmbiguous);
    if (pool.length === 0) {
      showWarning('No characters available in the selected pool.', true);
      return;
    }

    const numberPool = excludeAmbiguous
      ? CHARS.numbers.split('').filter(c => !AMBIGUOUS.has(c)).join('')
      : CHARS.numbers;
    const specialPool = CHARS.special;

    if (minDigits > 0 && !useNumbers) {
      showWarning('Minimum numbers set but Numbers charset is disabled.', true);
      return;
    }
    if (minSpecial > 0 && !useSpecial) {
      showWarning('Minimum special set but Special charset is disabled.', true);
      return;
    }

    const chars = [];
    for (let i = 0; i < minDigits; i++) chars.push(pickChar(numberPool));
    for (let i = 0; i < minSpecial; i++) chars.push(pickChar(specialPool));

    const remaining = length - chars.length;
    for (let i = 0; i < remaining; i++) chars.push(pickChar(pool));

    for (let i = chars.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }

    currentPassword = chars.join('');

    DOM.display.value = currentPassword;
    DOM.display.type = isVisible ? 'text' : 'password';
    DOM.lengthBadge.textContent = `${currentPassword.length} chars`;

    const entropy = calculateEntropy(currentPassword, pool.length);
    DOM.entropyDisplay.textContent = Math.round(entropy);
    DOM.charsetSize.textContent = pool.length;

    updateStrength(currentPassword, entropy, pool.length);
    addToHistory(currentPassword);
    updateCharCountBadges();
  }

  function generatePassphrase() {
    hideWarning();

    const wordCount = parseInt(DOM.ppWordCount.value) || 4;
    const separator = DOM.ppSeparator.value;
    const capitalize = DOM.ppCapitalize.checked;
    const addNumber = DOM.ppAddNumber.checked;
    const addSpecial = DOM.ppAddSpecial.checked;

    const chosen = [];
    for (let i = 0; i < wordCount; i++) {
      let word = WORDS[randomInt(WORDS.length)];
      if (capitalize) word = word.charAt(0).toUpperCase() + word.slice(1);
      chosen.push(word);
    }

    let result = chosen.join(separator);

    if (addNumber) {
      result += separator + randomInt(10);
    }
    if (addSpecial) {
      const specials = '!@#$%^&*()_+-=';
      result += separator + specials.charAt(randomInt(specials.length));
    }

    currentPassword = result;
    DOM.display.value = currentPassword;
    DOM.display.type = isVisible ? 'text' : 'password';
    DOM.lengthBadge.textContent = `${currentPassword.length} chars`;

    const entropy = calculatePassphraseEntropy(wordCount, addNumber, addSpecial);
    DOM.entropyDisplay.textContent = Math.round(entropy);
    DOM.charsetSize.textContent = WORDS.length;

    updateStrength(currentPassword, entropy, WORDS.length);
    addToHistory(currentPassword);
    updateCharCountBadges();
  }

  function calculateEntropy(password, poolSize) {
    if (poolSize <= 1) return 0;
    return password.length * Math.log2(poolSize);
  }

  function calculatePassphraseEntropy(wordCount, addNumber, addSpecial) {
    let bits = wordCount * Math.log2(WORDS.length);
    if (addNumber) bits += Math.log2(10);
    if (addSpecial) bits += Math.log2(14);
    return bits;
  }

  function updateStrength(password, entropy, poolSize) {
    const len = password.length;
    let score = 0;

    if (len >= 8) score += 1;
    if (len >= 12) score += 1;
    if (len >= 16) score += 1;
    if (len >= 24) score += 1;

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    let variety = 0;
    if (hasUpper) variety++;
    if (hasLower) variety++;
    if (hasNumber) variety++;
    if (hasSpecial) variety++;

    if (variety >= 3) score += 1;
    if (variety === 4) score += 1;

    if (entropy > 40) score += 1;
    if (entropy > 60) score += 1;
    if (entropy > 80) score += 1;
    if (entropy > 100) score += 1;

    let level = 1;
    let label, cls;
    if (score <= 2) {
      level = 1;
      label = 'Very Weak';
      cls = 'active-weak';
    } else if (score <= 4) {
      level = 2;
      label = 'Weak';
      cls = 'active-weak';
    } else if (score <= 6) {
      level = 3;
      label = 'Fair';
      cls = 'active-fair';
    } else if (score <= 8) {
      level = 4;
      label = 'Strong';
      cls = 'active-strong';
    } else {
      level = 5;
      label = 'Very Strong';
      cls = 'active-very-strong';
    }

    DOM.strengthSegments.forEach((seg, i) => {
      seg.className = 'pw-strength-segment';
      if (i < level) seg.classList.add(cls);
    });

    DOM.strengthLabel.textContent = label;
    const colorMap = {
      'Very Weak': '#ef4444',
      'Weak': '#ef4444',
      'Fair': '#f59e0b',
      'Strong': '#22c55e',
      'Very Strong': '#16a34a',
    };
    DOM.strengthLabel.style.color = colorMap[label] || '#9492ae';
  }

  function updateCharCountBadges() {
    const length = parseInt(DOM.lengthRange.value) || 12;
    const minDigits = parseInt(DOM.minDigits.value) || 0;
    const minSpecial = parseInt(DOM.minSpecial.value) || 0;

    DOM.lengthDisplay.textContent = length;

    if (length < 8) {
      DOM.lengthBadge.classList.add('error');
    } else if (length < 12) {
      DOM.lengthBadge.classList.add('warn');
      DOM.lengthBadge.classList.remove('error');
    } else {
      DOM.lengthBadge.classList.remove('warn', 'error');
    }

    const min = parseInt(DOM.lengthRange.min);
    const max = parseInt(DOM.lengthRange.max);
    const pct = ((length - min) / (max - min)) * 100;
    DOM.lengthRange.style.setProperty('--range-fill', pct + '%');
  }

  function showWarning(msg, isError) {
    DOM.warningText.textContent = msg;
    DOM.warning.classList.add('show');
    DOM.warning.classList.toggle('error', !!isError);
  }

  function hideWarning() {
    DOM.warning.classList.remove('show', 'error');
  }

  function addToHistory(pw) {
    if (!pw || pw.length === 0) return;
    history.unshift(pw);
    if (history.length > 5) history.pop();
    renderHistory();
  }

  function renderHistory() {
    if (history.length === 0) {
      DOM.historyWrap.classList.add('hidden');
      return;
    }
    DOM.historyWrap.classList.remove('hidden');
    DOM.historyCount.textContent = history.length;
    DOM.historyList.innerHTML = '';
    history.forEach(pw => {
      const chip = document.createElement('button');
      chip.className = 'pw-history-chip';
      chip.title = 'Click to copy';
      const masked = pw.length > 20 ? pw.slice(0, 20) + '…' : pw;
      chip.innerHTML = `<i class="fas fa-copy" style="font-size:0.55rem;opacity:0.6;"></i> ${masked}`;
      chip.addEventListener('click', () => {
        copyToClipboard(pw);
      });
      DOM.historyList.appendChild(chip);
    });
  }

  function setMode(mode) {
    currentMode = mode;
    DOM.modeTabs.forEach(tab => {
      const isActive = tab.dataset.mode === mode;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });
    DOM.modePassword.style.display = mode === 'password' ? '' : 'none';
    DOM.modePassword.classList.toggle('active', mode === 'password');
    DOM.modePassphrase.style.display = mode === 'passphrase' ? '' : 'none';
    DOM.modePassphrase.classList.toggle('active', mode === 'passphrase');

    if (mode === 'passphrase') {
      DOM.ppWordCount.dispatchEvent(new Event('input'));
    }
  }

  function toggleVisibility() {
    isVisible = !isVisible;
    DOM.display.type = isVisible ? 'text' : 'password';
    const icon = DOM.toggleVis.querySelector('i');
    icon.className = isVisible ? 'fas fa-eye' : 'fas fa-eye-slash';
  }

  function copyPassword() {
    if (!currentPassword) {
      showToast('Generate a password first.', true);
      return;
    }
    copyToClipboard(currentPassword);
    DOM.copyBtn.classList.add('copied');
    setTimeout(() => DOM.copyBtn.classList.remove('copied'), 2000);
  }

  DOM.generateBtn.addEventListener('click', generatePassword);
  DOM.regenerateBtn.addEventListener('click', generatePassword);
  DOM.generatePassphraseBtn.addEventListener('click', generatePassphrase);
  DOM.copyBtn.addEventListener('click', copyPassword);
  DOM.toggleVis.addEventListener('click', toggleVisibility);

  DOM.lengthRange.addEventListener('input', () => {
    updateCharCountBadges();
    if (currentMode === 'password') generatePassword();
  });

  DOM.quickLengthBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const len = parseInt(btn.dataset.length);
      DOM.lengthRange.value = len;
      updateCharCountBadges();
      generatePassword();
    });
  });

  [DOM.chkUppercase, DOM.chkLowercase, DOM.chkNumbers, DOM.chkSpecial, DOM.chkAmbiguous].forEach(el => {
    el.addEventListener('change', generatePassword);
  });

  DOM.minDigits.addEventListener('input', () => {
    let val = parseInt(DOM.minDigits.value) || 0;
    if (val < 0) DOM.minDigits.value = 0;
    if (val > 20) DOM.minDigits.value = 20;
    generatePassword();
  });

  DOM.minSpecial.addEventListener('input', () => {
    let val = parseInt(DOM.minSpecial.value) || 0;
    if (val < 0) DOM.minSpecial.value = 0;
    if (val > 20) DOM.minSpecial.value = 20;
    generatePassword();
  });

  DOM.ppWordCount.addEventListener('input', () => {
    const val = DOM.ppWordCount.value;
    DOM.ppWordCountDisplay.textContent = val;
    const min = parseInt(DOM.ppWordCount.min);
    const max = parseInt(DOM.ppWordCount.max);
    const pct = ((val - min) / (max - min)) * 100;
    DOM.ppWordCount.style.setProperty('--range-fill', pct + '%');
    if (currentMode === 'passphrase') generatePassphrase();
  });

  [DOM.ppSeparator, DOM.ppCapitalize, DOM.ppAddNumber, DOM.ppAddSpecial].forEach(el => {
    el.addEventListener('input', () => {
      if (currentMode === 'passphrase') generatePassphrase();
    });
    el.addEventListener('change', () => {
      if (currentMode === 'passphrase') generatePassphrase();
    });
  });

  DOM.modeTabs.forEach(tab => {
    tab.addEventListener('click', () => setMode(tab.dataset.mode));
  });

  DOM.clearHistory.addEventListener('click', () => {
    history = [];
    renderHistory();
    showToast('History cleared');
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (currentMode === 'password') generatePassword();
      else generatePassphrase();
    }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
      e.preventDefault();
      copyPassword();
    }
  });

  updateCharCountBadges();
  DOM.ppWordCount.dispatchEvent(new Event('input'));
  generatePassword();

})();