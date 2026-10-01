function toggleFaq(element) {
  const answer = element.nextElementSibling;
  const icon = element.querySelector('.faq-icon');
  if (!answer) return;

  const isOpen = answer.classList.contains('open');

  document.querySelectorAll('.faq-answer').forEach(el => {
    if (el !== answer) {
      el.classList.remove('open');
      const prevIcon = el.previousElementSibling?.querySelector('.faq-icon');
      if (prevIcon) prevIcon.classList.remove('open');
    }
  });

  if (isOpen) {
    answer.classList.remove('open');
    if (icon) icon.classList.remove('open');
  } else {
    answer.classList.add('open');
    if (icon) icon.classList.add('open');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const firstFaq = document.querySelector('.faq-answer');
  if (firstFaq) {
    firstFaq.classList.add('open');
    const icon = firstFaq.previousElementSibling?.querySelector('.faq-icon');
    if (icon) icon.classList.add('open');
  }
});

AOS.init({
  once: true,
  offset: 30,
  easing: 'ease-out-expo',
  duration: 900,
  disable: window.innerWidth < 768,
});

const PGP_FINGERPRINT = '45688382B815821F033115B8D92D6A10D29C8380';

function copyPGP() {
  navigator.clipboard.writeText(PGP_FINGERPRINT)
    .then(() => {
      showToast('PGP fingerprint copied!');
    })
    .catch(() => {
      const textArea = document.createElement('textarea');
      textArea.value = PGP_FINGERPRINT;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('PGP fingerprint copied!');
    });
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = [
    'fixed bottom-6 left-1/2 -translate-x-1/2',
    'bg-gray-800 text-white px-5 py-3',
    'rounded-full text-sm shadow-2xl',
    'border border-tor-violet/30 z-[9999]',
    'transition-all duration-300'
  ].join(' ');
  toast.innerHTML = '<i class="fas fa-check-circle text-tor-accent mr-2"></i> ' + message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => {
      showToast('Copied!');
    })
    .catch(() => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('Copied!');
    });
}

const SUSPICIOUS_TLDS = [
  'tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'club',
  'work', 'click', 'link', 'live', 'online', 'site',
  'website', 'space', 'fun', 'icu', 'vip', 'wang',
  'buzz', 'cyou', 'monster', 'quest'
];

const PHISHING_KEYWORDS = [
  'login', 'verify', 'secure', 'account', 'update', 'confirm',
  'signin', 'banking', 'password', 'credential', 'wallet',
  'payment', 'invoice', 'alert', 'suspended', 'locked',
  'unusual', 'recovery', 'authenticate', 'authorize',
  'validation', 'webscr', 'cmd', 'dispatch', 'paypal',
  'apple', 'microsoft', 'google', 'amazon', 'netflix',
  'facebook', 'instagram', 'whatsapp'
];

const BRAND_NAMES = [
  'paypal', 'apple', 'microsoft', 'google', 'amazon',
  'netflix', 'facebook', 'instagram', 'whatsapp', 'linkedin',
  'twitter', 'dropbox', 'adobe', 'coinbase', 'binance',
  'chase', 'wellsfargo', 'bankofamerica'
];

