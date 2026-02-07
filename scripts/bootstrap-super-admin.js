/**
 * Bootstrap Super Admin
 * Run once: node scripts/bootstrap-super-admin.js
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

// Replace with your UID from Firebase Console
const SUPER_ADMIN_UID = 'p3jkMokktYXsvdZKo7zq8BNs4oi2';

async function bootstrap() {
    try {
        // Set custom claim
        await admin.auth().setCustomUserClaims(SUPER_ADMIN_UID, { role: 'SUPER_ADMIN' });

        // Verify it worked
        const user = await admin.auth().getUser(SUPER_ADMIN_UID);
        console.log('Success! Custom claims set:');
        console.log(user.customClaims);

        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

bootstrap();
