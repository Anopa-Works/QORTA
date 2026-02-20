/**
 * Check user custom claims
 * Run: node scripts/check-claims.js
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

async function checkClaims() {
    try {
        // Get user by email
        const user = await admin.auth().getUserByEmail('helloqorta@gmail.com');

        console.log('User UID:', user.uid);
        console.log('Email:', user.email);
        console.log('Custom Claims:', user.customClaims);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkClaims();