function analyzeUrl(rawUrl) {
  let url = rawUrl.trim();
  if (!url) return null;

  // Normalize protocol
  if (!/^https?:\/\//i.test(url)) {
    url = 'http://' + url;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return {
      status: 'danger',
      score: 100,
      label: 'Invalid URL',
      summary: 'The URL could not be parsed. This is highly suspicious.',
      indicators: [{
        type: 'danger',
        icon: 'fa-triangle-exclamation',
        text: 'Malformed URL structure'
      }],
      details: {
        'Raw input': rawUrl,
        'Parsed': 'Failed'
      }
    };
  }

  const hostname = parsed.hostname;
  const pathname = parsed.pathname;
  const search = parsed.search;
  const fullUrl = parsed.href;
  const tld = hostname.split('.').pop().toLowerCase();
  const parts = hostname.split('.');

  let score = 0;
  const indicators = [];
  const details = {};

  if (SUSPICIOUS_TLDS.includes(tld)) {
    score += 30;
    indicators.push({
      type: 'danger',
      icon: 'fa-globe',
      text: `High‑risk TLD .${tld}`
    });
  } else if (tld === 'onion') {
    score += 0;
    indicators.push({
      type: 'info',
      icon: 'fa-shield',
      text: 'Onion service (Tor) — verify manually'
    });
  } else {
    indicators.push({
      type: 'safe',
      icon: 'fa-check',
      text: `TLD .${tld} not in high‑risk list`
    });
  }

  if (hostname.length > 30) {
    score += 10;
    indicators.push({
      type: 'warn',
      icon: 'fa-ruler',
      text: `Long hostname (${hostname.length} chars)`
    });
  }

  const hyphenCount = (hostname.match(/-/g) || []).length;
  if (hyphenCount >= 2) {
    score += 15;
    indicators.push({
      type: 'warn',
      icon: 'fa-minus',
      text: `Multiple hyphens in hostname (${hyphenCount})`
    });
  }

  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    score += 40;
    indicators.push({
      type: 'danger',
      icon: 'fa-server',
      text: 'IP address used instead of domain name'
    });
  }

  if (parts.length > 4) {
    score += 15;
    indicators.push({
      type: 'warn',
      icon: 'fa-sitemap',
      text: `Deep subdomain nesting (${parts.length} levels)`
    });
  }

  const lowerHost = hostname.toLowerCase();
  for (const brand of BRAND_NAMES) {
    const isLegit = lowerHost.endsWith(brand + '.com')
      || lowerHost.endsWith(brand + '.org')
      || lowerHost.endsWith(brand + '.net');

    if (lowerHost.includes(brand) && !isLegit) {
      score += 35;
      indicators.push({
        type: 'danger',
        icon: 'fa-mask',
        text: `Possible brand impersonation: "${brand}"`
      });
      break;
    }
  }

  const lowerFull = fullUrl.toLowerCase();
  let keywordMatches = 0;
  const matchedKeywords = [];

  for (const kw of PHISHING_KEYWORDS) {
    if (lowerFull.includes(kw)) {
      keywordMatches++;
      matchedKeywords.push(kw);
    }
  }

  if (keywordMatches > 0) {
    score += Math.min(keywordMatches * 5, 25);
    const preview = matchedKeywords.slice(0, 3).join(', ');
    const suffix = matchedKeywords.length > 3 ? '…' : '';
    indicators.push({
      type: 'warn',
      icon: 'fa-key',
      text: `Suspicious keywords found: ${preview}${suffix}`
    });
  }

  if (fullUrl.length > 100) {
    score += 10;
    indicators.push({
      type: 'warn',
      icon: 'fa-ruler-combined',
      text: `Very long URL (${fullUrl.length} chars)`
    });
  }

  if (hostname.startsWith('xn--') || hostname.includes('xn--')) {
    score += 45;
    indicators.push({
      type: 'danger',
      icon: 'fa-language',
      text: 'Punycode/IDN homoglyph domain detected'
    });
  }

  if (fullUrl.includes('@') && !fullUrl.startsWith('mailto:')) {
    score += 35;
    indicators.push({
      type: 'danger',
      icon: 'fa-at',
      text: '@ symbol in URL — often used to obscure true domain'
    });
  }

  if (pathname.match(/\.(php|html?|aspx?)\.(php|html?|aspx?)$/i)) {
    score += 20;
    indicators.push({
      type: 'warn',
      icon: 'fa-file-code',
      text: 'Double file extension detected'
    });
  }

  if (fullUrl.startsWith('data:')) {
    score += 80;
    indicators.push({
      type: 'danger',
      icon: 'fa-database',
      text: 'Data URI scheme — can embed malicious content'
    });
  }

  if (parsed.protocol === 'http:') {
    score += 15;
    indicators.push({
      type: 'warn',
      icon: 'fa-lock-open',
      text: 'No HTTPS encryption (HTTP only)'
    });
  } else {
    indicators.push({
      type: 'safe',
      icon: 'fa-lock',
      text: 'HTTPS encryption present'
    });
  }

  score = Math.min(score, 100);

  let status, label, summary;
  if (score >= 60) {
    status = 'danger';
    label = 'Phishing Detected';
    summary = 'This URL exhibits multiple strong indicators of a phishing attempt. Do not visit.';
  } else if (score >= 30) {
    status = 'suspicious';
    label = 'Suspicious';
    summary = 'This URL has some risky characteristics. Proceed with extreme caution.';
  } else {
    status = 'safe';
    label = 'Likely Safe';
    summary = 'No strong phishing indicators found. Still verify before entering credentials.';
  }

  details['Protocol'] = parsed.protocol.replace(':', '');
  details['Hostname'] = hostname;
  details['Path'] = pathname.length > 40 ? pathname.slice(0, 37) + '…' : (pathname || '/');
  details['Query'] = search.length > 40 ? search.slice(0, 37) + '…' : (search || '(none)');
  details['Full URL'] = fullUrl.length > 60 ? fullUrl.slice(0, 57) + '…' : fullUrl;
  details['Risk Score'] = score + ' / 100';

  return {
    status,
    score,
    label,
    summary,
    indicators,
    details,
    url: fullUrl
  };
}

