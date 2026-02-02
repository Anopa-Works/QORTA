# QORTA Backend

Multi-tenant SaaS backend for restaurant ordering systems. Reduce mistakes, speed up order processing, and provide operational clarity.

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your Firebase credentials

# Start development server
npm run dev

# (Optional) Seed sample data
node seed/seedData.js
```

## API Endpoints

### Tenant Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tenants` | List all tenants |
| POST | `/api/tenants` | Create tenant |
| GET | `/api/tenants/:slug` | Get tenant by slug |

### Menu (Tenant-Scoped)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/:slug/menu` | List menu items |
| GET | `/api/:slug/menu/featured` | Featured items |
| GET | `/api/:slug/categories` | List categories |
| POST | `/api/:slug/menu` | Create item (admin) |
| PUT | `/api/:slug/menu/:id` | Update item (admin) |
| DELETE | `/api/:slug/menu/:id` | Delete item (admin) |

### Orders (Tenant-Scoped)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/:slug/orders` | Create order |
| GET | `/api/:slug/orders` | List orders |
| GET | `/api/:slug/orders/kitchen` | Kitchen board |
| GET | `/api/:slug/orders/track/:orderNumber` | Customer tracking |
| PATCH | `/api/:slug/orders/:id/status` | Update status |

### Real-time Events (SSE)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/:slug/events/kitchen` | Kitchen updates stream |
| GET | `/api/:slug/events/order/:id` | Order tracking stream |

## Order Statuses
- `NEW` → Order just placed
- `PREP` → Kitchen preparing
- `READY` → Ready for pickup/serve
- `COMPLETE` → Order finished

## Example: Create Order

```bash
curl -X POST http://localhost:3000/api/burger-palace/orders \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "menuItemId": "abc123", "quantity": 2 }
    ],
    "orderType": "DINE_IN",
    "tableNumber": 12
  }'
```

## License
ISC
