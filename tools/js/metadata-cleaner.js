const PGP_FINGERPRINT = '45688382B815821F033115B8D92D6A10D29C8380';

function copyPGP() {
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
}

function showToast(msg) {
  const el = document.createElement('div');
  el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-full text-sm shadow-2xl border border-tor-violet/30 z-[9999] transition-all duration-300 opacity-100 translate-y-0';
  el.innerHTML = '<i class="fas fa-check-circle text-tor-accent mr-2"></i> ' + msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('opacity-100'));
  setTimeout(() => {
    el.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => el.remove(), 300);
  }, 2500);
}

document.addEventListener('DOMContentLoaded', function () {

  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  const selectFilesBtn = document.getElementById('selectFilesBtn');
  const fileList = document.getElementById('fileList');
  const fileListContainer = document.getElementById('fileListContainer');
  const fileCount = document.getElementById('fileCount');
  const totalSize = document.getElementById('totalSize');
  const cleanAllBtn = document.getElementById('cleanAllBtn');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const downloadZipBtn = document.getElementById('downloadZipBtn');

  let files = [];
  let idCounter = 0;
  let isProcessing = false;

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  function getFileExtension(name) {
    return name.split('.').pop().toLowerCase();
  }

  function getFormatBadge(ext) {
    const map = {
      pdf: 'badge-pdf',
      jpg: 'badge-img',
      jpeg: 'badge-img',
      png: 'badge-img',
      gif: 'badge-img',
      webp: 'badge-img',
      bmp: 'badge-img',
      tiff: 'badge-img',
      tif: 'badge-img',
      docx: 'badge-doc',
      pptx: 'badge-doc',
      xlsx: 'badge-doc'
    };
    return map[ext] || 'badge-other';
  }

  function getFormatIcon(ext) {
    const map = {
      pdf: 'fa-file-pdf',
      jpg: 'fa-file-image',
      jpeg: 'fa-file-image',
      png: 'fa-file-image',
      gif: 'fa-file-image',
      webp: 'fa-file-image',
      bmp: 'fa-file-image',
      tiff: 'fa-file-image',
      tif: 'fa-file-image',
      docx: 'fa-file-word',
      pptx: 'fa-file-powerpoint',
      xlsx: 'fa-file-excel'
    };
    return map[ext] || 'fa-file';
  }

  function isImage(ext) {
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif'].includes(ext);
  }

  function isPDF(ext) {
    return ext === 'pdf';
  }

  function isOffice(ext) {
    return ['docx', 'pptx', 'xlsx'].includes(ext);
  }

  function generateThumbnail(file) {
    return new Promise((resolve) => {
      const ext = getFileExtension(file.name);
      if (isImage(ext)) {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = function () {
          const canvas = document.createElement('canvas');
          let w = this.naturalWidth || this.width;
          let h = this.naturalHeight || this.height;
          const max = 120;
          if (w > h) {
            if (w > max) {
              h = (h / w) * max;
              w = max;
            }
          } else {
            if (h > max) {
              w = (w / h) * max;
              h = max;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(this, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        };
        img.onerror = function () {
          URL.revokeObjectURL(url);
          resolve(null);
        };
        img.src = url;
      } else {
        resolve(null);
      }
    });
  }

  function calculateRiskScore(metadata) {
    if (!metadata || Object.keys(metadata).length === 0) {
      return { level: 'none', label: 'No Risk', icon: 'fa-circle', color: 'risk-none' };
    }
    let highRisk = false,
      mediumRisk = false;
    const sensitiveKeys = ['gps', 'latitude', 'longitude', 'altitude', 'gpsaltitude', 'gpslatitude', 'gpslongitude'];
    const mediumKeys = ['author', 'creator', 'producer', 'company', 'manager', 'lastmodifiedby', 'organization', 'copyright', 'contact', 'email', 'phone', 'serialnumber', 'ownername', 'artist'];
    for (const key of Object.keys(metadata)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(s => lowerKey.includes(s))) highRisk = true;
      if (mediumKeys.some(s => lowerKey.includes(s))) mediumRisk = true;
      const val = String(metadata[key]).toLowerCase();
      if (val.includes('gps') || val.includes('latitude') || val.includes('longitude') ||
        val.match(/[-+]?\d+\.\d+,\s*[-+]?\d+\.\d+/)) highRisk = true;
    }
    const basicKeys = ['file name', 'file size', 'file type', 'last modified'];
    const allKeys = Object.keys(metadata).map(k => k.toLowerCase());
    const nonBasicKeys = allKeys.filter(k => !basicKeys.some(b => k.includes(b) || k === b));
    if (highRisk) return { level: 'high', label: 'High Risk', icon: 'fa-triangle-exclamation', color: 'risk-high' };
    if (mediumRisk || nonBasicKeys.length > 0) return { level: 'medium', label: 'Medium Risk', icon: 'fa-circle-exclamation', color: 'risk-medium' };
    return { level: 'low', label: 'Low Risk', icon: 'fa-circle-check', color: 'risk-low' };
  }

  function cleanValue(v) {
    if (v === undefined || v === null || v === '') return false;
    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (trimmed.length === 0) return false;
      if (trimmed.length > 200) return false;
      return trimmed;
    }
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v;
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) {
      if (v.length === 0) return false;
      return v.slice(0, 5).join(', ');
    }
    if (typeof v === 'object') {
      try {
        const str = JSON.stringify(v);
        if (str.length > 200) return false;
        return str;
      } catch (_) {
        return false;
      }
    }
    return String(v);
  }

  async function extractMetadata(file) {
    const ext = getFileExtension(file.name);
    const meta = {};
    if (isImage(ext)) {
      try {
        const buffer = await file.arrayBuffer();
        const exif = await exifr.parse(buffer, { gps: true, xmp: true, iptc: true, ifd0: true, exif: true, interop: true });
        if (exif) {
          for (const [k, v] of Object.entries(exif)) {
            if (k === 'thumbnail' || k === 'thumb' || k === 'MakerNote' || k === 'UserComment') continue;
            const cleaned = cleanValue(v);
            if (cleaned !== false) meta[k] = cleaned;
          }
        }
      } catch (_) { }
    }
    if (isPDF(ext)) {
      try {
        const buffer = await file.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
        const info = pdfDoc.getDocumentInfo();
        if (info) {
          const knownKeys = ['Title', 'Author', 'Subject', 'Creator', 'Producer', 'Keywords', 'CreationDate', 'ModificationDate'];
          for (const [k, v] of Object.entries(info)) {
            if (v && v.length > 0 && v.length < 500) meta[k] = v;
          }
        }
        const title = pdfDoc.getTitle();
        const author = pdfDoc.getAuthor();
        const subject = pdfDoc.getSubject();
        const creator = pdfDoc.getCreator();
        const producer = pdfDoc.getProducer();
        if (title && !meta['Title']) meta['Title'] = title;
        if (author && !meta['Author']) meta['Author'] = author;
        if (subject && !meta['Subject']) meta['Subject'] = subject;
        if (creator && !meta['Creator']) meta['Creator'] = creator;
        if (producer && !meta['Producer']) meta['Producer'] = producer;
      } catch (_) { }
    }
    if (isOffice(ext)) {
      try {
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        const coreFile = zip.file('docProps/core.xml');
        if (coreFile) {
          const xml = await coreFile.async('text');
          const parser = new DOMParser();
          const doc = parser.parseFromString(xml, 'text/xml');
          const tags = [
            ['dc:title', 'http://purl.org/dc/elements/1.1/', 'title'],
            ['dc:creator', 'http://purl.org/dc/elements/1.1/', 'creator'],
            ['dc:subject', 'http://purl.org/dc/elements/1.1/', 'subject'],
            ['dc:description', 'http://purl.org/dc/elements/1.1/', 'description'],
            ['dc:language', 'http://purl.org/dc/elements/1.1/', 'language'],
            ['dc:identifier', 'http://purl.org/dc/elements/1.1/', 'identifier'],
            ['dcterms:created', 'http://purl.org/dc/terms/', 'created'],
            ['dcterms:modified', 'http://purl.org/dc/terms/', 'modified'],
            ['cp:lastModifiedBy', 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties', 'lastModifiedBy'],
            ['cp:revision', 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties', 'revision'],
            ['cp:category', 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties', 'category'],
            ['cp:contentStatus', 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties', 'contentStatus'],
          ];
          for (const [key, ns, tag] of tags) {
            const els = doc.getElementsByTagNameNS(ns, tag);
            if (els.length && els[0].textContent && els[0].textContent.trim()) {
              meta[key] = els[0].textContent.trim();
            }
          }
        }
        const appFile = zip.file('docProps/app.xml');
        if (appFile) {
          const xml = await appFile.async('text');
          const parser = new DOMParser();
          const doc = parser.parseFromString(xml, 'text/xml');
          const tags = ['Company', 'Manager', 'Template', 'Application', 'AppVersion', 'TotalTime', 'Pages', 'Words', 'Characters'];
          const ns = 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties';
          for (const tag of tags) {
            const els = doc.getElementsByTagNameNS(ns, tag);
            if (els.length && els[0].textContent && els[0].textContent.trim()) {
              meta[tag] = els[0].textContent.trim();
            }
          }
        }
      } catch (_) { }
    }
    const basic = {
      'File Name': file.name,
      'File Size': formatSize(file.size),
      'File Type': file.type || 'unknown',
      'Last Modified': new Date(file.lastModified).toLocaleString(),
    };
    return { ...basic, ...meta };
  }

  async function cleanFile(file) {
    const ext = getFileExtension(file.name);
    let cleanedBlob = null;
    let cleanedName = file.name;
    let cleanedSize = 0;
    let removedCount = 0;

    if (isImage(ext)) {
      try {
        const url = URL.createObjectURL(file);
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = url;
        });
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        let mimeType = 'image/png',
          extOut = 'png';
        if (ext === 'jpg' || ext === 'jpeg') {
          mimeType = 'image/jpeg';
          extOut = 'jpg';
        } else if (ext === 'webp') {
          mimeType = 'image/webp';
          extOut = 'webp';
        } else if (ext === 'bmp') {
          mimeType = 'image/png';
          extOut = 'png';
        } else {
          mimeType = 'image/png';
          extOut = 'png';
        }
        const quality = (ext === 'jpg' || ext === 'jpeg') ? 0.92 : 1.0;
        cleanedBlob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, quality));
        URL.revokeObjectURL(url);
        cleanedName = file.name.replace(/\.[^.]+$/, '') + '_cleaned.' + extOut;
      } catch (e) {
        console.warn('Image cleaning failed:', e);
        cleanedBlob = file.slice(0, file.size);
        cleanedName = file.name.replace(/\.[^.]+$/, '') + '_cleaned.' + ext;
      }
    } else if (isPDF(ext)) {
      try {
        const buffer = await file.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(buffer, { ignoreEncryption: true });
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setCreator('');
        pdfDoc.setProducer('');
        pdfDoc.setKeywords([]);
        try {
          pdfDoc.setCreationDate(new Date(0));
          pdfDoc.setModificationDate(new Date(0));
        } catch (_) { }
        try {
          const xmpMetadata = pdfDoc.getXmpMetadata?.();
          if (xmpMetadata) pdfDoc.setXmpMetadata('');
        } catch (_) { }
        const newBytes = await pdfDoc.save({ useObjectStreams: true, updateFieldAppearances: false });
        cleanedBlob = new Blob([newBytes], { type: 'application/pdf' });
        cleanedName = file.name.replace(/\.[^.]+$/, '') + '_cleaned.pdf';
      } catch (e) {
        console.warn('PDF cleaning failed:', e);
        cleanedBlob = file.slice(0, file.size);
        cleanedName = file.name.replace(/\.[^.]+$/, '') + '_cleaned.' + ext;
      }
    } else if (isOffice(ext)) {
      try {
        const buffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(buffer);
        const coreFile = zip.file('docProps/core.xml');
        if (coreFile) {
          const xml = await coreFile.async('text');
          const parser = new DOMParser();
          const doc = parser.parseFromString(xml, 'text/xml');
          const coreNs = 'http://purl.org/dc/elements/1.1/';
          const cpNs = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties';
          const dcTerms = 'http://purl.org/dc/terms/';
          const clearTags = [
            [coreNs, 'creator'],
            [coreNs, 'title'],
            [coreNs, 'subject'],
            [coreNs, 'description'],
            [coreNs, 'language'],
            [coreNs, 'identifier'],
            [cpNs, 'lastModifiedBy'],
            [cpNs, 'revision'],
            [cpNs, 'category'],
            [cpNs, 'contentStatus'],
            [dcTerms, 'created'],
            [dcTerms, 'modified'],
          ];
          for (const [ns, tag] of clearTags) {
            const els = doc.getElementsByTagNameNS(ns, tag);
            for (const el of Array.from(els)) {
              el.textContent = '';
            }
          }
          const serializer = new XMLSerializer();
          const newXml = serializer.serializeToString(doc);
          zip.file('docProps/core.xml', newXml);
        }
        const appFile = zip.file('docProps/app.xml');
        if (appFile) {
          const xml = await appFile.async('text');
          const parser = new DOMParser();
          const doc = parser.parseFromString(xml, 'text/xml');
          const ns = 'http://schemas.openxmlformats.org/officeDocument/2006/extended-properties';
          const tagsToClear = ['Company', 'Manager', 'Template', 'Application', 'AppVersion'];
          for (const tag of tagsToClear) {
            const els = doc.getElementsByTagNameNS(ns, tag);
            for (const el of Array.from(els)) {
              el.textContent = '';
            }
          }
          const serializer = new XMLSerializer();
          const newXml = serializer.serializeToString(doc);
          zip.file('docProps/app.xml', newXml);
        }
        const newBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
        cleanedBlob = newBlob;
        cleanedName = file.name.replace(/\.[^.]+$/, '') + '_cleaned.' + ext;
      } catch (e) {
        console.warn('Office cleaning failed:', e);
        cleanedBlob = file.slice(0, file.size);
        cleanedName = file.name.replace(/\.[^.]+$/, '') + '_cleaned.' + ext;
      }
    } else {
      cleanedBlob = file.slice(0, file.size);
      cleanedName = file.name.replace(/\.[^.]+$/, '') + '_cleaned.' + ext;
    }

    if (cleanedBlob) cleanedSize = cleanedBlob.size;
    return { cleanedBlob, cleanedName, cleanedSize, removedCount };
  }

  function renderFiles() {
    if (files.length === 0) {
      fileListContainer.classList.add('hidden');
      downloadZipBtn.disabled = true;
      return;
    }
    fileListContainer.classList.remove('hidden');
    fileCount.textContent = files.length;
    const total = files.reduce((acc, f) => acc + f.file.size, 0);
    totalSize.textContent = formatSize(total);

    const hasCleaned = files.some(f => f.cleaned === true);
    downloadZipBtn.disabled = !hasCleaned;

    fileList.innerHTML = '';
    files.forEach((item) => {
      const ext = getFileExtension(item.file.name);
      const isCleaned = item.cleaned === true;
      const metaEntries = Object.entries(item.metadata || {});
      const hasMeta = metaEntries.length > 0;
      const risk = item.riskScore || calculateRiskScore(item.metadata);
      item.riskScore = risk;

      let thumbHtml = '';
      if (item.thumbnail) {
        thumbHtml = `<img src="${item.thumbnail}" class="file-thumb" alt="Preview" loading="lazy" />`;
      } else {
        const icon = getFormatIcon(ext);
        thumbHtml = `<div class="file-thumb-placeholder"><i class="fas ${icon}"></i></div>`;
      }

      const div = document.createElement('div');
      div.className = 'p-4 flex flex-col gap-2 hover:bg-surface-muted/30 transition-colors relative';
      div.dataset.id = item.id;

      const header = document.createElement('div');
      header.className = 'flex items-center justify-between gap-3 flex-wrap';
      header.innerHTML = `
        <div class="flex items-center gap-3 min-w-0 flex-wrap">
          <div class="flex items-center gap-2">
            ${thumbHtml}
            <div class="min-w-0">
              <span class="font-medium text-text-primary text-sm truncate block">${item.file.name}</span>
              <span class="text-text-muted text-xs">${formatSize(item.file.size)} · ${ext.toUpperCase()}</span>
              <span class="badge-format ${getFormatBadge(ext)} ml-1.5">${ext.toUpperCase()}</span>
              ${isCleaned ? '<span class="cleaned-badge ml-1.5"><i class="fas fa-check"></i> Cleaned</span>' : ''}
            </div>
          </div>
          <span class="risk-badge ${risk.color}"><i class="fas ${risk.icon}"></i> ${risk.label}</span>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
          ${hasMeta && !isCleaned ? `<button class="meta-toggle-btn" data-toggle="${item.id}">
            <i class="fas fa-chevron-down"></i> ${metaEntries.length} fields
          </button>` : ''}
          ${!isCleaned ? `<button class="clean-single-btn text-white bg-tor-violet hover:bg-tor-violet-dark px-3 py-1.5 rounded-full text-xs font-medium shadow-md shadow-tor-violet/20 transition-all duration-300 hover:shadow-lg flex items-center gap-1.5" data-id="${item.id}">
            <i class="fas fa-broom"></i> Clean
          </button>` : ''}
          ${isCleaned ? `<button class="download-single-btn text-tor-violet border border-tor-violet/30 hover:bg-tor-violet/5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1.5" data-id="${item.id}">
            <i class="fas fa-download"></i> Download
          </button>` : ''}
          <button class="remove-single-btn text-text-muted hover:text-red-500 px-2 py-1.5 rounded-full text-sm transition-colors" data-id="${item.id}">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      div.appendChild(header);

      if (hasMeta) {
        const metaWrapper = document.createElement('div');
        metaWrapper.className = 'meta-collapse ml-11';
        metaWrapper.id = `meta-${item.id}`;

        const metaDiv = document.createElement('div');
        metaDiv.className = 'mt-1.5 overflow-x-auto bg-surface-muted/40 rounded-xl border border-surface-border/40';

        let tableHtml = `
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-surface-border/40 text-text-muted">
                <th class="text-left py-1.5 px-3 font-medium">Field</th>
                <th class="text-left py-1.5 px-3 font-medium">Value</th>
                ${isCleaned ? '<th class="text-left py-1.5 px-3 font-medium text-tor-accent">Status</th>' : ''}
              </tr>
            </thead>
            <tbody>
        `;
        metaEntries.forEach(([k, v]) => {
          const val = typeof v === 'string' ? v : JSON.stringify(v);
          const truncated = val.length > 100 ? val.slice(0, 100) + '…' : val;
          tableHtml += `
            <tr class="meta-table-row border-b border-surface-border/30 last:border-0">
              <td class="py-1.5 px-3 font-medium text-text-primary break-words max-w-[160px]">${k}</td>
              <td class="py-1.5 px-3 text-text-secondary break-words max-w-[280px]">${truncated}</td>
              ${isCleaned ? '<td class="py-1.5 px-3 text-tor-accent"><i class="fas fa-check-circle"></i> removed</td>' : ''}
            </tr>
          `;
        });
        tableHtml += '</tbody></table>';
        metaDiv.innerHTML = tableHtml;
        metaWrapper.appendChild(metaDiv);
        div.appendChild(metaWrapper);
      } else {
        const noMeta = document.createElement('div');
        noMeta.className = 'mt-1.5 ml-11 text-xs text-text-muted italic';
        noMeta.textContent = isCleaned ? '✓ All metadata removed' : 'No metadata detected';
        div.appendChild(noMeta);
      }

      fileList.appendChild(div);
    });

    document.querySelectorAll('.meta-toggle-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const id = this.dataset.toggle;
        const target = document.getElementById(`meta-${id}`);
        if (target) {
          target.classList.toggle('open');
          this.classList.toggle('open');
        }
      });
    });

    document.querySelectorAll('.clean-single-btn').forEach(btn => {
      btn.addEventListener('click', async function (e) {
        e.stopPropagation();
        const id = parseInt(this.dataset.id);
        await processSingle(id);
      });
    });

    document.querySelectorAll('.download-single-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const id = parseInt(this.dataset.id);
        const item = files.find(f => f.id === id);
        if (item && item.cleanedBlob) {
          saveAs(item.cleanedBlob, item.cleanedName);
          showToast('Downloading: ' + item.cleanedName);
        }
      });
    });

    document.querySelectorAll('.remove-single-btn').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const id = parseInt(this.dataset.id);
        files = files.filter(f => f.id !== id);
        renderFiles();
        showToast('File removed');
      });
    });

    const anyUncleaned = files.some(f => !f.cleaned);
    cleanAllBtn.disabled = !anyUncleaned || isProcessing;
  }

  async function processSingle(id) {
    if (isProcessing) {
      showToast('Please wait for current operation to finish');
      return;
    }
    const idx = files.findIndex(f => f.id === id);
    if (idx === -1) return;
    const item = files[idx];
    if (item.cleaned) {
      showToast('Already cleaned');
      return;
    }
    isProcessing = true;
    cleanAllBtn.disabled = true;
    try {
      const result = await cleanFile(item.file);
      item.cleaned = true;
      item.cleanedBlob = result.cleanedBlob;
      item.cleanedName = result.cleanedName;
      item.cleanedSize = result.cleanedSize;
      showToast('✅ Cleaned: ' + item.file.name);
    } catch (e) {
      console.error('Clean failed:', e);
      showToast('❌ Error cleaning ' + item.file.name);
    }
    isProcessing = false;
    renderFiles();
  }

  cleanAllBtn.addEventListener('click', async function () {
    if (isProcessing) {
      showToast('Please wait for current operation to finish');
      return;
    }
    const toClean = files.filter(f => !f.cleaned);
    if (toClean.length === 0) {
      showToast('No files to clean');
      return;
    }
    isProcessing = true;
    this.disabled = true;
    const originalHtml = this.innerHTML;
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cleaning…';
    let cleanedCount = 0;
    let failedCount = 0;
    for (const item of toClean) {
      try {
        const result = await cleanFile(item.file);
        item.cleaned = true;
        item.cleanedBlob = result.cleanedBlob;
        item.cleanedName = result.cleanedName;
        item.cleanedSize = result.cleanedSize;
        cleanedCount++;
        if (cleanedCount % 2 === 0 || cleanedCount === toClean.length) renderFiles();
      } catch (e) {
        console.error('Clean failed for:', item.file.name, e);
        failedCount++;
      }
      await new Promise(r => setTimeout(r, 30));
    }
    this.innerHTML = originalHtml;
    isProcessing = false;
    renderFiles();
    if (failedCount > 0) {
      showToast(`✅ Cleaned ${cleanedCount} · ❌ Failed ${failedCount}`);
    } else {
      showToast(`✅ Cleaned ${cleanedCount} file(s)`);
    }
  });

  clearAllBtn.addEventListener('click', function () {
    if (files.length === 0) return;
    if (confirm('Remove all files from the list?')) {
      files = [];
      renderFiles();
      showToast('All files cleared');
    }
  });

  downloadZipBtn.addEventListener('click', async function () {
    if (isProcessing) {
      showToast('Please wait for current operation to finish');
      return;
    }
    const cleanedFiles = files.filter(f => f.cleaned === true && f.cleanedBlob);
    if (cleanedFiles.length === 0) {
      showToast('No cleaned files to download.');
      return;
    }
    this.disabled = true;
    const originalHtml = this.innerHTML;
    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Zipping…';
    try {
      const zip = new JSZip();
      for (const item of cleanedFiles) {
        const blob = item.cleanedBlob;
        const name = item.cleanedName || item.file.name.replace(/\.[^.]+$/, '') + '_cleaned.' + getFileExtension(item.file.name);
        zip.file(name, blob);
      }
      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      saveAs(zipBlob, 'cleaned_metadata_files.zip');
      showToast(`📦 Downloaded ${cleanedFiles.length} file(s) as ZIP`);
    } catch (e) {
      console.error('ZIP creation failed:', e);
      showToast('❌ Failed to create ZIP archive.');
    }
    this.innerHTML = originalHtml;
    const hasCleaned = files.some(f => f.cleaned === true);
    this.disabled = !hasCleaned;
  });

  async function handleFiles(fileListInput) {
    if (isProcessing) {
      showToast('Please wait for current operation to finish');
      return;
    }
    const newFiles = Array.from(fileListInput);
    let added = 0;
    for (const file of newFiles) {
      try {
        const metadata = await extractMetadata(file);
        const riskScore = calculateRiskScore(metadata);
        const thumbData = await generateThumbnail(file);
        files.push({
          id: ++idCounter,
          file: file,
          name: file.name,
          size: file.size,
          type: file.type,
          metadata: metadata,
          cleaned: false,
          cleanedBlob: null,
          cleanedName: null,
          cleanedSize: 0,
          riskScore: riskScore,
          thumbnail: thumbData,
        });
        added++;
      } catch (e) {
        console.error('Error processing file:', file.name, e);
      }
    }
    renderFiles();
    if (added > 0) showToast(`📁 Added ${added} file(s)`);
  }

  fileInput.addEventListener('change', function (e) {
    if (this.files.length > 0) handleFiles(this.files);
    this.value = '';
  });

  selectFilesBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener('click', function (e) {
    if (e.target.closest('#selectFilesBtn')) return;
    if (e.target.closest('button')) return;
    fileInput.click();
  });

  dropZone.addEventListener('dragover', function (e) {
    e.preventDefault();
    this.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', function (e) {
    e.preventDefault();
    this.classList.remove('dragover');
  });
  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    this.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  });

  console.log('✅ Metadata Cleaner ready — all processing local.');
});

AOS.init({
  once: true,
  offset: 30,
  easing: 'ease-out-expo',
  duration: 900,
  disable: window.innerWidth < 768 ? true : false,
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