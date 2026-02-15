function copyToClipboard(text, buttonElement) {
    const copyAction = () => {
        return navigator.clipboard.writeText(text).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        });
    };

    const originalContent = buttonElement.innerHTML;

    const showCopiedFeedback = () => {
        buttonElement.innerHTML = '<i class="fas fa-check"></i> Tersalin!';
        buttonElement.classList.add('copy-success');
    };

    const revertButton = () => {
        buttonElement.innerHTML = originalContent;
        buttonElement.classList.remove('copy-success');
    };

    copyAction()
        .then(() => {
            showCopiedFeedback();
            setTimeout(revertButton, 1500);
        })
        .catch((err) => {
            console.error('Gagal menyalin:', err);
            buttonElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Gagal';
            setTimeout(revertButton, 1500);
        });
}

function openRandomJitsiRoom() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let roomName = '';
    for (let i = 0; i < 10; i++) {
        roomName += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const jitsiDomain = 'https://talk.ricalnet.my.id';
    window.open(`${jitsiDomain}/${roomName}`, '_blank');
}

document.addEventListener('DOMContentLoaded', () => {
    const copyButtons = document.querySelectorAll('.copy-btn');
    copyButtons.forEach(btn => {
        btn.addEventListener('click', (event) => {
            event.preventDefault();
            // const textToCopy = btn.getAttribute('data-copy-text');
            // if (textToCopy) copyToClipboard(textToCopy, btn);
        });
    });
});