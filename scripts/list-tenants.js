/**
 * List all tenants from Firestore
 * Usage: node scripts/list-tenants.js
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

async function listTenants() {
    try {
        const snapshot = await db.collection('tenants').get();

        if (snapshot.empty) {
            console.log('No tenants found.');
            return;
        }

        console.log('\n📋 Tenants List:\n');
        console.log('ID                      | Slug              | Name                  | Active');
        console.log('------------------------|-------------------|----------------------|--------');

        snapshot.forEach(doc => {
            const data = doc.data();
            const id = doc.id.padEnd(23);
            const slug = (data.slug || 'N/A').padEnd(17);
            const name = (data.name || 'N/A').padEnd(20);
            const active = data.isActive ? '✓' : '✗';

            console.log(`${id} | ${slug} | ${name} | ${active}`);
        });

        console.log('\n');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

listTenants();
