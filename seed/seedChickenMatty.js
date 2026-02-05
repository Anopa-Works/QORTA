/**
 * QORTA Backend - Seed Data for Chicken Matty
 * Run: node seed/seedChickenMatty.js
 */

require('dotenv').config();
const { initializeFirebase, getDb, COLLECTIONS } = require('../config/firebase');

const seedData = async () => {
    console.log('🌱 Starting seed process for Chicken Matty...\n');

    try {
        initializeFirebase();
        const db = getDb();

        const tenantSlug = 'chicken-matty';
        // Check if tenant already exists or fix the ID if we know it
        // We know the ID is likely LIJevObdz6WlKKncswyd from previous step
        const tenantId = 'LIJevObdz6WlKKncswyd';

        // ================== VERIFY TENANT ==================
        console.log('📦 Verifying tenant...');

        const tenantDoc = await db.collection(COLLECTIONS.TENANTS).doc(tenantId).get();
        if (!tenantDoc.exists) {
            console.log('⚠️ Tenant not found by ID. Creating or finding by slug...');
            // Fallback logic could be here but for now assume we need to maybe create or update
        } else {
            console.log('✅ Tenant found.');
        }

        // ================== CREATE CATEGORIES ==================
        console.log('📁 Creating categories...');

        const categories = [
            { name: 'All', slug: 'all', order: 0 },
            { name: 'Chicken', slug: 'chicken', order: 1 },
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
        console.log('🍗 Creating menu items...');

        const menuItems = [
            {
                name: 'Spicy Quarter Chicken',
                description: 'Quarter chicken marinated in peri-peri sauce, flame grilled.',
                price: 8.50,
                category: 'chicken',
                isFeatured: true,
                isBestseller: true,
                imageUrl: 'https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&q=80&w=800',
                modifiers: [
                    { name: 'Extra Hot', price: 0 },
                    { name: 'Lemon & Herb', price: 0 }
                ],
                allergens: []
            },
            {
                name: 'Whole Chicken Platter',
                description: 'Whole chicken with 2 large sides.',
                price: 24.00,
                category: 'chicken',
                isFeatured: true,
                isBestseller: false,
                imageUrl: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&q=80&w=800',
                modifiers: [
                    { name: 'Garlic Bread', price: 2.00 }
                ],
                allergens: []
            },
            {
                name: 'Chicken Wings (6pcs)',
                description: 'Crispy fried wings tossed in buffalo sauce.',
                price: 9.00,
                category: 'chicken',
                isFeatured: false,
                isBestseller: true,
                imageUrl: '',
                modifiers: [
                    { name: 'Blue Cheese Dip', price: 1.00 }
                ],
                allergens: []
            },
            {
                name: 'Peri-Peri Fries',
                description: 'Crispy fries dusted with peri-peri salt.',
                price: 4.50,
                category: 'sides',
                isFeatured: false,
                isBestseller: false,
                modifiers: [
                    { name: 'Melty Cheese', price: 1.50 }
                ],
                allergens: []
            },
            {
                name: 'Coleslaw',
                description: 'Fresh crunchy slaw with creamy dressing.',
                price: 3.50,
                category: 'sides',
                isFeatured: false,
                isBestseller: false,
                modifiers: [],
                allergens: ['EGG']
            },
            {
                name: 'Iced Tea',
                description: 'Homemade lemon iced tea.',
                price: 3.00,
                category: 'drinks',
                isFeatured: false,
                isBestseller: false,
                modifiers: [],
                allergens: []
            },
            {
                name: 'Chocolate Brownie',
                description: 'Warm goooy brownie with vanilla ice cream.',
                price: 6.50,
                category: 'desserts',
                isFeatured: false,
                isBestseller: false,
                modifiers: [],
                allergens: ['GLUTEN', 'DAIRY']
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

        console.log('\n✨ Chicken Matty Seed completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
};

seedData();
