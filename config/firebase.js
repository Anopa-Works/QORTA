/**
 * QORTA Backend - Firebase Configuration
 * Initializes Firebase Admin SDK and exports Firestore database
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin with environment variables
const initializeFirebase = () => {
    if (admin.apps.length === 0) {
        console.log('Firebase: Initializing Admin SDK...');
        const projectId = process.env.FIREBASE_PROJECT_ID;
        if (!projectId) console.warn('WARNING: FIREBASE_PROJECT_ID is missing!');

        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL
            })
        });
        console.log(`Firebase: Initialized for project ${projectId}`);
    }
    return admin;
};

// Get Firestore database instance
const getDb = () => {
    initializeFirebase();
    return admin.firestore();
};

// Get Firebase Storage bucket
const getStorage = () => {
    initializeFirebase();
    const bucket = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;
    return admin.storage().bucket(bucket);
};

// Collection names for multi-tenant structure
const COLLECTIONS = {
    TENANTS: 'tenants',
    TENANT_SETTINGS: 'tenantSettings',
    ADMINS: 'admins',
    MENU_ITEMS: 'menuItems',
    CATEGORIES: 'categories',
    ORDERS: 'orders',
    EVENTS: 'events'
};

module.exports = {
    initializeFirebase,
    getDb,
    getStorage,
    COLLECTIONS,
    admin
};
