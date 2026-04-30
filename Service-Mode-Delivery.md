# QORTA — Service Mode Feature Delivery
**Prepared for:** [Recipient Name] · **Date:** February 2026

---

## Background — What QORTA Was Before

QORTA originally operated as a **self-ordering system**. Customers would scan a QR code at their table, browse the menu on their phone, and place orders directly — no staff involvement needed. Orders went straight to the kitchen. It was designed for fast-food or casual setups where customers handle their own ordering.

There was no concept of waiters, table assignments, or staff-placed orders. One mode, one flow.

---

## What You Asked For

The request was to support **sit-down restaurant service** — where a waiter takes the order on behalf of the customer at the table, not the customer themselves. Specifically:

- Waiters needed their own login and dashboard to place orders on behalf of customers
- When service mode is on, customers should not be able to self-order (staff handles it)
- The kitchen needed to know which waiter placed which order
- A toggle was needed to switch a restaurant between self-ordering mode and waiter-service mode

---

## What Was Built

### Waiter Dashboard
A dedicated screen for waiters to log in, select a table, browse the full menu, and place orders on behalf of seated customers. The kitchen receives the order instantly and can see the waiter's name attached to it.

### Customer Menu — Blocked in Service Mode
When service mode is active, the customer-facing menu displays a "Staff Only" message and prevents self-ordering. Customers are attended to by staff.

### Service Mode Toggle
A toggle in the admin panel allows the restaurant to switch between:
- **Service Mode ON** — waiters take orders, customers cannot self-order
- **Service Mode OFF** — customers order via QR code as normal

### Kitchen Display Updated
The kitchen board now shows the waiter's name on any order placed by staff, so kitchen staff know who to hand the order to when it's ready.

### Waiter → Kitchen → Waiter Notification Loop
When the kitchen marks an order as **Ready**, the waiter who placed the order receives an instant notification on their screen — no shouting across the restaurant needed.

### Permission Structure
| Role | Access |
|---|---|
| Platform Admin | Enable/disable service mode per restaurant, set table count |
| Restaurant Admin | Manage menus, view orders, toggle service mode |
| Waiter | Log in, place orders for tables, receive ready notifications |
| Customer | Self-order via QR (disabled when service mode is on) |

---

## Current Status

Everything listed above is **live and working** as of this delivery. The full flow has been tested end-to-end:

1. Restaurant admin enables service mode
2. Waiter logs in and selects a table
3. Waiter places order on customer's behalf
4. Kitchen receives order instantly
5. Kitchen marks order ready
6. Waiter receives push notification immediately

---

*Built on QORTA — questions or adjustments, just reach out.*
