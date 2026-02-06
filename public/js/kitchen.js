/**
 * QORTA Frontend - Kitchen Board Logic
 */

let kitchenData = { counts: {}, orders: {}, avgPrepTime: 0 };
let eventSource = null;
let audioCtx = null;

// Initialize Audio Context
function initAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  } catch (e) {
    // Warn:('Web Audio API not supported');
  }
}

// Play notification sound
function playNotificationSound() {
  if (!audioCtx) initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  if (!audioCtx) return;

  // "Ding Ding" sound for kitchen
  const now = audioCtx.currentTime;

  // First Ding
  const osc1 = audioCtx.createOscillator();
  const gain1 = audioCtx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(660, now);
  gain1.gain.setValueAtTime(0.3, now);
  gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
  osc1.connect(gain1);
  gain1.connect(audioCtx.destination);
  osc1.start(now);
  osc1.stop(now + 0.5);

  // Second Ding
  const osc2 = audioCtx.createOscillator();
  const gain2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(660, now + 0.2); // Delayed
  gain2.gain.setValueAtTime(0.3, now + 0.2);
  gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
  osc2.connect(gain2);
  gain2.connect(audioCtx.destination);
  osc2.start(now + 0.2);
  osc2.stop(now + 0.7);
}

// Wait for Firebase auth to be ready
function waitForAuth() {
  return new Promise((resolve) => {
    const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// Initialize page
async function init() {
  const authLoading = document.getElementById('authLoading');

  // Try to pre-init audio on click (kitchen usually has interaction)
  document.addEventListener('click', initAudio, { once: true });

  try {
    const user = await waitForAuth();

    // Check for explicit kitchen access flag (force login session)
    if (!sessionStorage.getItem('kitchen_access_granted')) {
      // Force re-authentication even if firebase user exists
      window.location.href = 'admin-login.html?redirect=kitchen.html&reauth=true';
      return;
    }

    if (!user) {
      window.location.href = 'admin-login.html?redirect=kitchen.html&reauth=true';
      return;
    }

    if (authLoading) authLoading.style.display = 'none';

    updateClock();
    setInterval(updateClock, 1000);

    await loadKitchenBoard();
    setupSSE();
  } catch (error) {
    // Error:('Initialization error:', error);
    window.location.href = 'admin-login.html?redirect=kitchen.html';
  }
}

// Load kitchen board data
async function loadKitchenBoard() {
  try {
    const response = await api.getKitchenBoard();
    kitchenData = response.data;
    renderKitchenBoard();
  } catch (error) {
    // Error:('Failed to load kitchen board:', error);
    // Check for 403 Forbidden - Redirect to Menu
    if (error.message.includes('Forbidden') || error.message.includes('403') || error.message.includes('access')) {
      const slug = api.tenantSlug;
      if (slug) {
        window.location.href = `/${slug}`;
      } else {
        window.location.href = '/';
      }
      return;
    }

    showError(`Unable to load kitchen board. ${error.message || 'Please refresh.'}`);
  }
}

// Setup Server-Sent Events for real-time updates
async function setupSSE() {
  try {
    const token = await firebase.auth().currentUser.getIdToken();
    eventSource = api.createKitchenStream(
      token,
      (data) => handleSSEMessage(data),
      (error) => {
        // Error:('SSE connection error:', error);
        setTimeout(setupSSE, 5000);
      }
    );
  } catch (error) {
    // Error:('Failed to get token for SSE:', error);
    setTimeout(setupSSE, 5000);
  }
}

// Handle SSE messages
function handleSSEMessage(data) {
  if (data.type === 'INITIAL') {
    kitchenData = data.data;
    renderKitchenBoard();
  } else if (data.type === 'NEW_ORDER') {
    if (!kitchenData.orders.NEW) kitchenData.orders.NEW = [];
    kitchenData.orders.NEW.push(data.order);
    kitchenData.counts.new = (kitchenData.counts.new || 0) + 1;
    renderKitchenBoard();
    playNotificationSound();

    // Add visual flash to header
    const newHeader = document.querySelector('.status-column.new .status-column-header');
    if (newHeader) {
      newHeader.style.animation = 'flash 1s';
      setTimeout(() => newHeader.style.animation = '', 1000);
    }

  } else if (data.type === 'ORDER_STATUS_CHANGED') {
    loadKitchenBoard();
  }
}

// Render kitchen board
function renderKitchenBoard() {
  document.getElementById('newCount').textContent = kitchenData.counts.new || 0;
  document.getElementById('prepCount').textContent = kitchenData.counts.prep || 0;
  document.getElementById('readyCount').textContent = kitchenData.counts.ready || 0;
  document.getElementById('avgPrepTime').textContent = `${kitchenData.avgPrepTime || 0}m Avg`;

  renderColumn('newOrders', kitchenData.orders.NEW || [], 'NEW');
  renderColumn('prepOrders', kitchenData.orders.PREP || [], 'PREP');
  renderColumn('readyOrders', kitchenData.orders.READY || [], 'READY');
}

// Render a status column
function renderColumn(containerId, orders, status) {
  const container = document.getElementById(containerId);

  if (!orders || orders.length === 0) {
    container.innerHTML = '<div class="empty-column">No orders</div>';
    return;
  }

  container.innerHTML = orders.map(order => createOrderCard(order, status)).join('');
}

// Create order card HTML
function createOrderCard(order, status) {
  const badgesHtml = [];

  if (order.tableNumber) {
    badgesHtml.push(`<span class="order-meta-badge dine-in">Table ${order.tableNumber}</span>`);
  }

  if (order.orderType === 'DINE_IN') {
    badgesHtml.push('<span class="order-meta-badge dine-in">Dine-in</span>');
  } else if (order.orderType === 'DELIVERY') {
    badgesHtml.push('<span class="order-meta-badge delivery">Delivery</span>');
  } else if (order.orderType === 'TAKEAWAY') {
    badgesHtml.push('<span class="order-meta-badge takeaway">Takeaway</span>');
  }

  const actionButton = getActionButton(order.id, status);

  // Build customer info section
  let customerInfo = '';
  if (order.customerName && order.customerName !== 'Guest') {
    customerInfo = `<div class="customer-name">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>    
        ${order.customerName}
    </div>`;
  }

  // Build notes/allergies section
  let notesSection = '';
  if (order.notes) {
    notesSection = `
      <div class="order-notes">
        <strong>⚠️ Notes:</strong>
        ${order.notes}
      </div>
    `;
  }

  // Build delivery info section
  let deliveryInfo = '';
  if (order.orderType === 'DELIVERY') {
    deliveryInfo = `
      <div class="delivery-info">
        ${order.deliveryAddress ? `<div class="delivery-address">📍 ${order.deliveryAddress}</div>` : ''}
        ${order.deliveryPhone ? `<div class="delivery-phone">📞 ${order.deliveryPhone}</div>` : ''}
      </div>
    `;
  }

  return `
    <div class="kitchen-order-card">
      <div class="order-card-header">
        <span class="order-number">#${order.orderNumber}</span>
        <span class="order-time-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" stroke-width="2"/>
            <path d="M12 6v6l4 2" stroke-width="2"/>
          </svg>
          ${order.timeAgo || 'Just now'}
        </span>
      </div>
      
      ${badgesHtml.length ? `<div class="order-meta">${badgesHtml.join('')}</div>` : ''}

      ${customerInfo}
      ${deliveryInfo}
      
      <div class="order-items-list">
        ${order.items.map(item => `
          <div class="order-item-row">
            <span class="item-qty">${item.quantity}</span>
            <span class="item-name">${item.name}</span>
          </div>
          ${item.modifiers && item.modifiers.length > 0 ? `
            <div class="item-modifier">${item.modifiers.join(', ')}</div>
          ` : ''}
        `).join('')}
      </div>

      ${notesSection}
      
      ${actionButton}
    </div>
  `;
}

// Get action button based on status
function getActionButton(orderId, status) {
  if (status === 'NEW') {
    return `
      <button class="order-action-btn btn-dark" onclick="updateStatus('${orderId}', 'PREP')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 2v20M17 7h-6a5 5 0 0 0 0 10h6" stroke-width="2"/></svg>
        Start Cooking
      </button>
    `;
  } else if (status === 'PREP') {
    return `
      <button class="order-action-btn btn-success" onclick="updateStatus('${orderId}', 'READY')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        Mark Ready
      </button>
    `;
  } else if (status === 'READY') {
    return `
      <button class="order-action-btn btn-dark" style="background:#4A5568" onclick="updateStatus('${orderId}', 'COMPLETE')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14"/></svg>
        Complete
      </button>
    `;
  }
  return '';
}

// Update order status
async function updateStatus(orderId, newStatus) {
  try {
    await api.updateOrderStatus(orderId, newStatus);
  } catch (error) {
    // Error:('Failed to update status:', error);
    // Error is logged, kitchen board will reload automatically
  }
}

// Update clock
function updateClock() {
  const now = new Date();
  const time = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Harare'
  });
  const el = document.getElementById('currentTime');
  if (el) el.textContent = time;
}

// Show error
function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 8px 16px rgba(0,0,0,0.2);
    text-align: center;
    z-index: 2000;
    max-width: 400px;
  `;
  errorDiv.innerHTML = `
    <p style="margin: 0 0 16px; font-size: 16px; color: #DC2626;">${message}</p>
    <button onclick="location.reload()" class="btn btn-primary">Reload Page</button>
  `;
  document.body.appendChild(errorDiv);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (eventSource) {
    eventSource.close();
  }
});

document.addEventListener('DOMContentLoaded', init);