const urlInput = document.getElementById('url-input');
const scanBtn = document.getElementById('scan-btn');
const resultContainer = document.getElementById('result-container');
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history');

let history = JSON.parse(localStorage.getItem('phishing_history') || '[]');

function renderHistory() {
  if (!history.length) {
    historyList.innerHTML = '<p class="text-xs text-text-muted text-center py-4">No recent scans</p>';
    return;
  }

  historyList.innerHTML = history.slice(0, 5).map((item, idx) => {
    const statusColor = item.status === 'danger'
      ? 'text-red-500'
      : item.status === 'suspicious'
        ? 'text-amber-500'
        : 'text-emerald-500';

    const icon = item.status === 'danger'
      ? 'fa-circle-exclamation'
      : item.status === 'suspicious'
        ? 'fa-triangle-exclamation'
        : 'fa-circle-check';

    const displayUrl = item.url.length > 45
      ? item.url.slice(0, 42) + '…'
      : item.url;

    return `
      <div class="history-item" data-url="${item.url.replace(/"/g, '&quot;')}" data-index="${idx}">
        <div class="flex items-center gap-2 min-w-0">
          <i class="fas ${icon} ${statusColor} text-[0.6rem]"></i>
          <span class="url-text">${displayUrl}</span>
        </div>
        <span class="text-[0.6rem] text-text-muted flex-shrink-0">${item.score}</span>
      </div>
    `;
  }).join('');

  historyList.querySelectorAll('.history-item').forEach(el => {
    el.addEventListener('click', () => {
      const url = el.getAttribute('data-url');
      urlInput.value = url;
      performScan();
    });
  });
}

function addToHistory(result) {
  if (!result || !result.url) return;

  history = history.filter(h => h.url !== result.url);
  history.unshift({
    url: result.url,
    score: result.score,
    status: result.status,
    time: Date.now()
  });
  history = history.slice(0, 10);

  localStorage.setItem('phishing_history', JSON.stringify(history));
  renderHistory();
}

function clearHistory() {
  history = [];
  localStorage.removeItem('phishing_history');
  renderHistory();
  showToast('History cleared');
}

function performScan() {
  const raw = urlInput.value.trim();

  if (!raw) {
    showToast('Please enter a URL');
    urlInput.focus();
    return;
  }

  // Loading state
  scanBtn.disabled = true;
  scanBtn.innerHTML = '<div class="spinner"></div><span>Analyzing…</span>';
  resultContainer.innerHTML = '';

  setTimeout(() => {
    const result = analyzeUrl(raw);

    scanBtn.disabled = false;
    scanBtn.innerHTML = '<i class="fas fa-search"></i><span>Analyze</span>';

    if (!result) {
      showToast('Invalid URL');
      return;
    }

    renderResult(result);
    addToHistory(result);
  }, 600);
}

