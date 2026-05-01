document.addEventListener('DOMContentLoaded', () => {

    // --- Mobile Menu ---
    const navToggle = document.getElementById('navToggle');
    const nav = document.querySelector('.nav');
    
    if (navToggle && nav) {
        navToggle.addEventListener('click', () => {
            nav.classList.toggle('active');
        });

        // Cierra el menú al hacer clic en un enlace
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('active');
            });
        });
    }

    // --- Header Scroll Effect ---
    const header = document.querySelector('.site-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // --- GSAP Animations ---
    if (typeof gsap !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);

        // 1. Hero Entrance Animation
        const tlHero = gsap.timeline();
        
        // Fondo agresivo optimizado: sin filtros gráficos pesados, opacidad alta -> opacidad baja
        tlHero.fromTo('.hero-bg', 
            { scale: 1.1, opacity: 0.8 }, 
            { scale: 1, opacity: 0.3, duration: 0.8, ease: "expo.out" }
        )
        // Texto Llamativo & Callejero: entra disparado desde ángulos locos con rebote elástico pesado
        .fromTo('.reveal-inner', 
            { y: "150%", x: () => (Math.random() - 0.5) * 100, scale: 2, rotationZ: () => (Math.random() - 0.5) * 30, opacity: 0 }, 
            { y: "0%", x: 0, scale: 1, rotationZ: 0, opacity: 1, stagger: 0.15, duration: 2, ease: "elastic.out(1, 0.4)" }, 
            "-=0.6"
        )
        // Botón explota
        .fromTo('.reveal-fade', 
            { opacity: 0, scale: 0.5, y: 50 },
            { opacity: 1, scale: 1, y: 0, duration: 1.5, ease: "elastic.out(1, 0.4)" }, 
            "-=1.5"
        );


        // 2. Global Scrolling Reveals
        const revealElements = document.querySelectorAll('.gs-reveal');
        
        revealElements.forEach(el => {
            // Checar si tiene clase de delay
            let delayAmt = 0;
            if (el.classList.contains('delay-1')) delayAmt = 0.2;
            if (el.classList.contains('delay-2')) delayAmt = 0.4;
            if (el.classList.contains('delay-3')) delayAmt = 0.6;

            gsap.to(el, {
                y: 0,
                opacity: 1,
                duration: 1,
                delay: delayAmt,
                ease: "power3.out",
                scrollTrigger: {
                    trigger: el,
                    start: "top 85%", // trigger when top of element hits 85% down the viewport
                    toggleActions: "play none none reverse"
                }
            });
        });
    }
});
