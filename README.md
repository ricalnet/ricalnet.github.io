## Install

Clone repository:
```bash
git clone https://git.ricalnet.my.id/rical/ricalnet-web.git ~/ricalnet-web
cd ~/ricalnet-web
```

Install Tailwind CSS v3:
```bash
npm install -D tailwindcss@3
```

Build CSS statis:
```bash
npx tailwindcss -i ./assets/css/tailwind-input.css -o ./assets/css/tailwind.css --minify
```

## Panduan Harian

### 1. Mulai sesi development

Masuk ke folder project dan jalankan watcher:

```bash
cd ~/ricalnet-web
chmod +x watch-tailwind.sh
./watch-tailwind.sh
```

Watcher akan otomatis rebuild `assets/css/tailwind.css` setiap kali mengedit file HTML atau JS. Biarkan terminal ini tetap terbuka selama sedang bekerja.

### 2. Edit konten

Buka file HTML yang ingin diubah dengan editor favorit, misalnya:

```bash
code .
# atau
vim index.html
```

Simpan perubahan — Tailwind akan langsung rebuild dalam hitungan detik.

### 3. Cek hasil di browser

Refresh halaman di browser (bisa pakai live server atau buka langsung file HTML):

### 4. Sebelum commit / deploy

Hentikan watcher dengan `Ctrl+C`, lalu jalankan build minify final:

```bash
npm run build:css
```

Pastikan file `assets/css/tailwind.css` sudah ke-update:

```bash
ls -lh assets/css/tailwind.css
git status
```

### 5. Commit & push

```bash
git add .
git commit -m "feat: update halaman X"
git push
```

> [!NOTE]
> `assets/css/tailwind.css` ikut di-commit karena RICALNET adalah static site yang harus tetap offline-capable. Jangan tambahkan ke `.gitignore`.

## Privacy Tools

- [GlobaLeaks](globaleaks/README.md)
- [Image Censor](tools/image-censor.html)
- [IP Intelligence](tools/ip-intelligence.html)
- [Metadata Cleaner](tools/metadata-cleaner.html)
- [Password Generator](tools/password-generator.html)
- [QR Builder](tools/qr-builder.html)
- [Quantum Hasher](tools/quantum-hasher.html)
- [Whiteboard](tools/whiteboard.html)

### External Privacy Tools
- [NipeX](https://git.ricalnet.my.id/rical/nipex)
- [Obfs4 Bridge](https://git.ricalnet.my.id/rical/digital-independence)

## In-House Tools

- [Digital Independence](https://git.ricalnet.my.id/rical/digital-independence)
- [Chantik](https://git.ricalnet.my.id/rical/chantik)