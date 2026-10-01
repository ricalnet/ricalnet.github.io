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
  disable: window.innerWidth < 768 ? true : false,
});

const PGP_FINGERPRINT = '45688382B815821F033115B8D92D6A10D29C8380';

function copyPGP() {
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
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-full text-sm shadow-2xl border border-tor-violet/30 z-[9999] transition-all duration-300';
  toast.innerHTML = '<i class="fas fa-check-circle text-tor-accent mr-2"></i> ' + message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

const state = {
  files: [],
  converted: [],
  format: 'image/webp',
  ext: 'webp',
  quality: 0.92,
};

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const convertBtn = document.getElementById('convert-btn');
const fileCountLabel = document.getElementById('file-count-label');
const clearFilesBtn = document.getElementById('clear-files-btn');
const qualitySlider = document.getElementById('quality-slider');
const qualityValue = document.getElementById('quality-value');
const progressSection = document.getElementById('progress-section');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const resultsSection = document.getElementById('results-section');
const resultsGrid = document.getElementById('results-grid');
const resultCount = document.getElementById('result-count');
const resultCountPlural = document.getElementById('result-count-plural');
const downloadAllBtn = document.getElementById('download-all-btn');

const formatSelect = document.getElementById('format-select');
const formatTrigger = formatSelect.querySelector('.custom-select-trigger');
const formatOptions = formatSelect.querySelectorAll('.custom-select-option');
const selectedFormatBadge = document.getElementById('selected-format-badge');
const selectedFormatDesc = document.getElementById('selected-format-desc');

function closeDropdown() {
  formatSelect.classList.remove('open');
  formatTrigger.setAttribute('aria-expanded', 'false');
}

formatTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = formatSelect.classList.contains('open');
  if (isOpen) {
    closeDropdown();
  } else {
    formatSelect.classList.add('open');
    formatTrigger.setAttribute('aria-expanded', 'true');
  }
});

formatTrigger.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    formatTrigger.click();
  }
  if (e.key === 'Escape') closeDropdown();
});

formatOptions.forEach(opt => {
  opt.addEventListener('click', (e) => {
    e.stopPropagation();
    formatOptions.forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    state.format = opt.dataset.format;
    state.ext = opt.dataset.ext;
    selectedFormatBadge.textContent = opt.dataset.label;
    selectedFormatDesc.textContent = opt.dataset.desc;
    closeDropdown();
  });
});

document.addEventListener('click', (e) => {
  if (!formatSelect.contains(e.target)) closeDropdown();
});

qualitySlider.addEventListener('input', () => {
  state.quality = parseInt(qualitySlider.value, 10) / 100;
  qualityValue.textContent = qualitySlider.value + '%';
});

function addFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  if (files.length === 0) return;
  state.files = state.files.concat(files);
  updateFileCount();
  convertBtn.disabled = state.files.length === 0;
}

function updateFileCount() {
  const n = state.files.length;
  fileCountLabel.textContent = n === 0 ? 'No files selected' : `${n} file${n > 1 ? 's' : ''} selected`;
  clearFilesBtn.classList.toggle('hidden', n === 0);
}

fileInput.addEventListener('change', () => {
  addFiles(fileInput.files);
  fileInput.value = '';
});

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  addFiles(e.dataTransfer.files);
});

clearFilesBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  state.files = [];
  updateFileCount();
  convertBtn.disabled = true;
  resultsSection.classList.add('hidden');
  resultsGrid.innerHTML = '';
});

convertBtn.addEventListener('click', () => {
  if (state.files.length === 0) return;
  state.converted = [];
  resultsGrid.innerHTML = '';
  resultsSection.classList.add('hidden');
  progressSection.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = '0%';

  const total = state.files.length;
  let done = 0;

  const quality = state.format === 'image/jpeg' || state.format === 'image/webp' ? state.quality : undefined;

  state.files.forEach((file) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) {
          done++;
          updateProgress(done, total);
          return;
        }

        const baseName = file.name.replace(/\.[^.]+$/, '');
        const outName = `${baseName}.${state.ext}`;
        const outUrl = URL.createObjectURL(blob);

        state.converted.push({
          name: outName,
          blob,
          url: outUrl,
          size: blob.size,
          originalSize: file.size,
          format: state.ext,
        });

        done++;
        updateProgress(done, total);
      }, state.format, quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      done++;
      updateProgress(done, total);
    };

    img.src = url;
  });
});

function updateProgress(done, total) {
  const pct = Math.round((done / total) * 100);
  progressFill.style.width = pct + '%';
  progressText.textContent = pct + '%';
  if (done === total) {
    progressSection.classList.add('hidden');
    renderResults();
  }
}

function renderResults() {
  if (state.converted.length === 0) return;
  resultsSection.classList.remove('hidden');
  resultCount.textContent = state.converted.length;
  resultCountPlural.textContent = state.converted.length > 1 ? 's' : '';

  state.converted.forEach((item) => {
    const reduction = item.originalSize > 0
      ? Math.round((1 - item.size / item.originalSize) * 100)
      : 0;

    const card = document.createElement('div');
    card.className = 'preview-card rounded-2xl p-4 bg-white/70 backdrop-blur-sm';
    card.innerHTML = `
      <div class="card-glow"></div>
      <div class="flex items-start gap-3 relative z-10">
        <div class="w-16 h-16 rounded-xl bg-tor-violet/5 border border-surface-border/60 flex-shrink-0 overflow-hidden flex items-center justify-center">
          <img src="${item.url}" alt="${item.name}" class="w-full h-full object-cover" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-text-primary truncate" title="${item.name}">${item.name}</p>
          <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
            <span class="badge-format success">${item.format.toUpperCase()}</span>
            <span class="text-[0.6rem] text-text-muted">${(item.size / 1024).toFixed(1)} KB</span>
            ${reduction > 0
              ? `<span class="text-[0.6rem] text-tor-accent font-semibold">−${reduction}%</span>`
              : `<span class="text-[0.6rem] text-text-muted">+${Math.abs(reduction)}%</span>`}
          </div>
          <div class="flex flex-wrap items-center gap-2 mt-3">
            <a href="${item.url}" download="${item.name}"
               class="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-tor-violet hover:bg-tor-violet-dark px-3.5 py-1.5 rounded-full shadow-sm transition-all duration-200 hover:-translate-y-0.5">
              <i class="fas fa-download text-[0.6rem]"></i> Download
            </a>
            <button onclick="copyToClipboard('${item.url}')"
               class="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-tor-violet transition-colors bg-surface-muted px-3 py-1.5 rounded-full border border-surface-border/40">
              <i class="fas fa-copy text-[0.6rem]"></i> Link
            </button>
          </div>
        </div>
      </div>
    `;
    resultsGrid.appendChild(card);
  });
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('Link copied!');
  }).catch(() => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showToast('Link copied!');
  });
}

downloadAllBtn.addEventListener('click', () => {
  if (state.converted.length === 0) return;
  state.converted.forEach((item, i) => {
    setTimeout(() => {
      const a = document.createElement('a');
      a.href = item.url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, i * 300);
  });
  showToast(`Downloading ${state.converted.length} file${state.converted.length > 1 ? 's' : ''}…`);
});