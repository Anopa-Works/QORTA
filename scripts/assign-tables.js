/**
 * Assign tables to a waiter
 * Usage: node scripts/assign-tables.js <email> <tables>
 *
 * Examples:
 *   node scripts/assign-tables.js waiter@example.com 1,2,3,4
 *   node scripts/assign-tables.js waiter@example.com 1-5
 *   node scripts/assign-tables.js waiter@example.com 1-5,10-15
 *   node scripts/assign-tables.js waiter@example.com null
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

/**
 * Parse table range string into array of table numbers
 * Examples:
 *   "1,2,3,4" → [1, 2, 3, 4]
 *   "1-5" → [1, 2, 3, 4, 5]
 *   "1-5,10-15" → [1, 2, 3, 4, 5, 10, 11, 12, 13, 14, 15]
 *   "null" → null (all tables)
 */
function parseTableRange(rangeStr) {
    if (rangeStr === 'null' || rangeStr === 'NULL') {
        return null;
    }

    const tables = new Set();
    const parts = rangeStr.split(',');

    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('-')) {
            // Range like "1-5"
            const [start, end] = trimmed.split('-').map(s => parseInt(s.trim()));
            if (isNaN(start) || isNaN(end)) {
                throw new Error(`Invalid range: ${part}`);
            }
            for (let i = start; i <= end; i++) {
                tables.add(i);
            }
        } else {
            // Single number like "4"
            const num = parseInt(trimmed);
            if (isNaN(num)) {
                throw new Error(`Invalid table number: ${part}`);
            }
            tables.add(num);
        }
    }

    return Array.from(tables).sort((a, b) => a - b);
}

async function assignTables() {
    const email = process.argv[2];
    const tablesInput = process.argv[3];

    if (!email || !tablesInput) {
        console.error('Usage: node scripts/assign-tables.js <email> <tables>');
        console.error('\nExamples:');
        console.error('  node scripts/assign-tables.js waiter@example.com 1,2,3,4');
        console.error('  node scripts/assign-tables.js waiter@example.com 1-5');
        console.error('  node scripts/assign-tables.js waiter@example.com 1-5,10-15');
        console.error('  node scripts/assign-tables.js waiter@example.com null');
        console.error('\nNote: "null" means waiter can access all tables');
        process.exit(1);
    }

    try {
        // Parse table range
        const tables = parseTableRange(tablesInput);

        // Get user UID from email
        const userRecord = await admin.auth().getUserByEmail(email);
        const uid = userRecord.uid;

        console.log(`\nFound user: ${email} (UID: ${uid})`);

        // Check if admin document exists
        const adminDoc = await db.collection('admins').doc(uid).get();
        if (!adminDoc.exists) {
            console.error('❌ Error: User is not an admin/waiter. Run set-admin-role.js first.');
            process.exit(1);
        }

        const tenantId = adminDoc.data().tenantId;
        console.log(`Tenant ID: ${tenantId}`);

        // Update admin document with table assignment
        await db.collection('admins').doc(uid).update({
            assignedTables: tables,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log('\n✅ Successfully assigned tables!');
        console.log(`   Email: ${email}`);
        console.log(`   Tables: ${tables === null ? 'ALL TABLES' : tables.join(', ')}`);
        console.log('\nℹ️  Waiter must log out and back in for changes to take effect.');

        process.exit(0);
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

assignTables();
