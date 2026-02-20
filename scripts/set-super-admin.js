/**
 * Set SUPER_ADMIN custom claim for a user
 * Usage: node scripts/set-super-admin.js <email>
 */

require('dotenv').config();
const admin = require('firebase-admin');

// Initialize Firebase Admin with environment variables
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    })
});

const email = process.argv[2];

if (!email) {
    console.error('Usage: node scripts/set-super-admin.js <email>');
    process.exit(1);
}

async function setSuperAdmin() {
    try {
        // Get user by email
        const user = await admin.auth().getUserByEmail(email);

        // Set custom claim
        await admin.auth().setCustomUserClaims(user.uid, {
            role: 'SUPER_ADMIN'
        });

        console.log('✅ Successfully set SUPER_ADMIN role for ' + email);
        console.log('User UID: ' + user.uid);
        console.log('\nThe user will need to sign out and sign back in for the changes to take effect.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

setSuperAdmin();
