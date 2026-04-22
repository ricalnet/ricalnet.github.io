function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    const toast = document.getElementById('copy-toast');
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }).catch(err => {
    alert('Gagal menyalin teks.');
  });
}

document.querySelectorAll('img').forEach(img => {
  img.addEventListener('error', function() {
    if (this.src.includes('img/icons/')) {
      this.src = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%3E%3Crect%20width%3D%2240%22%20height%3D%2240%22%20fill%3D%22%231f2937%22%2F%3E%3Ctext%20x%3D%2220%22%20y%3D%2225%22%20font-size%3D%2212%22%20text-anchor%3D%22middle%22%20fill%3D%22%236b7280%22%20font-family%3D%22Inter%22%3Eicon%3C%2Ftext%3E%3C%2Fsvg%3E';
    }
    if (this.src.includes('img/services/')) {
      this.src = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22320%22%20height%3D%22128%22%20viewBox%3D%220%200%20320%20128%22%3E%3Crect%20width%3D%22320%22%20height%3D%22128%22%20fill%3D%22%23111%22%2F%3E%3Ctext%20x%3D%22160%22%20y%3D%2272%22%20font-size%3D%2216%22%20text-anchor%3D%22middle%22%20fill%3D%22%23888%22%20font-family%3D%22Inter%22%3Eservice%20preview%3C%2Ftext%3E%3C%2Fsvg%3E';
    }
  });
});