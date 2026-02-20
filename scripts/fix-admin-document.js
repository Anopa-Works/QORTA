/**
 * Fix Admin Document
 * Corrects the admin document for chicken-matty tenant
 * Run: node scripts/fix-admin-document.js
 */

require('dotenv').config();
const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    })
});

const db = admin.firestore();

async function fixAdminDocument() {
    try {
        // The correct values based on the screenshots
        const FIREBASE_AUTH_UID = 'xck32uWaB0VjmbIhlQzVHLHpFEp1';  // User's Firebase Auth UID
        const TENANT_DOC_ID = 'LIJevObdz6WlKKncswyd';              // Tenant document ID
        const ADMIN_EMAIL = 'admin@chickenmatty.com';

        console.log('Fixing admin document...\n');

        // Step 1: Delete the wrong document (if it exists)
        console.log(`1. Deleting wrong admin document (ID: ${TENANT_DOC_ID})...`);
        await db.collection('admins').doc(TENANT_DOC_ID).delete();
        console.log('   Deleted.\n');

        // Step 2: Create/update the correct admin document
        console.log(`2. Creating correct admin document (ID: ${FIREBASE_AUTH_UID})...`);
        await db.collection('admins').doc(FIREBASE_AUTH_UID).set({
            email: ADMIN_EMAIL,
            role: 'ADMIN',
            tenantId: TENANT_DOC_ID,
            name: 'Admin',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log('   Created.\n');

        // Step 3: Verify
        console.log('3. Verifying...');
        const doc = await db.collection('admins').doc(FIREBASE_AUTH_UID).get();
        if (doc.exists) {
            console.log('   Admin document:', doc.data());
            console.log('\n✓ SUCCESS! Admin document fixed.');
            console.log(`\nYou can now log in with: ${ADMIN_EMAIL}`);
            console.log('Then navigate to: https://qorta.onrender.com/chicken-matty/kitchen');
        } else {
            console.log('   ERROR: Document not found after creation');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

fixAdminDocument();
