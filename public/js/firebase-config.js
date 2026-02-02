/**
 * QORTA Frontend - Firebase Configuration
 * Initialize Firebase for client-side authentication
 */

const firebaseConfig = {
    apiKey: "AIzaSyBzeIm1dZc26w3ZLDBqkRTk3hUx-qYW978", // Replace with your Firebase Web API Key
    authDomain: "qorta-production.firebaseapp.com",
    projectId: "qorta-production"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
