# QORTA — Chicken Hut Proposal
**Prepared by:** [Your Name] · **Date:** February 2026

---

## What QORTA Already Does

QORTA is a digital restaurant ordering system. Here's what's live and working today:

- **Customer ordering** — Customers scan a QR code, browse the menu, and place orders from their phone. No app download needed.
- **Kitchen board** — Orders appear in real time on a screen in the kitchen the moment they're placed.
- **Waiter notifications** — When the kitchen marks an order ready, the assigned waiter gets an instant alert on their screen.
- **Service mode** — The restaurant can enable or disable table ordering from the admin panel.
- **Admin dashboard** — Manage menu items, categories, and view all orders.
- **Order tracking** — Customers can follow their order status live using an order number.

---

## How Chicken Hut Currently Works

Orders are placed at the counter through a POS system. When an order is placed, the POS prints two receipts simultaneously — one goes to the customer, and a duplicate goes to the kitchen as the order ticket. The kitchen prepares based on that ticket, and once the order is handed over, the cashier collects the kitchen copy for record keeping.

**This works well for counter ordering. The gaps appear when:**
- A customer is seated and wants to order from the table — there's no way to do that without walking to the counter
- The kitchen finishes an order — there's no digital way to notify a waiter or customer; someone has to physically check
- Managers want to review order history, peak hours, or popular items — paper copies make that difficult
- The restaurant wants to grow into QR ordering, multiple locations, or delivery — the POS doesn't scale for that

---

## What We'd Change & How

### 1. Simplified Kitchen Screen
**The ask:** Kitchen staff shouldn't have to click through multiple steps. They just need to see what to prepare and hit one button when it's done.

**The solution:** Orders appear on the kitchen screen automatically the moment they're placed — no acceptance step needed. The only button kitchen staff ever press is **"Mark Ready."** That instantly notifies the waiter or front-of-house to collect the order.

---

### 2. Cashier Role
**The ask:** The cashier handles order acceptance and payment — not the kitchen.

**The solution:** A dedicated cashier screen showing incoming orders. The cashier confirms the order and payment on their end. This keeps the kitchen focused entirely on food, with a clear separation of responsibilities.

---

### 3. Digital Receipts
**The ask:** The system should produce receipts when an order is placed.

**The solution:** On order confirmation, the system generates a receipt showing order number, items, quantities, total, date/time, and restaurant name. This can be printed, displayed on screen, or shared as a link — replacing the paper duplicate currently going to the kitchen.

---

## Questions to Answer Before We Build

These will shape exactly how the system is set up for Chicken Hut:

**1. How will customers order?**
At the counter through a cashier, from the table via QR code on their phone, or both?

**2. Who confirms an order — and when?**
Does the cashier confirm after payment, or does the order go to the kitchen immediately and payment happens on pickup?

**3. What staff will be using the system on day one?**
For example: 1 cashier, 2 kitchen staff, 1 waiter. This determines how many screens and logins are needed.

**4. Do you need customer receipts, kitchen tickets, or both?**
A customer receipt is a summary of what was ordered and paid. A kitchen ticket is what the kitchen reads to prepare. Currently your POS prints both — should QORTA do the same?

**5. Will you keep the POS running alongside QORTA at first, or replace it?**
Running both in parallel is fine short-term. Knowing this helps plan the handover without disrupting daily operations.

---

*QORTA is already built and running. The changes above are refinements to fit your workflow — not a rebuild from scratch. Once these questions are answered, the setup can move quickly.*
