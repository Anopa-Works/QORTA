/**
 * QORTA PWA - Service Worker Registration & Install Prompt
 */

// Store the install prompt event
let deferredPrompt = null;

// Register service worker
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/'
            });

            // Check for updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New version available - show update prompt
                        showUpdatePrompt(newWorker);
                    }
                });
            });

        } catch (error) {
            // SW registration failed silently
        }
    }
}

// Handle the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (event) => {
    // Prevent the mini-infobar from appearing
    event.preventDefault();
    // Store the event for later use
    deferredPrompt = event;
    // Show install button after a delay (let user browse first)
    setTimeout(() => {
        showInstallPrompt();
    }, 30000); // 30 seconds
});

// Track successful installs
window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallPrompt();
});

// Show install prompt UI
function showInstallPrompt() {
    if (!deferredPrompt) return;

    // Check if already dismissed this session
    if (sessionStorage.getItem('pwa_prompt_dismissed')) return;

    // Create install banner if it doesn't exist
    let banner = document.getElementById('pwaInstallBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'pwaInstallBanner';
        banner.innerHTML = `
            <div class="pwa-banner-content">
                <div class="pwa-banner-text">
                    <strong>Add to Home Screen</strong>
                    <span>Quick access to your favorite menu</span>
                </div>
                <div class="pwa-banner-actions">
                    <button class="pwa-btn-install" onclick="installPWA()">Install</button>
                    <button class="pwa-btn-dismiss" onclick="dismissInstallPrompt()">Not now</button>
                </div>
            </div>
        `;
        document.body.appendChild(banner);

        // Add styles
        addPWAStyles();
    }

    banner.classList.add('visible');
}

// Hide install prompt
function hideInstallPrompt() {
    const banner = document.getElementById('pwaInstallBanner');
    if (banner) {
        banner.classList.remove('visible');
    }
}

// Dismiss install prompt for this session
function dismissInstallPrompt() {
    sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    hideInstallPrompt();
}

// Trigger the install prompt
async function installPWA() {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;

    // Clear the deferred prompt
    deferredPrompt = null;
    hideInstallPrompt();
}

// Show update available prompt
function showUpdatePrompt(newWorker) {
    // Create update banner
    let banner = document.getElementById('pwaUpdateBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'pwaUpdateBanner';
        banner.innerHTML = `
            <div class="pwa-banner-content">
                <div class="pwa-banner-text">
                    <strong>Update Available</strong>
                    <span>A new version is ready</span>
                </div>
                <div class="pwa-banner-actions">
                    <button class="pwa-btn-install" onclick="applyUpdate()">Update</button>
                    <button class="pwa-btn-dismiss" onclick="dismissUpdate()">Later</button>
                </div>
            </div>
        `;
        document.body.appendChild(banner);
        addPWAStyles();
    }

    // Store reference to new worker
    banner.dataset.worker = 'pending';
    window.pendingWorker = newWorker;

    banner.classList.add('visible');
}

// Apply the pending update
function applyUpdate() {
    if (window.pendingWorker) {
        window.pendingWorker.postMessage('skipWaiting');
    }
    window.location.reload();
}

// Dismiss update prompt
function dismissUpdate() {
    const banner = document.getElementById('pwaUpdateBanner');
    if (banner) {
        banner.classList.remove('visible');
    }
}

// Add PWA banner styles
function addPWAStyles() {
    if (document.getElementById('pwa-styles')) return;

    const style = document.createElement('style');
    style.id = 'pwa-styles';
    style.textContent = `
        #pwaInstallBanner,
        #pwaUpdateBanner {
            position: fixed;
            bottom: 80px;
            left: 16px;
            right: 16px;
            background: #1A1A1A;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 2000;
            transform: translateY(150%);
            opacity: 0;
            transition: transform 0.3s ease, opacity 0.3s ease;
        }

        #pwaInstallBanner.visible,
        #pwaUpdateBanner.visible {
            transform: translateY(0);
            opacity: 1;
        }

        .pwa-banner-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .pwa-banner-text {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .pwa-banner-text strong {
            color: #fff;
            font-size: 14px;
            font-weight: 600;
        }

        .pwa-banner-text span {
            color: rgba(255, 255, 255, 0.6);
            font-size: 12px;
        }

        .pwa-banner-actions {
            display: flex;
            gap: 8px;
            flex-shrink: 0;
        }

        .pwa-btn-install {
            background: #fff;
            color: #1A1A1A;
            border: none;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
        }

        .pwa-btn-dismiss {
            background: transparent;
            color: rgba(255, 255, 255, 0.6);
            border: none;
            padding: 8px 12px;
            font-size: 13px;
            cursor: pointer;
        }

        @media (max-width: 400px) {
            .pwa-banner-content {
                flex-direction: column;
                align-items: stretch;
                text-align: center;
            }

            .pwa-banner-actions {
                justify-content: center;
                margin-top: 8px;
            }
        }
    `;
    document.head.appendChild(style);
}

// Check if running as installed PWA
function isPWAInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true;
}

// Make functions globally available
window.installPWA = installPWA;
window.dismissInstallPrompt = dismissInstallPrompt;
window.applyUpdate = applyUpdate;
window.dismissUpdate = dismissUpdate;

// Initialize on load
document.addEventListener('DOMContentLoaded', registerServiceWorker);
