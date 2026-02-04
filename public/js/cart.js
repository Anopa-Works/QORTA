/**
 * QORTA Frontend - Cart Management
 * Shopping cart state and operations
 */

class Cart {
    constructor() {
        // Namespace cart by tenant to prevent item leakage
        // We assume api.js is loaded first and 'api' global exists
        if (!window.api || !window.api.tenantSlug) {
            console.error('CRITICAL: Cart initialized without tenant context.');
            this.tenantSlug = 'unknown_tenant'; // Fail-safe to avoid crashing, but won't save to a real tenant
        } else {
            this.tenantSlug = window.api.tenantSlug;
        }

        this.storageKey = `qorta_cart_${this.tenantSlug}`;

        this.items = this.loadFromStorage();
        this.listeners = [];
    }

    // Load cart from localStorage
    loadFromStorage() {
        const stored = localStorage.getItem(this.storageKey);
        return stored ? JSON.parse(stored) : [];
    }

    // Save cart to localStorage
    saveToStorage() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.items));
        this.notifyListeners();

        // Dispatch event for mobile nav badge update
        window.dispatchEvent(new CustomEvent('cartUpdated'));
    }

    // Add listener for cart changes
    onChange(callback) {
        this.listeners.push(callback);
    }

    // Notify all listeners
    notifyListeners() {
        this.listeners.forEach(callback => callback(this.items));
    }

    // Add item to cart
    addItem(menuItem, quantity = 1, modifiers = []) {
        const existingIndex = this.items.findIndex(item =>
            item.menuItemId === menuItem.id &&
            JSON.stringify(item.modifiers) === JSON.stringify(modifiers)
        );

        if (existingIndex >= 0) {
            // Increment quantity if same item with same modifiers
            this.items[existingIndex].quantity += quantity;
        } else {
            // Add new item
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

        this.saveToStorage();
    }

    // Update item quantity
    updateQuantity(index, quantity) {
        if (quantity <= 0) {
            this.removeItem(index);
        } else {
            this.items[index].quantity = quantity;
            this.saveToStorage();
        }
    }

    // Remove item
    removeItem(index) {
        this.items.splice(index, 1);
        this.saveToStorage();
    }

    // Clear cart
    clear() {
        this.items = [];
        this.saveToStorage();
    }

    // Get cart item count
    getItemCount() {
        return this.items.reduce((sum, item) => sum + item.quantity, 0);
    }

    // Calculate subtotal
    getSubtotal() {
        return this.items.reduce((sum, item) => {
            const itemTotal = item.unitPrice * item.quantity;
            const modifiersTotal = item.modifierPrices.reduce((a, b) => a + b, 0) * item.quantity;
            return sum + itemTotal + modifiersTotal;
        }, 0);
    }

    // Calculate tax
    getTax(taxRate = 0.08) {
        return Math.round(this.getSubtotal() * taxRate * 100) / 100;
    }

    // Calculate total
    getTotal(taxRate = 0.08) {
        return Math.round((this.getSubtotal() + this.getTax(taxRate)) * 100) / 100;
    }

    // Get all items
    getItems() {
        return this.items;
    }
}

// Create global cart instance
const cart = new Cart();
