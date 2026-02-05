/**
 * QORTA Frontend - Cart Management
 * Shopping cart state and operations (In-Memory for Tier 1)
 */

class Cart {
    constructor() {
        // Initialize in-memory items (No localStorage)
        this.items = [];
        this.listeners = [];
        this.orderType = 'dine-in'; // Default

        // Namespace cart by tenant (optional for in-memory, but good context)
        if (!window.api || !window.api.tenantSlug) {
            console.error('CRITICAL: Cart initialized without tenant context.');
            this.tenantSlug = null;
        } else {
            this.tenantSlug = window.api.tenantSlug;
        }
    }

    notifyChange() {
        this.notifyListeners();
        window.dispatchEvent(new CustomEvent('cartUpdated'));
    }

    onChange(callback) { this.listeners.push(callback); }
    notifyListeners() { this.listeners.forEach(cb => cb(this.items)); }

    addItem(menuItem, quantity = 1, modifiers = []) {
        const existingIndex = this.items.findIndex(item =>
            item.menuItemId === menuItem.id &&
            JSON.stringify(item.modifiers) === JSON.stringify(modifiers)
        );
        if (existingIndex >= 0) {
            this.items[existingIndex].quantity += quantity;
        } else {
            this.items.push({
                menuItemId: menuItem.id,
                name: menuItem.name,
                unitPrice: menuItem.price,
                quantity,
                modifiers,
                modifierPrices: modifiers.map(m => {
                    const modifier = menuItem.modifiers.find(mod => mod.name === m);
                    return modifier ? modifier.price : 0;
                }),
                imageUrl: menuItem.imageUrl
            });
        }
        this.notifyChange();
    }

    updateQuantity(index, qty) {
        if (qty <= 0) this.removeItem(index);
        else { this.items[index].quantity = qty; this.notifyChange(); }
    }

    removeItem(index) {
        this.items.splice(index, 1);
        this.notifyChange();
    }

    clear() {
        this.items = [];
        this.notifyChange();
        closeCheckoutModal();
    }

    getItemCount() { return this.items.reduce((s, i) => s + i.quantity, 0); }

    getSubtotal() {
        return this.items.reduce((sum, item) => {
            const itemTotal = item.unitPrice * item.quantity;
            const modifiersTotal = item.modifierPrices.reduce((a, b) => a + b, 0) * item.quantity;
            return sum + itemTotal + modifiersTotal;
        }, 0);
    }

    getTax(rate = 0.08) { return Math.round(this.getSubtotal() * rate * 100) / 100; }
    getTotal(rate = 0.08) { return Math.round((this.getSubtotal() + this.getTax(rate)) * 100) / 100; }
    getItems() { return this.items; }
}

const cart = new Cart();

// ==========================================
// CHECKOUT MODAL LOGIC
// ==========================================

function openCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) {
        modal.style.display = 'flex';
        renderCheckoutItems();
    }
}

function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) modal.style.display = 'none';
}

function selectOrderType(type) {
    cart.orderType = type;
    document.querySelectorAll('.order-type-btn').forEach(btn =>
        btn.classList.toggle('active', btn.dataset.type === type)
    );
    // Show/hide fields logic
    const tableSection = document.getElementById('tableSection');
    if (tableSection) tableSection.style.display = type === 'dine-in' ? 'block' : 'none';
}

function renderCheckoutItems() {
    const container = document.getElementById('orderItemsContainer');
    const items = cart.getItems();

    // Update Totals
    const subtotalEl = document.getElementById('checkoutSubtotal');
    const taxEl = document.getElementById('checkoutTax');
    const totalEl = document.getElementById('checkoutTotal');

    if (subtotalEl) subtotalEl.textContent = `$${cart.getSubtotal().toFixed(2)}`;
    if (taxEl) taxEl.textContent = `$${cart.getTax().toFixed(2)}`;
    if (totalEl) totalEl.textContent = `$${cart.getTotal().toFixed(2)}`;

    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; color:#999;">Cart is empty</div>';
        return;
    }

    container.innerHTML = items.map((item, index) => `
        <div class="order-item">
            <div class="item-details">
                <div class="item-header">
                    <h3 class="item-name">${item.name}</h3>
                    <span class="item-price">$${((item.unitPrice + item.modifierPrices.reduce((a, b) => a + b, 0)) * item.quantity).toFixed(2)}</span>
                </div>
                ${item.modifiers.length ? `<p class="item-modifiers">+ ${item.modifiers.join(', ')}</p>` : ''}
                <div class="quantity-control" style="margin-top:8px;">
                     <button class="quantity-btn" onclick="cart.updateQuantity(${index}, ${item.quantity - 1}); renderCheckoutItems();">−</button>
                     <span class="quantity-value" style="margin:0 12px; font-weight:600;">${item.quantity}</span>
                     <button class="quantity-btn" onclick="cart.updateQuantity(${index}, ${item.quantity + 1}); renderCheckoutItems();">+</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function confirmOrder() {
    const items = cart.getItems();
    if (items.length === 0) return;

    const btn = document.getElementById('confirmOrderBtn');
    btn.disabled = true;
    btn.innerHTML = 'Processing...';

    // Basic Validation
    const tableNum = document.getElementById('tableNumber')?.value;
    if (cart.orderType === 'dine-in' && !tableNum) {
        alert('Please enter a table number');
        btn.disabled = false; btn.innerHTML = 'Confirm Order';
        return;
    }

    try {
        const orderData = {
            items: items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, modifiers: i.modifiers || [] })),
            orderType: cart.orderType === 'dine-in' ? 'DINE_IN' : 'TAKEOUT',
            tableNumber: cart.orderType === 'dine-in' ? parseInt(tableNum) : null,
            customerName: document.getElementById('customerName')?.value || 'Guest',
            notes: ''
        };

        const response = await api.createOrder(orderData);

        // Success
        document.getElementById('checkoutModal').style.display = 'none';
        const overlay = document.getElementById('successOverlay');
        overlay.classList.add('show');
        overlay.style.display = 'flex';

        // Redirect to Track (Preserving Tenant Context)
        setTimeout(() => {
            // Use explicit tenant slug for safety
            const targetPath = `/${api.tenantSlug}/track?order=${response.data.id}`;
            window.location.href = targetPath;
        }, 2000);

    } catch (e) {
        console.error(e);
        alert('Order Failed: ' + e.message);
        btn.disabled = false;
        btn.innerHTML = 'Confirm Order';
    }
}
