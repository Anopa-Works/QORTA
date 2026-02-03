/**
 * Create Admin User Script
 * Run: node scripts/createAdmin.js <email> <password>
 */

require('dotenv').config();
const { initializeFirebase } = require('../config/firebase');
const admin = require('firebase-admin');

const createAdmin = async () => {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: node scripts/createAdmin.js <email> <password>');
        process.exit(1);
    }

    const [email, password] = args;

    try {
        initializeFirebase();

        console.log(`Creating user: ${email}...`);

        try {
            // Check if user exists
            const userRecord = await admin.auth().getUserByEmail(email);
            console.log('User already exists. Updating password...');
            await admin.auth().updateUser(userRecord.uid, {
                password: password
            });
            console.log('✅ Password updated successfully!');
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                // Create new user
                const userRecord = await admin.auth().createUser({
                    email: email,
                    password: password,
                    emailVerified: true
                });
                console.log('✅ User created successfully!');
                console.log('UID:', userRecord.uid);
            } else {
                throw error;
            }
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ Failed to create/update user:', error);
        process.exit(1);
    }
};

createAdmin();
