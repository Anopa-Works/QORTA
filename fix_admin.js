require('dotenv').config();
const { initializeFirebase, getDb, COLLECTIONS } = require('./config/firebase');

const fixAdmin = async () => {
    console.log('🔧 Fixing Admin Access...');

    try {
        initializeFirebase();
        const db = getDb();

        // 1. Get Arguments
        const myUid = process.argv[2];
        const targetSlug = process.argv[3] || 'burger-palace';

        if (!myUid) {
            console.error('❌ Error: Missing UID.');
            console.log('Usage: node fix_admin.js <FIREBASE_UID> <TENANT_SLUG>');
            console.log('Example: node fix_admin.js abc12345 chicken-matty');
            process.exit(1);
        }

        console.log(`🔍 Looking for tenant: "${targetSlug}"...`);

        // 2. Find the Tenant ID
        const tenantsSnapshot = await db.collection(COLLECTIONS.TENANTS)
            .where('slug', '==', targetSlug)
            .limit(1)
            .get();

        if (tenantsSnapshot.empty) {
            console.error(`❌ Error: Could not find tenant "${targetSlug}"!`);
            process.exit(1);
        }

        const tenantDoc = tenantsSnapshot.docs[0];
        const tenantId = tenantDoc.id;
        console.log(`✅ Found Tenant: ${targetSlug} (ID: ${tenantId})`);

        // 3. Create the Admin Document
        console.log(`👤 Linking UID: ${myUid} to Tenant: ${tenantId}...`);

        await db.collection('admins').doc(myUid).set({
            tenantId: tenantId,
            role: 'owner',
            email: 'admin@qorta.com',
            createdAt: new Date(),
            updatedAt: new Date()
        });

        console.log('✅ SUCCESS! Admin access granted.');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

fixAdmin();
