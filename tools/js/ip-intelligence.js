(function () {
  'use strict';

  const CONFIG = {
    GEO_API: 'https://ipapi.co',
    DNS_API: 'https://dns.google/resolve',
    ABUSEIPDB: {
      enabled: false,
      apiKey: 'YOUR_ABUSEIPDB_API_KEY',
      url: 'https://api.abuseipdb.com/api/v2/check',
      maxAgeDays: 90
    },
    RDAP_BOOTSTRAP: 'https://rdap.org/ip',
    HISTORY_KEY: 'ricalnet_ip_history',
    MAX_HISTORY: 12,
    MAX_BULK: 20
  };

  const PGP_FINGERPRINT = '45688382B815821F033115B8D92D6A10D29C8380';

  AOS.init({
    once: true,
    offset: 30,
    easing: 'ease-out-expo',
    duration: 900,
    disable: window.innerWidth < 768 ? true : false,
  });

  function showToast(message, isError) {
    const existing = document.querySelector('.ip-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'ip-toast fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-full text-sm shadow-2xl border border-tor-violet/30 z-[9999] transition-all duration-300 opacity-0 translate-y-4';
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
      return;
    }
    const done = () => { if (!silent) showToast('Copied to clipboard!'); };
    navigator.clipboard.writeText(text).then(done).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      done();
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

  function formatNumber(n) {
    if (n === null || n === undefined || n === '') return '—';
    if (typeof n === 'number') return n.toLocaleString();
    const num = Number(n);
    return isNaN(num) ? String(n) : num.toLocaleString();
  }

  function formatCoord(v) {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    return isNaN(n) ? String(v) : n.toFixed(4);
  }

  function boolToText(v) {
    if (v === true) return 'Yes';
    if (v === false) return 'No';
    return '—';
  }

  function getFlagUrl(code) {
    if (!code || code.length !== 2) return '';
    return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
  }

  function parseFlexibleInput(input) {
    const trimmed = (input || '').trim();
    if (!trimmed) return null;

    const ipv4 = /^((25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(25[0-5]|2[0-4]\d|[01]?\d?\d)$/;
    const ipv4Port = /^((25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(25[0-5]|2[0-4]\d|[01]?\d?\d):(\d{1,5})$/;
    const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    const domainRe = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    const domainPort = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}:(\d{1,5})$/;

    if (ipv4.test(trimmed)) {
      return { type: 'ip', value: trimmed, original: trimmed };
    }
    if (ipv4Port.test(trimmed)) {
      return { type: 'ip', value: trimmed.split(':')[0], original: trimmed };
    }
    if (ipv6.test(trimmed)) {
      return { type: 'ip', value: trimmed, original: trimmed };
    }
    if (/^https?:\/\//i.test(trimmed)) {
      try {
        const u = new URL(trimmed);
        const host = u.hostname;
        if (ipv4.test(host) || ipv6.test(host)) {
          return { type: 'ip', value: host, original: trimmed };
        }
        if (domainRe.test(host)) {
          return { type: 'domain', value: host, original: trimmed };
        }
      } catch (e) {
      }
    }
    if (domainPort.test(trimmed)) {
      return { type: 'domain', value: trimmed.split(':')[0], original: trimmed };
    }
    if (domainRe.test(trimmed)) {
      return { type: 'domain', value: trimmed, original: trimmed };
    }

    return null;
  }

  async function resolveDomain(domain) {
    const res = await fetch(`${CONFIG.DNS_API}?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`DNS lookup failed (HTTP ${res.status})`);
    const data = await res.json();
    if (data.Status !== 0) {
      throw new Error(`DNS error: ${data.Comment || 'Status ' + data.Status}`);
    }
    if (!data.Answer || data.Answer.length === 0) {
      throw new Error('No A record found for this domain');
    }
    const a = data.Answer.find(r => r.type === 1);
    if (!a) throw new Error('No IPv4 record available');
    return a.data;
  }

  async function fetchGeo(ip) {
    const res = await fetch(`${CONFIG.GEO_API}/${encodeURIComponent(ip)}/json/`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error(`Geo lookup failed (HTTP ${res.status})`);
    const data = await res.json();
    if (data.error || !data.ip) {
      throw new Error(data.reason || data.error || 'Invalid IP or lookup failed');
    }
    return data;
  }

  function getHistory() {
    try {
      const raw = localStorage.getItem(CONFIG.HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(CONFIG.HISTORY_KEY, JSON.stringify(list));
    } catch (e) { /* quota */ }
  }

  function addToHistory(ip) {
    if (!ip) return;
    let list = getHistory();
    list = list.filter(item => item !== ip);
    list.unshift(ip);
    if (list.length > CONFIG.MAX_HISTORY) list.length = CONFIG.MAX_HISTORY;
    saveHistory(list);
    renderHistory();
  }

  function removeFromHistory(ip) {
    const list = getHistory().filter(item => item !== ip);
    saveHistory(list);
    renderHistory();
  }

  function clearHistory() {
    saveHistory([]);
    renderHistory();
  }

  function renderHistory() {
    const container = $('history-list');
    const section = $('history-section');
    const list = getHistory();
    if (list.length === 0) {
      section.classList.add('hidden');
      return;
    }
    section.classList.remove('hidden');
    container.innerHTML = '';
    list.forEach(ip => {
      const chip = document.createElement('span');
      chip.className = 'history-chip';
      chip.innerHTML = `
        <span class="ip-text">${escapeHtml(ip)}</span>
        <button class="remove-btn" data-ip="${escapeHtml(ip)}" title="Remove" type="button">
          <i class="fas fa-xmark"></i>
        </button>
      `;
      chip.addEventListener('click', (e) => {
        if (e.target.closest('.remove-btn')) return;
        elements.input.value = ip;
        setMode('single');
        lookupFlexible(ip);
      });
      chip.querySelector('.remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromHistory(ip);
      });
      container.appendChild(chip);
    });
  }

  let currentMode = 'single';

  function setMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    const bulk = $('bulk-section');
    if (mode === 'bulk') {
      bulk.classList.remove('hidden');
    } else {
      bulk.classList.add('hidden');
      $('bulk-results').classList.add('hidden');
    }
  }

  const PUBLIC_DNS = new Set([
    '8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1', '9.9.9.9', '149.112.112.112',
    '208.67.222.222', '208.67.220.220', '76.76.19.19', '76.223.122.150',
    '185.228.168.168', '185.228.169.168', '77.88.8.8', '77.88.8.1',
    '64.6.64.6', '64.6.65.6', '156.154.70.1', '156.154.71.1', '84.200.69.80',
    '84.200.70.40', '94.140.14.14', '94.140.15.15', '10.0.0.1'
  ]);

  const CLOUD_KW = ['amazon', 'aws', 'google cloud', 'gcp', 'azure', 'microsoft',
    'digitalocean', 'linode', 'vultr', 'hetzner', 'ovh', 'scaleway', 'cloudflare',
    'akamai', 'fastly', 'edgecast', 'leaseweb', 'netcup', 'contabo', 'ionos',
    'godaddy', 'rackspace', 'oracle cloud', 'alibaba cloud', 'tencent cloud',
    'hostinger', 'namecheap', 'equinix'];

  const VPN_KW = ['vpn', 'proxy', 'tor exit', 'tor-relay', 'nordvpn', 'expressvpn',
    'surfshark', 'cyberghost', 'private internet access', 'mullvad', 'protonvpn',
    'windscribe', 'ivpn', 'vyprvpn', 'torguard', 'ipvanish', 'purevpn', 'zenmate',
    'tunnelbear', 'hide.me', 'hotspot shield', 'anonymizer', 'socks', 'shadowsocks',
    'v2ray', 'wireguard', 'openvpn', 'datapacket'];

  const DC_KW = ['datacenter', 'data center', 'hosting', 'server', 'colo',
    'colocation', 'dedicated', 'vps', 'infrastructure', 'hosting provider',
    'web hosting', 'cloud hosting'];

  const HIGH_RISK_CC = new Set(['ru', 'cn', 'ir', 'kp', 'sy', 've', 'by', 'sa',
    'pk', 'af', 'iq', 'ly', 'ye', 'so', 'sd']);
  const MED_RISK_CC = new Set(['in', 'br', 'mx', 'za', 'ng', 'bd', 'vn', 'ph',
    'eg', 'id', 'th', 'ua', 'ro', 'bg', 'pl', 'hu', 'tr']);

  function assessSecurity(data) {
    const ip = (data.ip || '').toLowerCase();
    const org = (data.org || '').toLowerCase();
    const asn = (data.asn || '').toLowerCase();
    const cc = (data.country_code || '').toLowerCase();

    const badges = [];
    let score = 0;

    if (PUBLIC_DNS.has(ip)) {
      badges.push({ label: 'Public DNS', type: 'green', icon: 'fa-check-circle' });
    }

    const isCloud = CLOUD_KW.some(kw => org.includes(kw) || asn.includes(kw));
    const isVpn = VPN_KW.some(kw => org.includes(kw) || asn.includes(kw));
    const isDC = DC_KW.some(kw => org.includes(kw) || asn.includes(kw));

    if (isVpn) {
      badges.push({ label: 'VPN / Proxy / Tor', type: 'red', icon: 'fa-user-secret' });
      score += 35;
    }
    if (isCloud) {
      badges.push({ label: 'Cloud / Hosting', type: 'yellow', icon: 'fa-cloud' });
      score += 10;
    } else if (isDC) {
      badges.push({ label: 'Data Center', type: 'yellow', icon: 'fa-server' });
      score += 8;
    }

    if (!isCloud && !isVpn && !isDC && !PUBLIC_DNS.has(ip)) {
      badges.push({ label: 'ISP / Residential', type: 'green', icon: 'fa-house' });
    }

    if (HIGH_RISK_CC.has(cc)) {
      score += 25;
      badges.push({ label: 'High Risk Region', type: 'red', icon: 'fa-triangle-exclamation' });
    } else if (MED_RISK_CC.has(cc)) {
      score += 8;
      badges.push({ label: 'Medium Risk Region', type: 'yellow', icon: 'fa-triangle-exclamation' });
    }

    score = Math.max(0, Math.min(100, score));

    let level, statusText, scoreClass, grade;
    if (score >= 40) {
      level = 'high'; statusText = 'Caution'; scoreClass = 'low'; grade = 'D';
    } else if (score >= 15) {
      level = 'medium'; statusText = 'Moderate'; scoreClass = 'medium'; grade = 'C';
    } else if (score >= 5) {
      level = 'low'; statusText = 'Low Risk'; scoreClass = 'high'; grade = 'B';
    } else {
      level = 'low'; statusText = 'Secure'; scoreClass = 'high'; grade = 'A';
    }

    if (badges.length === 0) {
      badges.push({ label: 'Unknown Classification', type: 'gray', icon: 'fa-question' });
    }

    const seen = new Set();
    const unique = [];
    badges.forEach(b => {
      if (!seen.has(b.label)) { seen.add(b.label); unique.push(b); }
    });

    return { badges: unique, score, level, statusText, scoreClass, grade };
  }

  function renderSecurity(data) {
    const a = assessSecurity(data);
    const ring = $('security-score-ring');
    ring.textContent = a.grade;
    ring.className = `security-score ${a.scoreClass}`;
    $('security-status').textContent = a.statusText;
    $('security-sub').textContent = `Risk: ${a.level} · Score: ${a.score}/100`;

    const badgeWrap = $('security-badges');
    badgeWrap.innerHTML = '';
    a.badges.forEach(b => {
      const span = document.createElement('span');
      span.className = `security-badge ${b.type}`;
      span.innerHTML = `<i class="fas ${b.icon}"></i> ${escapeHtml(b.label)}`;
      badgeWrap.appendChild(span);
    });

    const details = $('security-details');
    details.innerHTML = '';
    [
      ['Organization', data.org],
      ['ASN', data.asn],
      ['Country', data.country_name],
      ['City', data.city]
    ].forEach(([k, v]) => {
      if (v && v !== '—') {
        const div = document.createElement('div');
        div.className = 'flex justify-between gap-2 text-xs';
        div.innerHTML = `<span class="text-text-muted">${escapeHtml(k)}</span><span class="text-text-primary font-medium truncate">${escapeHtml(v)}</span>`;
        details.appendChild(div);
      }
    });
  }

  async function fetchReputation(ip) {
    const loading = $('reputation-loading');
    const dataEl = $('reputation-data');
    const errEl = $('reputation-error');
    const errMsg = $('reputation-error-msg');

    loading.classList.remove('hidden');
    dataEl.classList.add('hidden');
    errEl.classList.add('hidden');

    if (!CONFIG.ABUSEIPDB.enabled || !CONFIG.ABUSEIPDB.apiKey ||
        CONFIG.ABUSEIPDB.apiKey === 'YOUR_ABUSEIPDB_API_KEY') {
      loading.classList.add('hidden');
      errEl.classList.remove('hidden');
      errMsg.textContent = 'Reputation check is not enabled. Configure your free AbuseIPDB API key to enable.';
      return;
    }

    try {
      const res = await fetch(
        `${CONFIG.ABUSEIPDB.url}?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=${CONFIG.ABUSEIPDB.maxAgeDays}&verbose`,
        {
          headers: {
            'Key': CONFIG.ABUSEIPDB.apiKey,
            'Accept': 'application/json'
          }
        }
      );
      if (!res.ok) {
        if (res.status === 401) throw new Error('Invalid AbuseIPDB API key.');
        if (res.status === 429) throw new Error('Rate limit exceeded. Try again later.');
        throw new Error(`HTTP ${res.status}`);
      }
      const result = await res.json();
      if (!result.data) throw new Error('No reputation data returned');

      loading.classList.add('hidden');
      dataEl.classList.remove('hidden');

      const d = result.data;
      const confidence = d.abuseConfidenceScore || 0;
      const totalReports = d.totalReports || 0;
      const lastReport = d.lastReportAt ? new Date(d.lastReportAt).toLocaleDateString() : 'Never';
      const country = d.countryCode || '—';
      const isp = d.isp || '—';
      const domain = d.domain || '—';
      const usageType = d.usageType || '—';

      let status, statusClass;
      if (confidence >= 75) { status = 'Malicious'; statusClass = 'malicious'; }
      else if (confidence >= 25) { status = 'Suspicious'; statusClass = 'suspicious'; }
      else if (confidence > 0) { status = 'Low Risk'; statusClass = 'safe'; }
      else if (totalReports === 0) { status = 'Clean'; statusClass = 'safe'; }
      else { status = 'Unknown'; statusClass = 'unknown'; }

      const ring = $('reputation-score-ring');
      ring.textContent = confidence > 0 ? Math.round(confidence) : '✓';
      ring.className = `reputation-score-ring ${statusClass}`;

      $('reputation-status').textContent = status;
      $('reputation-sub').textContent = `Confidence: ${confidence}% · ${totalReports} report(s)`;

      const bar = $('reputation-confidence-bar');
      bar.style.width = `${confidence}%`;
      bar.className = `fill ${statusClass}`;
      $('reputation-confidence-label').textContent = `${confidence}%`;

      const badgeWrap = $('reputation-badges');
      badgeWrap.innerHTML = '';
      if (totalReports > 0) {
        const b = document.createElement('span');
        b.className = `reputation-badge ${statusClass}`;
        b.innerHTML = `<i class="fas fa-flag"></i> ${totalReports} report(s)`;
        badgeWrap.appendChild(b);
      }
      if (lastReport !== 'Never') {
        const b = document.createElement('span');
        b.className = 'reputation-badge unknown';
        b.innerHTML = `<i class="fas fa-calendar"></i> Last: ${escapeHtml(lastReport)}`;
        badgeWrap.appendChild(b);
      }
      if (usageType && usageType !== '—') {
        const b = document.createElement('span');
        b.className = 'reputation-badge unknown';
        b.innerHTML = `<i class="fas fa-tag"></i> ${escapeHtml(usageType)}`;
        badgeWrap.appendChild(b);
      }
      if (badgeWrap.children.length === 0) {
        const b = document.createElement('span');
        b.className = 'reputation-badge safe';
        b.innerHTML = '<i class="fas fa-check-circle"></i> No reports';
        badgeWrap.appendChild(b);
      }

      const details = $('reputation-details');
      details.innerHTML = '';
      [
        ['ISP', isp], ['Domain', domain], ['Country', country],
        ['Usage Type', usageType], ['Last Report', lastReport]
      ].forEach(([k, v]) => {
        if (v && v !== '—' && v !== '') {
          const div = document.createElement('div');
          div.className = 'flex justify-between gap-2 text-xs';
          div.innerHTML = `<span class="text-text-muted">${escapeHtml(k)}</span><span class="text-text-primary font-medium truncate" title="${escapeHtml(v)}">${escapeHtml(v)}</span>`;
          details.appendChild(div);
        }
      });
    } catch (err) {
      console.warn('Reputation fetch error:', err);
      loading.classList.add('hidden');
      errEl.classList.remove('hidden');
      errMsg.textContent = err.message || 'Failed to fetch reputation data.';
    }
  }

  async function fetchWhois(ip) {
    const modal = $('whois-modal');
    const content = $('whois-modal-content');
    const ipDisplay = $('whois-modal-ip');
    const loading = $('whois-modal-loading');

    ipDisplay.textContent = ip;
    loading.classList.remove('hidden');
    content.innerHTML = '<span class="empty"><i class="fas fa-spinner fa-spin"></i> Fetching whois data…</span>';
    modal.classList.add('open');

    try {
      const res = await fetch(`${CONFIG.RDAP_BOOTSTRAP}/${encodeURIComponent(ip)}`, {
        headers: { 'Accept': 'application/rdap+json, application/json' }
      });
      loading.classList.add('hidden');

      if (!res.ok) {
        content.innerHTML = `<span class="empty">No RDAP/WHOIS data available for this IP (HTTP ${res.status}).<br><br>Tip: RDAP is available for public IP ranges only.</span>`;
        return;
      }

      const data = await res.json();
      const lines = [];

      if (data.name) lines.push(`Name: ${data.name}`);
      if (data.handle) lines.push(`Handle: ${data.handle}`);
      if (data.startAddress && data.endAddress) {
        lines.push(`Range: ${data.startAddress} — ${data.endAddress}`);
      }
      if (data.type) lines.push(`Type: ${data.type}`);
      if (data.parentHandle) lines.push(`Parent: ${data.parentHandle}`);

      if (data.country) lines.push(`Country: ${data.country}`);

      if (Array.isArray(data.entities)) {
        lines.push('');
        lines.push('Entities:');
        data.entities.forEach((e, i) => {
          const roles = (e.roles || []).join(', ') || 'unknown';
          lines.push(`  [${i + 1}] ${e.handle || 'unnamed'} — Roles: ${roles}`);
          if (Array.isArray(e.vcardArray) && e.vcardArray[1]) {
            e.vcardArray[1].forEach(item => {
              if (Array.isArray(item) && item.length >= 4) {
                const key = item[0];
                const val = item[3];
                if (key && val && typeof val === 'string' && val.length < 200) {
                  lines.push(`      ${key}: ${val}`);
                }
              }
            });
          }
        });
      }

      if (Array.isArray(data.events)) {
        lines.push('');
        lines.push('Events:');
        data.events.forEach(ev => {
          if (ev.eventAction && ev.eventDate) {
            lines.push(`  ${ev.eventAction}: ${ev.eventDate}`);
          }
        });
      }

      if (Array.isArray(data.remarks)) {
        data.remarks.forEach(r => {
          if (r.description && r.description.length) {
            lines.push('');
            lines.push('Remarks:');
            r.description.forEach(d => lines.push(`  ${d}`));
          }
        });
      }

      if (Array.isArray(data.links)) {
        lines.push('');
        lines.push('Links:');
        data.links.forEach(l => {
          if (l.href) lines.push(`  ${l.href}`);
        });
      }

      if (Array.isArray(data.notices)) {
        data.notices.forEach(n => {
          if (n.title) lines.push('');
          if (n.title) lines.push(`${n.title}:`);
          if (Array.isArray(n.description)) {
            n.description.forEach(d => lines.push(`  ${d}`));
          }
        });
      }

      if (lines.length === 0) {
        content.innerHTML = `<span class="empty">No detailed whois/RDAP fields available.<br><br>Raw response:<br><br><pre style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(JSON.stringify(data, null, 2).slice(0, 3000))}</pre></span>`;
      } else {
        content.textContent = lines.join('\n');
      }
    } catch (err) {
      console.warn('Whois fetch error:', err);
      loading.classList.add('hidden');
      content.innerHTML = `<span class="empty">Unable to fetch whois data: ${escapeHtml(err.message || 'Network error')}</span>`;
    }
  }

  let mapInstance = null;
  let mapSatellite = false;

  function initMap(lat, lng, city, country) {
    if (typeof L === 'undefined') {
      showMapNotAvailable();
      return;
    }
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }

    $('map').classList.remove('hidden');
    $('map-not-available').classList.add('hidden');

    const tileUrl = mapSatellite
      ? 'https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const subdomains = mapSatellite ? ['mt0', 'mt1', 'mt2', 'mt3'] : 'abc';
    const attribution = mapSatellite ? '&copy; Google' :
      '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors';

    mapInstance = L.map('map', { center: [lat, lng], zoom: 11 });
    L.tileLayer(tileUrl, { maxZoom: 19, attribution, subdomains }).addTo(mapInstance);

    const icon = L.divIcon({
      className: 'custom-marker',
      html: '<div class="inner"><i class="fas fa-location-dot"></i></div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -36]
    });

    const title = [city, country].filter(Boolean).join(', ') || 'Location';
    L.marker([lat, lng], { icon })
      .addTo(mapInstance)
      .bindPopup(
        `<div style="font-weight:600;font-size:0.9rem;">${escapeHtml(title)}</div>
         <div style="font-size:0.7rem;color:#666;margin-top:2px;">${lat.toFixed(4)}, ${lng.toFixed(4)}</div>`
      )
      .openPopup();

    L.circle([lat, lng], {
      radius: 50000,
      color: '#7c3aed',
      fillColor: '#7c3aed',
      fillOpacity: 0.08,
      weight: 1.5,
      dashArray: '6 6'
    }).addTo(mapInstance);

    setTimeout(() => { if (mapInstance) mapInstance.invalidateSize(); }, 200);
  }

  function showMapNotAvailable() {
    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }
    $('map').classList.add('hidden');
    $('map-not-available').classList.remove('hidden');
  }

  function focusMap() {
    if (!mapInstance || !currentData) return;
    const lat = Number(currentData.latitude);
    const lng = Number(currentData.longitude);
    if (isNaN(lat) || isNaN(lng)) return;
    mapInstance.fitBounds(
      L.latLngBounds(
        L.latLng(lat - 0.3, lng - 0.3),
        L.latLng(lat + 0.3, lng + 0.3)
      ),
      { padding: [40, 40] }
    );
  }

  let currentData = null;
  let lastLookup = '';
  let shareVisible = false;

  const elements = {
    input: $('ip-input'),
    lookupBtn: $('lookup-btn'),
    myIpBtn: $('my-ip-btn'),
    clearBtn: $('clear-btn'),
    retryBtn: $('retry-btn'),
    loading: $('loading-state'),
    error: $('error-state'),
    errorMsg: $('error-message'),
    results: $('results-container'),
    empty: $('empty-state'),
    rawToggle: $('raw-toggle'),
    rawPanel: $('raw-panel'),
    rawJson: $('raw-json')
  };

  function renderResults(data) {
    currentData = data;

    $('result-ip').textContent = data.ip || '—';
    $('result-version').textContent = data.version || '—';
    $('result-org').textContent = data.org || '—';
    $('result-asn').textContent = data.asn || '—';

    const flagUrl = getFlagUrl(data.country_code);
    const flag = $('result-flag');
    if (flagUrl) {
      flag.style.backgroundImage = `url(${flagUrl})`;
      flag.style.display = 'inline-block';
    } else {
      flag.style.display = 'none';
    }

    $('result-country-name').textContent = data.country_name || '—';
    $('result-country-code').textContent = data.country_code || '—';

    $('result-city').textContent = data.city || '—';
    $('result-region').textContent = data.region || '—';
    $('result-postal').textContent = data.postal || '—';
    const lat = formatCoord(data.latitude);
    const lng = formatCoord(data.longitude);
    $('result-coords').textContent = (lat !== '—' || lng !== '—') ? `${lat}, ${lng}` : '—';

    $('result-network').textContent = data.network || '—';
    $('result-asn-detail').textContent = data.asn || '—';
    $('result-org-detail').textContent = data.org || '—';
    $('result-version-detail').textContent = data.version || '—';

    $('result-country-full').textContent = data.country_name || '—';
    $('result-country-code-detail').textContent = data.country_code || '—';
    $('result-capital').textContent = data.country_capital || '—';
    $('result-tld').textContent = data.country_tld || '—';
    $('result-continent').textContent = data.continent_code || '—';
    $('result-in-eu').textContent = boolToText(data.in_eu);

    $('result-timezone').textContent = data.timezone || '—';
    $('result-utc').textContent = data.utc_offset || '—';
    $('result-currency').textContent =
      data.currency_name ? `${data.currency || ''} (${data.currency_name})` : (data.currency || '—');
    $('result-languages').textContent = data.languages || '—';
    $('result-calling').textContent = data.country_calling_code || '—';

    $('result-area').textContent = formatNumber(data.country_area);
    $('result-population').textContent = formatNumber(data.country_population);
    $('result-iso3').textContent = data.country_code_iso3 || '—';

    elements.rawJson.textContent = JSON.stringify(data, null, 2);

    const latN = Number(data.latitude);
    const lngN = Number(data.longitude);
    if (!isNaN(latN) && !isNaN(lngN)) {
      initMap(latN, lngN, data.city, data.country_name);
    } else {
      showMapNotAvailable();
    }

    renderSecurity(data);
    if (data.ip) fetchReputation(data.ip);

    elements.empty.classList.add('hidden');
    elements.loading.classList.add('hidden');
    elements.error.classList.add('hidden');
    elements.results.classList.remove('hidden');
    elements.results.classList.add('result-enter');

    $('share-section').classList.add('hidden');
    shareVisible = false;

    lastLookup = data.ip || '';

    if (data.ip) addToHistory(data.ip);

    setTimeout(() => {
      elements.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  async function lookupFlexible(rawInput) {
    const parsed = parseFlexibleInput(rawInput);

    if (!parsed) {
      showToast('Invalid input. Enter an IP, domain, or URL.', true);
      return;
    }

    elements.loading.classList.remove('hidden');
    elements.error.classList.add('hidden');
    elements.results.classList.add('hidden');
    elements.empty.classList.add('hidden');

    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }

    $('reputation-loading').classList.remove('hidden');
    $('reputation-data').classList.add('hidden');
    $('reputation-error').classList.add('hidden');

    try {
      let ip = parsed.value;

      if (parsed.type === 'domain') {
        try {
          const resolved = await resolveDomain(parsed.value);
          ip = resolved;
          showToast(`Resolved ${parsed.value} → ${resolved}`);
        } catch (dnsErr) {
          throw new Error(`DNS resolution failed: ${dnsErr.message}`);
        }
      }

      const data = await fetchGeo(ip);
      renderResults(data);
    } catch (err) {
      console.warn('Lookup error:', err);
      elements.loading.classList.add('hidden');
      elements.error.classList.remove('hidden');
      elements.errorMsg.textContent = err.message || 'Lookup failed. Please try again.';
      elements.results.classList.add('hidden');
      elements.empty.classList.add('hidden');
    }
  }

  async function bulkLookup(inputLines) {
    const unique = [...new Set(
      inputLines.map(i => i.trim()).filter(i => i)
    )];

    if (unique.length === 0) {
      showToast('Enter at least one IP.', true);
      return;
    }
    if (unique.length > CONFIG.MAX_BULK) {
      showToast(`Maximum ${CONFIG.MAX_BULK} IPs at a time.`, true);
      return;
    }

    const tbody = $('bulk-tbody');
    const resultsDiv = $('bulk-results');
    resultsDiv.classList.remove('hidden');
    tbody.innerHTML = '';

    unique.forEach(ip => {
      const id = 'bulk-row-' + ip.replace(/[^a-zA-Z0-9]/g, '-');
      const tr = document.createElement('tr');
      tr.id = id;
      tr.innerHTML = `
        <td><span class="font-mono text-xs">${escapeHtml(ip)}</span></td>
        <td><span class="text-text-muted">…</span></td>
        <td><span class="text-text-muted">…</span></td>
        <td><span class="text-text-muted">…</span></td>
        <td><span class="status-badge loading"><i class="fas fa-spinner fa-spin"></i> Loading</span></td>
        <td><span class="text-text-muted text-xs">—</span></td>
      `;
      tbody.appendChild(tr);
    });

    for (let i = 0; i < unique.length; i++) {
      const ip = unique[i];
      const id = 'bulk-row-' + ip.replace(/[^a-zA-Z0-9]/g, '-');
      const row = document.getElementById(id);
      if (!row) continue;

      try {
        if (i > 0) await new Promise(r => setTimeout(r, 700));

        const data = await fetchGeo(ip);
        const flag = getFlagUrl(data.country_code);

        row.innerHTML = `
          <td><span class="font-mono text-xs">${escapeHtml(data.ip)}</span></td>
          <td>${flag ? `<img src="${flag}" alt="" class="inline-block w-4 h-3 mr-1 rounded object-cover" />` : ''}${escapeHtml(data.country_name || '—')}</td>
          <td>${escapeHtml(data.city || '—')}</td>
          <td class="max-w-[140px] truncate" title="${escapeHtml(data.org || '—')}">${escapeHtml(data.org || '—')}</td>
          <td><span class="status-badge success"><i class="fas fa-check-circle"></i> OK</span></td>
          <td><button class="bulk-view-btn text-tor-violet hover:underline text-xs font-medium" data-ip="${escapeHtml(data.ip)}" type="button"><i class="fas fa-eye"></i> View</button></td>
        `;
        row._data = data;
      } catch (err) {
        row.innerHTML = `
          <td><span class="font-mono text-xs">${escapeHtml(ip)}</span></td>
          <td><span class="text-text-muted">—</span></td>
          <td><span class="text-text-muted">—</span></td>
          <td><span class="text-text-muted">—</span></td>
          <td><span class="status-badge error"><i class="fas fa-times-circle"></i> Error</span></td>
          <td><span class="text-text-muted text-xs" title="${escapeHtml(err.message)}">${escapeHtml((err.message || 'Failed').slice(0, 20))}</span></td>
        `;
      }
    }

    tbody.querySelectorAll('.bulk-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('tr');
        const ip = btn.dataset.ip;
        if (row && row._data) {
          elements.input.value = ip;
          setMode('single');
          renderResults(row._data);
        } else {
          elements.input.value = ip;
          setMode('single');
          lookupFlexible(ip);
        }
      });
    });

    showToast(`Bulk lookup complete (${unique.length} IPs).`);
  }

  function exportCSV(data) {
    if (!data) return;
    const rows = [
      ['IP', data.ip || ''],
      ['Version', data.version || ''],
      ['City', data.city || ''],
      ['Region', data.region || ''],
      ['Country', data.country_name || ''],
      ['Country Code', data.country_code || ''],
      ['Capital', data.country_capital || ''],
      ['TLD', data.country_tld || ''],
      ['Continent', data.continent_code || ''],
      ['EU Member', data.in_eu ? 'Yes' : 'No'],
      ['Postal', data.postal || ''],
      ['Latitude', data.latitude || ''],
      ['Longitude', data.longitude || ''],
      ['Timezone', data.timezone || ''],
      ['UTC Offset', data.utc_offset || ''],
      ['Currency', data.currency || ''],
      ['Currency Name', data.currency_name || ''],
      ['Languages', data.languages || ''],
      ['Calling Code', data.country_calling_code || ''],
      ['Area (km²)', data.country_area || ''],
      ['Population', data.country_population || ''],
      ['ISO3', data.country_code_iso3 || ''],
      ['ASN', data.asn || ''],
      ['Organization', data.org || ''],
      ['Network', data.network || '']
    ];

    let csv = '\uFEFF';
    csv += rows.map(r => `"${r[0]}"`).join(',') + '\n';
    csv += rows.map(r => `"${String(r[1]).replace(/"/g, '""')}"`).join(',');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `IP_${data.ip || 'lookup'}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);

    showToast('CSV exported.');
  }

  elements.lookupBtn.addEventListener('click', () => {
    if (currentMode === 'bulk') {
      const lines = $('bulk-input').value.split('\n');
      bulkLookup(lines);
      return;
    }
    const v = elements.input.value.trim();
    if (!v) {
      showToast('Please enter an IP, domain, or URL.', true);
      return;
    }
    lookupFlexible(v);
  });

  elements.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && currentMode === 'single') {
      e.preventDefault();
      elements.lookupBtn.click();
    }
  });

  elements.myIpBtn.addEventListener('click', () => {
    elements.input.value = '';
    setMode('single');
    lookupFlexible('');
  });

  elements.clearBtn.addEventListener('click', () => {
    elements.input.value = '';
    $('bulk-input').value = '';
    $('bulk-results').classList.add('hidden');

    elements.results.classList.add('hidden');
    elements.empty.classList.remove('hidden');
    elements.error.classList.add('hidden');
    elements.loading.classList.add('hidden');

    currentData = null;
    lastLookup = '';

    if (mapInstance) {
      mapInstance.remove();
      mapInstance = null;
    }

    $('map').classList.remove('hidden');
    $('map-not-available').classList.add('hidden');

    $('security-badges').innerHTML = '';
    $('security-details').innerHTML = '';
    $('security-score-ring').textContent = '—';
    $('security-score-ring').className = 'security-score high';
    $('security-status').textContent = '—';
    $('security-sub').textContent = '—';

    $('share-section').classList.add('hidden');
    shareVisible = false;

    $('reputation-loading').classList.remove('hidden');
    $('reputation-data').classList.add('hidden');
    $('reputation-error').classList.add('hidden');
  });

  elements.retryBtn.addEventListener('click', () => {
    const v = elements.input.value.trim();
    if (!v) {
      showToast('Nothing to retry.', true);
      return;
    }
    lookupFlexible(v);
  });

  document.querySelectorAll('.example-ip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const v = btn.dataset.ip;
      elements.input.value = v;
      setMode('single');
      lookupFlexible(v);
    });
  });

  document.querySelectorAll('.hint-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const v = tag.dataset.value;
      elements.input.value = v;
      setMode('single');
      lookupFlexible(v);
    });
  });

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  $('copy-ip-btn').addEventListener('click', () => {
    if (currentData && currentData.ip) copyToClipboard(currentData.ip);
  });

  $('whois-btn').addEventListener('click', () => {
    if (currentData && currentData.ip) fetchWhois(currentData.ip);
  });

  $('share-btn').addEventListener('click', () => {
    shareVisible = !shareVisible;
    $('share-section').classList.toggle('hidden', !shareVisible);
  });

  document.querySelectorAll('[data-share]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!currentData) return;
      const url = `${location.origin}${location.pathname}?ip=${encodeURIComponent(currentData.ip)}`;
      const feedback = $('share-feedback');

      let text = '';
      switch (btn.dataset.share) {
        case 'link':
          text = url;
          break;
        case 'markdown':
          text = `**IP Intelligence** — \`${currentData.ip}\`\n` +
                 `- Location: ${currentData.city || '—'}, ${currentData.country_name || '—'}\n` +
                 `- Organization: ${currentData.org || '—'}\n` +
                 `- ASN: ${currentData.asn || '—'}\n` +
                 `- [View details](${url})`;
          break;
        case 'text':
          text = `IP: ${currentData.ip}\n` +
                 `Country: ${currentData.country_name || '—'}\n` +
                 `City: ${currentData.city || '—'}\n` +
                 `Organization: ${currentData.org || '—'}\n` +
                 `ASN: ${currentData.asn || '—'}\n` +
                 `View: ${url}`;
          break;
      }
      copyToClipboard(text, true);
      feedback.textContent = 'Copied!';
      setTimeout(() => { feedback.textContent = ''; }, 2500);
    });
  });

  elements.rawToggle.addEventListener('click', () => {
    const nowHidden = elements.rawPanel.classList.toggle('hidden');
    const icon = elements.rawToggle.querySelector('.fa-chevron-down');
    if (icon) icon.style.transform = nowHidden ? 'rotate(0deg)' : 'rotate(180deg)';
  });

  $('export-csv-btn').addEventListener('click', () => {
    if (currentData) exportCSV(currentData);
    else showToast('No data to export.', true);
  });
  $('export-pdf-btn').addEventListener('click', () => window.print());

  $('map-zoom-fit').addEventListener('click', focusMap);
  $('map-layer-toggle').addEventListener('click', () => {
    mapSatellite = !mapSatellite;
    $('map-layer-toggle').innerHTML = mapSatellite
      ? '<i class="fas fa-layer-group"></i> Street'
      : '<i class="fas fa-layer-group"></i> Satellite';
    if (currentData) {
      const lat = Number(currentData.latitude);
      const lng = Number(currentData.longitude);
      if (!isNaN(lat) && !isNaN(lng)) initMap(lat, lng, currentData.city, currentData.country_name);
    }
  });

  $('whois-modal-close').addEventListener('click', () => {
    $('whois-modal').classList.remove('open');
  });
  $('whois-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) $('whois-modal').classList.remove('open');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && $('whois-modal').classList.contains('open')) {
      $('whois-modal').classList.remove('open');
    }
  });

  $('clear-history-btn').addEventListener('click', () => {
    if (getHistory().length === 0) return;
    if (confirm('Clear all search history?')) {
      clearHistory();
      showToast('History cleared.');
    }
  });

  $('bulk-lookup-btn').addEventListener('click', () => {
    const lines = $('bulk-input').value.split('\n');
    bulkLookup(lines);
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

  const _originalLookup = lookupFlexible;
  lookupFlexible = async function (rawInput) {
    const v = (rawInput || '').trim();

    if (v === '') {
      elements.loading.classList.remove('hidden');
      elements.error.classList.add('hidden');
      elements.results.classList.add('hidden');
      elements.empty.classList.add('hidden');
      if (mapInstance) { mapInstance.remove(); mapInstance = null; }
      $('reputation-loading').classList.remove('hidden');
      $('reputation-data').classList.add('hidden');
      $('reputation-error').classList.add('hidden');
      try {
        const data = await fetchGeo('');
        renderResults(data);
        showToast('Showing your public IP.');
      } catch (err) {
        elements.loading.classList.add('hidden');
        elements.error.classList.remove('hidden');
        elements.errorMsg.textContent = err.message || 'Failed to fetch your IP.';
      }
      return;
    }

    return _originalLookup(v);
  };

  function init() {
    renderHistory();

    const params = new URLSearchParams(location.search);
    const ipParam = params.get('ip');
    if (ipParam) {
      elements.input.value = ipParam;
      setMode('single');
      setTimeout(() => lookupFlexible(ipParam), 300);
    } else {
      setTimeout(() => lookupFlexible(''), 300);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();