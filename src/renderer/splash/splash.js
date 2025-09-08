/**
 * Splash Screen Animation and Logic
 * Handles welcome words animation and transition to main app
 */

let isInitialized = false;
let animationComplete = false;
let audioElement = null;

/**
 * Initialize welcoming words loader with GSAP
 * Synced to audio duration (~7 seconds)
 */
function initWelcomingWordsLoader() {
    const loadingContainer = document.querySelector('[data-loading-container]');
    if (!loadingContainer) return;

    const loadingWords = loadingContainer.querySelector('[data-loading-words]');
    const wordsTarget = loadingWords.querySelector('[data-loading-words-target]');
    const words = loadingWords.getAttribute('data-loading-words')
        .split(',')
        .map(w => w.trim());

    // Create GSAP timeline
    const tl = gsap.timeline({
        onComplete: () => {
            animationComplete = true;
            onAnimationComplete();
        }
    });

    // Initial setup
    tl.set(loadingWords, { yPercent: 50 });

    // Fade in the words container (0.8s)
    tl.to(loadingWords, {
        opacity: 1,
        yPercent: 0,
        duration: 0.8,
        ease: "expo.inOut"
    });

    // Animate through each word (adjusted for 11 words)
    words.forEach((word, i) => {
        let delay;
        if (i === 0) {
            delay = 0.3; // First word appears faster
        } else if (i === words.length - 1) {
            delay = 0.8; // Longer pause before "Welcome to Halo"
        } else {
            delay = 0.48; // Regular timing for other words
        }
        
        tl.call(() => {
            wordsTarget.textContent = word;
        }, null, `+=${delay}`);
    });

    // Hold "Welcome to Halo" for a moment, then fade out
    tl.to(loadingWords, {
        opacity: 0,
        duration: 0.8,
        ease: "power1.inOut",
        onComplete: () => {
            // After text fades out, show logo and button
            showLogoAndButton();
        }
    }, "+=1.5");

    return tl;
}

/**
 * Play startup sound
 */
function playStartupSound() {
    audioElement = document.getElementById('startupSound');
    if (audioElement) {
        // Set volume to a comfortable level
        audioElement.volume = 0.5;
        
        // Get audio duration when loaded
        audioElement.addEventListener('loadedmetadata', () => {
            console.log(`[Splash] Audio duration: ${audioElement.duration}s`);
        });
        
        // Play the sound
        audioElement.play().catch(error => {
            console.log('Could not play startup sound:', error);
            // Continue without sound if autoplay is blocked
        });
        
        // Auto-advance when audio ends
        audioElement.addEventListener('ended', () => {
            if (!animationComplete) {
                animationComplete = true;
                onAnimationComplete();
            }
        });
    }
}


/**
 * Show logo and button after "Welcome to Halo"
 */
function showLogoAndButton() {
    // Animate in the logo
    const logo = document.querySelector('.halo-logo');
    if (logo) {
        logo.classList.add('show');
    }
    
    // Show the button after logo animation
    setTimeout(() => {
        const nextBtn = document.getElementById('nextBtn');
        if (nextBtn) {
            nextBtn.classList.add('show');
        }
    }, 500);
}

/**
 * Called when animation completes
 */
function onAnimationComplete() {
    // Animation complete, button should already be shown via showLogoAndButton
}

/**
 * Handle next button click
 */
function handleNextClick() {
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.5';
    }
    
    // Fade out the entire splash screen
    gsap.to(document.body, {
        opacity: 0,
        duration: 0.5,
        ease: "power2.inOut",
        onComplete: () => {
            // Tell main process to show main window
            window.electronAPI?.goNext();
        }
    });
}

/**
 * Apply theme based on system preference
 */
function applyTheme() {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
}

/**
 * Initialize splash screen when DOM is ready
 */
document.addEventListener('DOMContentLoaded', () => {
    if (isInitialized) return;
    isInitialized = true;
    
    console.log('[Splash] Initializing splash screen...');
    
    // Apply theme
    applyTheme();
    
    // Listen for theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    
    // Play startup sound immediately
    playStartupSound();
    
    // Initialize welcoming words animation
    initWelcomingWordsLoader();
    
    // Try to autoplay video if present
    const video = document.querySelector('.bg-video');
    if (video && video.querySelector('source')) {
        video.play().catch(() => {
            // Video autoplay may be blocked, continue without it
            console.log('[Splash] Video autoplay blocked');
        });
    }
    
    // Setup next button click handler
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.addEventListener('click', handleNextClick);
    }
    
    // Keyboard shortcut to skip (Enter or Space)
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && animationComplete) {
            handleNextClick();
        }
    });
    
    // Optional: Auto-advance after a maximum time (e.g., 10 seconds)
    // setTimeout(() => {
    //     if (!animationComplete) {
    //         animationComplete = true;
    //         onAnimationComplete();
    //     }
    // }, 10000);
});

/**
 * Handle window visibility changes
 */
document.addEventListener('visibilitychange', () => {
    const audio = document.getElementById('startupSound');
    if (document.hidden && audio) {
        audio.pause();
    }
});