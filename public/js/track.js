/**
 * QORTA Frontend - Order Tracking Logic
 */

let orderId = null;
let eventSource = null;
let orderLoaded = false;
let currentStatus = null; // Track status for notifications

// Initialize page
async function init() {
  // Get order ID from URL
  const params = new URLSearchParams(window.location.search);
  orderId = params.get('order');

  if (!orderId) {
    showError('Order ID not provided');
    return;
  }

  // Try to init audio context (needs user interaction mostly, but we prepare it)
  initAudio();

  await loadOrderTracking();
  setupSSE();
}

// Audio Context for Sound Effects
let audioCtx;
function initAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  } catch (e) {
    console.warn('Web Audio API not supported');
  }
}

function playNotificationSound(type) {
  if (!audioCtx) initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  if (!audioCtx) return;

  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  if (type === 'READY') {
    // Success chime (High-Low-High)
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    oscillator.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.1); // G5
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.5);
  } else {
    // Update ping (Simple)
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.3);
  }
}

// Trigger Haptics
function triggerHaptic() {
  if (navigator.vibrate) {
    navigator.vibrate([200, 100, 200]); // Vibrate pattern
  }
}

// Full Screen Notification
function showNotification(status) {
  const overlay = document.getElementById('notificationOverlay');
  const icon = document.getElementById('notificationIcon');
  const title = document.getElementById('notificationTitle');
  const msg = document.getElementById('notificationMessage');

  // Content based on status
  if (status === 'PREP') {
    overlay.className = 'notification-overlay show preparing';
    icon.textContent = '👨‍🍳';
    title.textContent = 'ORDER UPDATED';
    msg.textContent = 'Your order is now being prepared in the kitchen!';
  } else if (status === 'READY') {
    overlay.className = 'notification-overlay show ready';
    // Icon already SVG in HTML, no emoji needed
    title.textContent = 'ORDER READY';
    msg.textContent = 'Show this screen at the counter to collect your order';
  } else if (status === 'COMPLETE') {
    overlay.className = 'notification-overlay show ready';
    icon.textContent = '✅';
    title.textContent = 'COMPLETED';
    msg.textContent = 'Thank you for dining with us!';
  } else {
    return; // Don't show for other statuses
  }

  // Feedback
  triggerHaptic();
  playNotificationSound(status);
}

function dismissNotification() {
  const overlay = document.getElementById('notificationOverlay');
  overlay.classList.remove('show');
}

// Load order tracking data
async function loadOrderTracking() {
  try {
    const response = await api.getOrder(orderId);
    const order = response.data;
    orderLoaded = true;

    // Initial render
    currentStatus = order.status;
    renderOrderTracking(order);
  } catch (error) {
    console.error('Failed to load order:', error);
    if (!orderLoaded) {
      showError('Unable to load order tracking. Please try again.');
    }
  }
}

// Setup Server-Sent Events
function setupSSE() {
  eventSource = api.createOrderTrackingStream(
    orderId,
    (data) => handleSSEMessage(data),
    (error) => {
      console.error('SSE connection error:', error);
      setTimeout(setupSSE, 5000);
    }
  );
}

// Handle SSE messages
function handleSSEMessage(data) {
  if (data.type === 'INITIAL' || data.type === 'STATUS_UPDATE') {
    const newStatus = data.data.status;

    // Check for status change to trigger notification
    if (orderLoaded && currentStatus && newStatus !== currentStatus) {
      // Delay slightly to allow UI to update underneath
      setTimeout(() => showNotification(newStatus), 500);
    }

    currentStatus = newStatus;
    orderLoaded = true;
    renderOrderTracking(data.data);
  }
}

