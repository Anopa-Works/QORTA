/**
 * Check admin role for a user
 * Usage: node scripts/check-admin-role.js <email>
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

if (!email) {
    console.error('Usage: node scripts/check-admin-role.js <email>');
    console.error('Example: node scripts/check-admin-role.js admin@chickenmatty.com');
    process.exit(1);
}

async function checkAdminRole() {
    try {
        // Get user by email
        const userRecord = await admin.auth().getUserByEmail(email);
        const uid = userRecord.uid;

        console.log(`\n📧 User: ${email}`);
        console.log(`🆔 UID: ${uid}`);

        // Check admin document
        const adminDoc = await db.collection('admins').doc(uid).get();

        if (!adminDoc.exists) {
            console.log('❌ No admin document found in Firestore');
            console.log('\nTo fix, run:');
            console.log(`node scripts/set-admin-role.js ${email} <tenantId>`);
        } else {
            const data = adminDoc.data();
            console.log('\n✅ Admin document found:');
            console.log('   Role:', data.role || 'NOT SET');
            console.log('   Tenant ID:', data.tenantId || 'NOT SET');
            console.log('   Email:', data.email || 'NOT SET');

            if (data.role === 'ADMIN' && data.tenantId) {
                console.log('\n✅ Admin is properly configured!');
            } else {
                console.log('\n⚠️  Admin document incomplete. Run:');
                console.log(`node scripts/set-admin-role.js ${email} ${data.tenantId || '<tenantId>'}`);
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkAdminRole();
