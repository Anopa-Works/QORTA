require('dotenv').config();
const { initializeFirebase, getDb, COLLECTIONS } = require('./config/firebase');

const fixAdmin = async () => {
    console.log('🔧 Fixing Admin Access...');

    try {
        initializeFirebase();
        const db = getDb();

        // 1. Find the Tenant ID for Chicken Matty
        const tenantsSnapshot = await db.collection(COLLECTIONS.TENANTS)
            .where('slug', '==', 'chicken-matty')
            .limit(1)
            .get();

        if (tenantsSnapshot.empty) {
            console.error('❌ Error: Could not find "Chicken Matty" tenant!');
            console.log('💡 TIP: You might need to run: node seed/seedChickenMatty.js');
            process.exit(1);
        }

        const tenantDoc = tenantsSnapshot.docs[0];
        const tenantId = tenantDoc.id;
        console.log(`✅ Found Tenant: Chicken Matty (ID: ${tenantId})`);

        // 2. The User's UID (from chat)
        const myUid = 'xck32uWaB0VjmbIhlQzVHLHpFEp1';

        // 3. Create the Admin Document
        console.log(`👤 creating admin profile for UID: ${myUid}...`);

        await db.collection('admins').doc(myUid).set({
            tenantId: tenantId,
            role: 'owner',
            email: 'admin@qorta.com', // Placeholder, doesn't strictly matter for auth
            createdAt: new Date(),
            updatedAt: new Date()
        });

        console.log('✅ SUCCESS! Admin access granted.');
        console.log('👉 You can now refresh the Kitchen Board.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

fixAdmin();