// Render order tracking UI
function renderOrderTracking(trackingData) {
  // Order number
  document.getElementById('orderNumber').textContent = `#${trackingData.orderNumber}`;

  // Status Card Elements
  const statusCard = document.getElementById('statusCard');
  const statusText = document.getElementById('statusText');
  const statusEstimate = document.getElementById('statusEstimate');
  const statusIcon = statusCard.querySelector('.status-icon-large');

  // Reset Classes
  statusCard.className = 'status-card';

  // Instruction Element
  const instructionEl = document.getElementById('collectionInstruction');
  if (instructionEl) instructionEl.style.display = 'none';

  // Update Status State
  if (trackingData.status === 'NEW') {
    statusCard.classList.add('preparing');
    statusText.textContent = 'ORDER RECEIVED';
    statusIcon.textContent = '🧾';
    statusEstimate.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/><path d="M12 6v6l4 2" stroke-width="2"/></svg>
            <span>~${trackingData.estimatedPrepTime || 5} mins</span>`;

  } else if (trackingData.status === 'PREP') {
    statusCard.classList.add('preparing');
    statusText.textContent = 'COOKING';
    statusIcon.textContent = '🍳';
    statusEstimate.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke-width="2"/><path d="M12 6v6l4 2" stroke-width="2"/></svg>
            <span>~${trackingData.estimatedPrepTime || 5} mins</span>`;

  } else if (trackingData.status === 'READY') {
    statusCard.classList.add('ready');
    statusText.textContent = 'READY';
    // Icon is SVG in HTML, update it via class or keep existing
    statusEstimate.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#48BB78" stroke-width="2"><path d="M20 6L9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span style="color: #DC2626; font-weight: 700;">Pick up at ${trackingData.pickupLocation || 'Counter'}</span>`;

    if (instructionEl) {
      instructionEl.style.display = 'block';

      // Always use clear collection message
      instructionEl.textContent = 'Show this screen at the counter to collect your order';
    }

  } else if (trackingData.status === 'COMPLETE') {
    statusCard.classList.add('ready');
    statusText.textContent = 'DELIVERED';
    statusIcon.textContent = '😋';
    statusEstimate.innerHTML = `<span>Order Verified</span>`;
  }

  // Timeline
  renderTimeline(trackingData.timeline || []);

  // Order Details
  renderOrderDetails(trackingData.items || [], trackingData.total || 0);
}

// Render timeline
function renderTimeline(timeline) {
  const timelineContainer = document.getElementById('timeline');

  // Define timeline flow
  const steps = [
    { code: 'NEW', label: 'Order Sent' },
    { code: 'PREP', label: 'Kitchen Preparing' },
    { code: 'READY', label: 'Ready for Pickup' }
  ];

  timelineContainer.innerHTML = steps.map((step, index) => {
    // Check if this step is reached
    const entry = timeline.find(t => t.status === step.code);
    // Step is active if it matches current status
    const isActive = (currentStatus === step.code);
    // Step is completed if found, OR if we are past this stage (e.g. READY implies PREP is done)
    const isCompleted = entry || (currentStatus === 'READY' && step.code !== 'READY') || (currentStatus === 'COMPLETE');

    return `
            <div class="timeline-item ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}">
                <div class="timeline-icon">
                   ${isCompleted ? '✓' : (index + 1)}
                </div>
                <div class="timeline-content">
                    <div class="timeline-status">${step.label}</div>
                     ${entry ? `<div class="timeline-time">${entry.time}</div>` : ''}
                </div>
            </div>
        `;
  }).join('');
}

// Render order details
function renderOrderDetails(items, total) {
  const itemsList = document.getElementById('orderItemsList');
  itemsList.innerHTML = items.map(item => `
        <div class="detail-row">
            <div class="detail-label">${item.quantity}x ${item.name}</div>
            <div class="detail-value">$${(item.price || 0).toFixed(2)}</div>
        </div>
    `).join('');
  document.getElementById('orderTotal').textContent = `$${(total || 0).toFixed(2)}`;
}

// Toggle order details
function toggleOrderDetails() {
  const content = document.getElementById('orderDetailsContent');
  const chevron = document.getElementById('detailsChevron');

  if (content.style.display === 'none') {
    content.style.display = 'block';
    setTimeout(() => chevron.style.transform = 'rotate(180deg)', 10);
  } else {
    content.style.display = 'none';
    setTimeout(() => chevron.style.transform = 'rotate(0deg)', 10);
  }
}

// Show error
function showError(message) {
  if (orderLoaded) return;
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: white; padding: 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); color: red; z-index: 2000;`;
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);

// Cleanup
window.addEventListener('beforeunload', () => {
  if (eventSource) eventSource.close();
});
