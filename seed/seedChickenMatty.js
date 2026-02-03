/**
 * QORTA Backend - Chicken Matty Seed Data
 * Run: node seed/seedChickenMatty.js
 */

require('dotenv').config();
const { initializeFirebase, getDb, COLLECTIONS } = require('../config/firebase');

const seedChickenMatty = async () => {
    console.log('🌱 Starting Chicken Matty seed process...\n');

    try {
        initializeFirebase();
        const db = getDb();

        // ================== CREATE TENANT ==================
        console.log('📦 Creating tenant: Chicken Matty...');

        const tenantData = {
            slug: 'chicken-matty',
            name: 'Chicken Matty',
            settings: {
                taxRate: 0.08,
                currency: 'USD',
                timezone: 'Africa/Harare'
            },
            isActive: true,
            createdAt: new Date()
        };

        // Check if exists first to avoid dupes or overwrite
        const tenantsRef = db.collection(COLLECTIONS.TENANTS);
        const snapshot = await tenantsRef.where('slug', '==', 'chicken-matty').get();

        let tenantId;
        if (!snapshot.empty) {
            console.log('  ⚠️ Tenant already exists. Updating...');
            tenantId = snapshot.docs[0].id;
            await tenantsRef.doc(tenantId).update(tenantData);
        } else {
            const docRef = await tenantsRef.add(tenantData);
            tenantId = docRef.id;
            console.log(`  ✅ Tenant created: ${tenantId}`);
        }

        // ================== CREATE CATEGORIES ==================
        console.log('\n📁 Creating categories...');

        const categories = [
            { name: 'All', slug: 'all', order: 0 },
            { name: 'Grilled Chicken', slug: 'chicken', order: 1 },
            { name: 'Pizzas', slug: 'pizza', order: 2 },
            { name: 'Family Meals', slug: 'family', order: 3 },
            { name: 'Drinks', slug: 'drinks', order: 4 }
        ];

        // Clean up old categories for this tenant if any (optional, but good for clean seed)
        // For simplicity, we'll just add new ones. In prod, be careful.

        const categoryMap = {}; // name -> id

        for (const cat of categories) {
            // Check existence
            const catSnapshot = await db.collection(COLLECTIONS.CATEGORIES)
                .where('tenantId', '==', tenantId)
                .where('slug', '==', cat.slug)
                .get();

            let catId;
            if (!catSnapshot.empty) {
                catId = catSnapshot.docs[0].id;
                await db.collection(COLLECTIONS.CATEGORIES).doc(catId).update({ ...cat, tenantId });
            } else {
                const res = await db.collection(COLLECTIONS.CATEGORIES).add({
                    ...cat,
                    tenantId,
                    isActive: true,
                    createdAt: new Date()
                });
                catId = res.id;
            }
            categoryMap[cat.slug] = catId;
            console.log(`  ✅ Category: ${cat.name}`);
        }

        // ================== CREATE MENU ITEMS ==================
        console.log('\n🍔 Creating menu items...');

        const menuItems = [
            {
                name: 'Quarter Chicken',
                description: 'Succulent quarter chicken grilled to perfection with your choice of sauce.',
                price: 5.00,
                category: 'chicken', // slug
                isFeatured: false,
                isBestseller: true,
                modifiers: [
                    { name: 'Lemon & Herb', price: 0 },
                    { name: 'Mild', price: 0 },
                    { name: 'Hot', price: 0 }
                ]
            },
            {
                name: 'Half Chicken',
                description: 'Half a chicken, flame-grilled and basted in our secret sauce.',
                price: 9.00,
                category: 'chicken',
                isFeatured: true,
                modifiers: [
                    { name: 'Lemon & Herb', price: 0 },
                    { name: 'Medium', price: 0 },
                    { name: 'Extra Hot', price: 0 }
                ]
            },
            {
                name: 'Sweet & Sour Pizza',
                description: 'A unique blend of sweet and tangy flavors on a crispy crust.',
                price: 12.00,
                category: 'pizza',
                isFeatured: true,
                modifiers: [
                    { name: 'Extra Cheese', price: 2.00 }
                ]
            },
            {
                name: 'Chicken & Mushroom Pizza',
                description: 'Classic combination of tender chicken and fresh mushrooms.',
                price: 11.00,
                category: 'pizza',
                isFeatured: false
            },
            {
                name: 'Matty Family Feast',
                description: 'Why cook? Full chicken, 2 large chips, 4 rolls, and a large salad.',
                price: 25.00,
                category: 'family',
                isFeatured: true,
                isBestseller: true
            },
            {
                name: 'Coca Cola 2L',
                description: 'Family size refreshing drink.',
                price: 3.50,
                category: 'drinks',
                isFeatured: false
            }
        ];

        for (const item of menuItems) {
            const catId = categoryMap[item.category];
            // Simple existence check by name for this tenant
            const itemSnapshot = await db.collection(COLLECTIONS.MENU_ITEMS)
                .where('tenantId', '==', tenantId)
                .where('name', '==', item.name)
                .get();

            const itemData = {
                ...item,
                category: catId, // Use the ID
                tenantId,
                imageUrl: '', // default placeholder
                available: true,
                updatedAt: new Date()
            };

            if (!itemSnapshot.empty) {
                await db.collection(COLLECTIONS.MENU_ITEMS).doc(itemSnapshot.docs[0].id).update(itemData);
                console.log(`  ✅ Updated: ${item.name}`);
            } else {
                await db.collection(COLLECTIONS.MENU_ITEMS).add({
                    ...itemData,
                    createdAt: new Date()
                });
                console.log(`  ✅ Created: ${item.name}`);
            }
        }

        console.log('\n✨ Chicken Matty seeded successfully!');
        console.log(`\n📌 Tenant Slug: chicken-matty`);
        console.log(`   Access at: /chicken-matty\n`);

        process.exit(0);
    } catch (error) {
        console.error('❌ Seed failed:', error);
        process.exit(1);
    }
};

seedChickenMatty();
