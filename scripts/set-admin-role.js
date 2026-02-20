/**
 * Set ADMIN role for restaurant admins in Firestore
 * Usage: node scripts/set-admin-role.js <email> <tenantId>
 */

require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    })
});

const db = admin.firestore();

const email = process.argv[2];
const tenantId = process.argv[3];

if (!email || !tenantId) {
    console.error('Usage: node scripts/set-admin-role.js <email> <tenantId>');
    console.error('Example: node scripts/set-admin-role.js admin@example.com LIJevObdz6WlKKncswyd');
    process.exit(1);
}

async function setAdminRole() {
    try {
        // Get user by email
        const userRecord = await admin.auth().getUserByEmail(email);
        const uid = userRecord.uid;

        console.log(`Found user: ${email} (UID: ${uid})`);

        // Set admin document with ADMIN role
        await db.collection('admins').doc(uid).set({
            email: email,
            tenantId: tenantId,
            role: 'ADMIN',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        console.log('✅ Successfully set ADMIN role for ' + email);
        console.log('   Tenant ID: ' + tenantId);
        console.log('   User must sign out and back in for changes to take effect.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

setAdminRole();
