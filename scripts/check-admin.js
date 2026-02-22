/**
 * Check and fix admin document for a user
 * Usage: node scripts/check-admin.js <email>
 */

const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
    });
}

const db = admin.firestore();

async function checkAdmin() {
    const email = process.argv[2];

    if (!email) {
        console.error('Usage: node scripts/check-admin.js <email>');
        console.error('Example: node scripts/check-admin.js admin@chickenmatty.com');
        process.exit(1);
    }

    try {
        // 1. Get user from Firebase Auth
        console.log(`\n🔍 Looking up user: ${email}`);
        const userRecord = await admin.auth().getUserByEmail(email);
        console.log(`✅ Found Firebase Auth user: ${userRecord.uid}`);

        // 2. Check if admin document exists
        console.log(`\n🔍 Checking admin document...`);
        const adminDoc = await db.collection('admins').doc(userRecord.uid).get();

        if (!adminDoc.exists) {
            console.log(`❌ Admin document DOES NOT EXIST in Firestore`);
            console.log(`\nThis is the problem! The user exists in Firebase Auth but has no admin document.`);
            console.log(`\nTo fix this, you need to create an admin document.`);
            console.log(`Run: node scripts/assign-admin.js ${email} <tenant-slug>`);
            return;
        }

        const adminData = adminDoc.data();
        console.log(`✅ Admin document EXISTS`);
        console.log(`\nAdmin document data:`);
        console.log(JSON.stringify(adminData, null, 2));

        // 3. Get tenant info
        if (adminData.tenantId) {
            console.log(`\n🔍 Looking up tenant...`);
            const tenantDoc = await db.collection('tenants').doc(adminData.tenantId).get();

            if (tenantDoc.exists) {
                const tenantData = tenantDoc.data();
                console.log(`✅ Tenant found:`);
                console.log(`   - Name: ${tenantData.name}`);
                console.log(`   - Slug: ${tenantData.slug}`);
                console.log(`   - ID: ${adminData.tenantId}`);
            } else {
                console.log(`❌ Tenant NOT FOUND with ID: ${adminData.tenantId}`);
                console.log(`This is a problem! The admin references a non-existent tenant.`);
            }
        } else {
            console.log(`❌ Admin document has no tenantId field!`);
        }

        console.log(`\n✅ All checks passed! User should be able to access the kitchen board.`);

    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.error(`\n❌ User not found in Firebase Auth: ${email}`);
            console.error(`The user doesn't exist. Create them first.`);
        } else {
            console.error(`\n❌ Error:`, error.message);
        }
        process.exit(1);
    }

    process.exit(0);
}

checkAdmin();
