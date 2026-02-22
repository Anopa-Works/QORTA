/**
 * Assign admin user to tenant
 * Creates or updates admin document in Firestore
 * Usage: node scripts/assign-admin.js <email> <tenant-slug> [role]
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

async function assignAdmin() {
    const email = process.argv[2];
    const tenantSlug = process.argv[3];
    const role = process.argv[4] || 'owner';

    if (!email || !tenantSlug) {
        console.error('Usage: node scripts/assign-admin.js <email> <tenant-slug> [role]');
        console.error('Examples:');
        console.error('  node scripts/assign-admin.js admin@chickenmatty.com chicken-matty');
        console.error('  node scripts/assign-admin.js waiter@example.com chicken-matty staff');
        console.error('\nValid roles: owner, manager, staff');
        process.exit(1);
    }

    try {
        // 1. Get user from Firebase Auth
        console.log(`\n🔍 Looking up user: ${email}`);
        const userRecord = await admin.auth().getUserByEmail(email);
        console.log(`✅ Found user with UID: ${userRecord.uid}`);

        // 2. Get tenant by slug
        console.log(`\n🔍 Looking up tenant: ${tenantSlug}`);
        const tenantsSnapshot = await db.collection('tenants')
            .where('slug', '==', tenantSlug)
            .limit(1)
            .get();

        if (tenantsSnapshot.empty) {
            console.error(`\n❌ Tenant not found with slug: ${tenantSlug}`);
            console.error('Available tenants:');
            const allTenants = await db.collection('tenants').get();
            allTenants.forEach(doc => {
                const data = doc.data();
                console.error(`  - ${data.slug} (${data.name})`);
            });
            process.exit(1);
        }

        const tenantDoc = tenantsSnapshot.docs[0];
        const tenantId = tenantDoc.id;
        const tenantData = tenantDoc.data();
        console.log(`✅ Found tenant:`);
        console.log(`   - Name: ${tenantData.name}`);
        console.log(`   - Slug: ${tenantData.slug}`);
        console.log(`   - ID: ${tenantId}`);

        // 3. Check if admin document already exists
        const adminDocRef = db.collection('admins').doc(userRecord.uid);
        const existingDoc = await adminDocRef.get();

        if (existingDoc.exists) {
            console.log(`\n⚠️  Admin document already exists:`);
            console.log(JSON.stringify(existingDoc.data(), null, 2));
            console.log(`\n🔄 Updating to new tenant...`);
        } else {
            console.log(`\n📝 Creating new admin document...`);
        }

        // 4. Create/update admin document
        const adminData = {
            email,
            tenantId,
            role,
            assignedTables: null, // null = all tables by default
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Only set createdAt if it doesn't exist
        if (!existingDoc.exists) {
            adminData.createdAt = admin.firestore.FieldValue.serverTimestamp();
        }

        await adminDocRef.set(adminData, { merge: true });

        console.log(`\n✅ Admin document created/updated successfully!`);
        console.log(`\nAdmin details:`);
        console.log(`   - Email: ${email}`);
        console.log(`   - UID: ${userRecord.uid}`);
        console.log(`   - Tenant: ${tenantData.name} (${tenantSlug})`);
        console.log(`   - Role: ${role}`);
        console.log(`   - Assigned Tables: All tables (null)`);
        console.log(`\n✅ User can now access ${tenantSlug} admin/kitchen/waiter dashboards.`);

    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            console.error(`\n❌ User not found in Firebase Auth: ${email}`);
            console.error('The user needs to be created first in Firebase Auth.');
        } else {
            console.error(`\n❌ Error:`, error.message);
            console.error(error);
        }
        process.exit(1);
    }

    process.exit(0);
}

assignAdmin();
