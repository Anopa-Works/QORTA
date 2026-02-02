/**
 * Firebase Setup Script
 * Automatically extracts credentials from Firebase JSON and creates .env file
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Path to the downloaded Firebase JSON file
const downloadsPath = path.join(os.homedir(), 'Downloads');
const firebaseJsonPath = path.join(downloadsPath, 'qorta-production-firebase-adminsdk-fbsvc-298b626f06.json');

// Path to .env file
const envPath = path.join(__dirname, '.env');

console.log('🔧 Firebase Setup Script\n');

// Check if Firebase JSON exists
if (!fs.existsSync(firebaseJsonPath)) {
    console.error('❌ Error: Firebase JSON file not found at:');
    console.error('   ' + firebaseJsonPath);
    console.error('\nPlease make sure the file is in your Downloads folder.');
    process.exit(1);
}

try {
    // Read and parse Firebase JSON
    console.log('📖 Reading Firebase credentials...');
    const firebaseJson = JSON.parse(fs.readFileSync(firebaseJsonPath, 'utf8'));

    // Extract required fields
    const projectId = firebaseJson.project_id;
    const privateKey = firebaseJson.private_key;
    const clientEmail = firebaseJson.client_email;

    // Validate fields
    if (!projectId || !privateKey || !clientEmail) {
        console.error('❌ Error: Missing required fields in Firebase JSON');
        process.exit(1);
    }

    console.log('✅ Credentials extracted successfully');
    console.log('   Project ID: ' + projectId);
    console.log('   Client Email: ' + clientEmail);

    // Create .env content
    const envContent = `# Server Configuration
PORT=3000
NODE_ENV=development

# Firebase Configuration
FIREBASE_PROJECT_ID=${projectId}
FIREBASE_PRIVATE_KEY="${privateKey}"
FIREBASE_CLIENT_EMAIL=${clientEmail}

# CORS Configuration
CORS_ORIGIN=http://localhost:8080
`;

    // Write .env file
    console.log('\n📝 Creating .env file...');
    fs.writeFileSync(envPath, envContent, 'utf8');

    console.log('✅ .env file created successfully at:');
    console.log('   ' + envPath);

    console.log('\n🎉 Firebase setup complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npm run dev');
    console.log('2. Run: node seed/seedData.js');
    console.log('3. Test your application');

} catch (error) {
    console.error('❌ Error setting up Firebase:', error.message);
    process.exit(1);
}
