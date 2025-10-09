document.querySelectorAll('.icon').forEach(icon => {
    icon.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-5px)';
    });
            
    icon.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
    });
});
        
window.addEventListener('scroll', function() {
    const scrolled = window.pageYOffset;
    const background = document.querySelector('.blur-background');
    background.style.transform = `scale(1.1) translateY(${scrolled * 0.3}px)`;
});