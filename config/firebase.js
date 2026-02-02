/**
 * QORTA Backend - Firebase Configuration
 * Initializes Firebase Admin SDK and exports Firestore database
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin with environment variables
const initializeFirebase = () => {
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL
            })
        });
    }
    return admin;
};

// Get Firestore database instance
const getDb = () => {
    initializeFirebase();
    return admin.firestore();
};

// Collection names for multi-tenant structure
const COLLECTIONS = {
    TENANTS: 'tenants',
    MENU_ITEMS: 'menuItems',
    CATEGORIES: 'categories',
    ORDERS: 'orders'
};

module.exports = {
    initializeFirebase,
    getDb,
    COLLECTIONS,
    admin
};
