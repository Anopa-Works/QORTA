# QORTA Frontend

Customer ordering and kitchen management interface for the QORTA multi-tenant restaurant system.

## Pages

- **`index.html`** - Customer menu with categories, featured items, cart
- **`checkout.html`** - Order summary, quantity controls, checkout
- **`track.html`** - Customer order tracking with timeline
- **`kitchen.html`** - Kitchen board with order status columns

## Setup

### Development Server

```bash
# Option 1: Python
cd public
python -m http.server 8080

# Option 2: Node.js (http-server)
npm install -g http-server
cd public
http-server -p 8080

# Option 3: VS Code Live Server extension
```

### Configuration

Update `js/api.js` with your tenant slug:
```javascript
const TENANT_SLUG = 'your-restaurant-slug';
```

## Features

✅ Category filtering
✅ Cart management with localStorage
✅ Real-time SSE updates
✅ Responsive design
✅ Status-based order flow
✅ Allergy alerts
✅ Time tracking

## Order Flow

1. Customer browses menu → adds to cart
2. Checkout → confirms order
3. Order appears in kitchen "NEW" column
4. Staff clicks "Start Preparing" → moves to "PREP"
5. Staff clicks "Mark Ready" → moves to "READY"
6. Customer sees "READY" on tracking page
7. Staff clicks "Complete" → archived

## Design

Colors and typography match reference screenshots:
- Primary Red: `#DC2626`
- Status colors: Red (NEW), Orange (PREP), Green (READY)
- Inter/System font stack
- Modern card-based UI

## Requirements

- Backend running on `http://localhost:3000`
- Modern browser with ES6 support
- EventSource API for SSE