function renderResult(result) {
  const statusClass = result.status === 'danger'
    ? 'result-danger'
    : result.status === 'suspicious'
      ? 'result-suspicious'
      : result.status === 'safe'
        ? 'result-safe'
        : 'result-unknown';

  const statusIcon = result.status === 'danger'
    ? 'fa-circle-exclamation'
    : result.status === 'suspicious'
      ? 'fa-triangle-exclamation'
      : result.status === 'safe'
        ? 'fa-circle-check'
        : 'fa-circle-info';

  const statusColor = result.status === 'danger'
    ? 'text-red-500'
    : result.status === 'suspicious'
      ? 'text-amber-500'
      : result.status === 'safe'
        ? 'text-emerald-500'
        : 'text-tor-violet';

  const meterColor = result.status === 'danger'
    ? '#dc2626'
    : result.status === 'suspicious'
      ? '#f59e0b'
      : result.status === 'safe'
        ? '#68B030'
        : '#7c3aed';

  let html = `
    <div class="result-card ${statusClass} p-6 md:p-8">
      <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-5">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-white/60 flex items-center justify-center shadow-sm border border-white/40">
            <i class="fas ${statusIcon} ${statusColor} text-xl"></i>
          </div>
          <div>
            <h3 class="text-lg font-bold text-text-primary">${result.label}</h3>
            <p class="text-xs text-text-muted font-mono break-all max-w-xs">${result.url}</p>
          </div>
        </div>
        <div class="sm:ml-auto flex items-center gap-2">
          <span class="text-2xl font-bold ${statusColor}">${result.score}</span>
          <span class="text-xs text-text-muted">/ 100</span>
        </div>
      </div>

      <div class="risk-meter mb-5">
        <div class="risk-meter-fill" style="width: ${result.score}%; background: ${meterColor};"></div>
      </div>

      <p class="text-sm text-text-secondary mb-5 leading-relaxed">${result.summary}</p>
  `;

  if (result.indicators.length) {
    html += '<div class="flex flex-wrap gap-2 mb-5">';
    result.indicators.forEach(ind => {
      html += `<span class="indicator-pill ${ind.type}"><i class="fas ${ind.icon}"></i> ${ind.text}</span>`;
    });
    html += '</div>';
  }

  html += '<div class="mt-4 pt-4 border-t border-surface-border/40">';
  html += '<h4 class="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Technical Details</h4>';
  html += '<div class="space-y-0.5">';

  for (const [key, val] of Object.entries(result.details)) {
    html += `
      <div class="detail-row">
        <span class="detail-label">${key}</span>
        <span class="detail-value">${val}</span>
      </div>
    `;
  }

  html += '</div></div>';

  const safeUrl = result.url.replace(/'/g, "\\'");
  html += `
    <div class="flex flex-wrap items-center gap-3 mt-5 pt-4 border-t border-surface-border/40">
      <button onclick="copyToClipboard('${safeUrl}')" class="text-xs text-text-muted hover:text-tor-violet transition-colors bg-white/60 px-3 py-1.5 rounded-full border border-surface-border/40">
        <i class="fas fa-copy mr-1"></i> Copy URL
      </button>
      <button onclick="urlInput.value=''; resultContainer.innerHTML='';" class="text-xs text-text-muted hover:text-tor-violet transition-colors bg-white/60 px-3 py-1.5 rounded-full border border-surface-border/40">
        <i class="fas fa-rotate-right mr-1"></i> New Scan
      </button>
    </div>
  `;

  html += '</div>';
  resultContainer.innerHTML = html;
}

scanBtn.addEventListener('click', performScan);

urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    performScan();
  }
});

clearHistoryBtn.addEventListener('click', clearHistory);

renderHistory();

urlInput.addEventListener('focus', function () {
  if (!this.value) {
    this.placeholder = 'Try: http://paypal-secure-login.xyz/verify?token=abc123';
  }
});