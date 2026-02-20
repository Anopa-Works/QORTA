/**
 * Verify custom claims for a user
 * Usage: node scripts/verify-claims.js <email>
 */

require('dotenv').config();
const admin = require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL
    })
});

const email = process.argv[2];

if (!email) {
    console.error('Usage: node scripts/verify-claims.js <email>');
    process.exit(1);
}

async function verifyClaims() {
    try {
        const user = await admin.auth().getUserByEmail(email);
        console.log('User UID:', user.uid);
        console.log('Custom Claims:', user.customClaims);
        console.log('\n✅ Custom claims retrieved successfully');
        
        if (user.customClaims?.role === 'SUPER_ADMIN') {
            console.log('✅ SUPER_ADMIN role is set correctly');
        } else {
            console.log('❌ SUPER_ADMIN role is NOT set');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

verifyClaims();
