/**
 * QORTA Backend - Seed Data
 * Sample data based on reference screenshots
 * Run: node seed/seedData.js
 */

require('dotenv').config();
const { initializeFirebase, getDb, COLLECTIONS } = require('../config/firebase');

const seedData = async () => {
    console.log('🌱 Starting seed process...\n');

    try {
        initializeFirebase();
        const db = getDb();

        // ================== CREATE TENANT ==================
        console.log('📦 Creating tenant...');

        const tenantData = {
            slug: 'burger-palace',
            name: 'Burger Palace',
            settings: {
                taxRate: 0.08,
                currency: 'USD',
                timezone: 'America/New_York'
            },
            isActive: true,
            createdAt: new Date()
        };

        const tenantRef = await db.collection(COLLECTIONS.TENANTS).add(tenantData);
        const tenantId = tenantRef.id;
        console.log(`✅ Tenant created: ${tenantId}\n`);

        // ================== CREATE CATEGORIES ==================
        console.log('📁 Creating categories...');

        const categories = [
            { name: 'All', slug: 'all', order: 0 },
            { name: 'Burgers', slug: 'burgers', order: 1 },
            { name: 'Sides', slug: 'sides', order: 2 },
            { name: 'Drinks', slug: 'drinks', order: 3 },
            { name: 'Desserts', slug: 'desserts', order: 4 }
        ];

        for (const cat of categories) {
            await db.collection(COLLECTIONS.CATEGORIES).add({
                ...cat,
                tenantId,
                isActive: true,
                createdAt: new Date()
            });
            console.log(`  ✅ Category: ${cat.name}`);
        }
        console.log('');

        // ================== CREATE MENU ITEMS ==================
        console.log('🍔 Creating menu items...');

        const menuItems = [
            {
                name: 'Double Truffle Smash',
                description: 'Two smashed patties, truffle aioli, aged cheddar, caramelized onions',
                price: 16.00,
                category: 'burgers',
                isFeatured: true,
                isBestseller: true,
                imageUrl: 'images/burger.png',
                modifiers: [
                    { name: 'Extra Cheese', price: 1.50 },
                    { name: 'No Onions', price: 0 },
                    { name: 'Add Bacon', price: 2.00 }
                ],
                allergens: []
            },
            {
                name: 'Classic Burger',
                description: 'Beef patty, lettuce, tomato, pickles, special sauce',
                price: 12.00,
                category: 'burgers',
                isFeatured: false,
                isBestseller: false,
                imageUrl: 'images/burger.png',
                modifiers: [
                    { name: 'Extra Cheese', price: 1.50 },
                    { name: 'No Pickles', price: 0 },
                    { name: 'Add Bacon', price: 2.00 }
                ],
                allergens: []
            },
            {
                name: 'Smash Burger',
                description: 'Smashed beef patty, American cheese, pickles, onion',
                price: 12.00,
                category: 'burgers',
                isFeatured: false,
                isBestseller: false,
                modifiers: [
                    { name: 'Extra Cheese', price: 1.50 },
                    { name: 'No Pickles', price: 0 }
                ],
                allergens: ['PEANUTS']
            },
            {
                name: 'Spicy Chicken Wrap',
                description: 'Grilled chicken, spicy mayo, lettuce, tomato in a flour tortilla',
                price: 10.00,
                category: 'burgers',
                isFeatured: false,
                isBestseller: false,
                imageUrl: 'images/wrap.png',
                modifiers: [
                    { name: 'Extra Spicy', price: 0 },
                    { name: 'No Mayo', price: 0 }
                ],
                allergens: []
            },
            {
                name: 'Large Fries',
                description: 'Crispy golden fries, lightly salted',
                price: 5.00,
                category: 'sides',
                isFeatured: false,
                isBestseller: false,
                modifiers: [
                    { name: 'No Salt', price: 0 },
                    { name: 'Extra Salt', price: 0 },
                    { name: 'Add Cheese', price: 1.00 }
                ],
                allergens: []
            },
            {
                name: 'Caesar Salad',
                description: 'Romaine lettuce, parmesan, croutons, Caesar dressing',
                price: 8.00,
                category: 'sides',
                isFeatured: false,
                isBestseller: false,
                modifiers: [
                    { name: 'Add Chicken', price: 3.00 },
                    { name: 'No Croutons', price: 0 }
                ],
                allergens: ['NUT']
            },
            {
                name: 'Coca Cola',
                description: 'Classic Coca Cola, served cold',
                price: 3.00,
                category: 'drinks',
                isFeatured: false,
                isBestseller: false,
                imageUrl: 'images/latte.png', // Fallback for drink
                modifiers: [
                    { name: 'No Ice', price: 0 },
                    { name: 'Ice', price: 0 },
                    { name: 'Lemon', price: 0 }
                ],
                allergens: []
            },
            {
                name: 'Iced Latte',
                description: 'Espresso with cold milk over ice',
                price: 4.50,
                category: 'drinks',
                isFeatured: false,
                isBestseller: false,
                imageUrl: 'images/latte.png',
                modifiers: [
                    { name: 'Oat Milk', price: 0.50 },
                    { name: 'Extra Shot', price: 1.00 }
                ],
                allergens: []
            },
            {
                name: 'Espresso',
                description: 'Double shot of rich espresso',
                price: 3.00,
                category: 'drinks',
                isFeatured: false,
                isBestseller: false,
                modifiers: [],
                allergens: []
            },
            {
                name: 'Cheesecake',
                description: 'New York style cheesecake with berry compote',
                price: 6.00,
                category: 'desserts',
                isFeatured: false,
                isBestseller: false,
                imageUrl: 'images/cheesecake.png',
                modifiers: [],
                allergens: []
            },
            {
                name: 'Burger Deluxe',
                description: 'Premium beef patty, bacon, cheese, special sauce',
                price: 12.50,
                category: 'burgers',
                isFeatured: false,
                isBestseller: false,
                modifiers: [
                    { name: 'Extra Cheese', price: 1.50 }
                ],
                allergens: []
            }
        ];

        for (const item of menuItems) {
            await db.collection(COLLECTIONS.MENU_ITEMS).add({
                ...item,
                tenantId,
                imageUrl: item.imageUrl || '',
                available: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            console.log(`  ✅ Menu Item: ${item.name} - $${item.price.toFixed(2)}`);
        }

        console.log('\n✨ Seed completed successfully!');
        console.log(`\n📌 Your tenant slug is: burger-palace`);
        console.log(`   Access menu at: GET /api/burger-palace/menu`);
        console.log(`   Kitchen board at: GET /api/burger-palace/orders/kitchen\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
};

seedData();
