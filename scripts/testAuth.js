const axios = require('axios');
const readline = require('readline');
const dotenv = require('dotenv');

dotenv.config();

const apiUrl = 'http://localhost:5000/api';
let userToken = null;
let adminToken = null;

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const questionAsync = (query) => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

// Test user registration
const testRegisterUser = async () => {
  try {
    const name = await questionAsync('Enter name: ');
    const email = await questionAsync('Enter email: ');
    const password = await questionAsync('Enter password: ');
    
    console.log('\nRegistering user...');
    const response = await axios.post(`${apiUrl}/users`, {
      name,
      email,
      password
    });
    
    console.log('\nRegistration successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    console.log('\nCheck your email for the verification code.');
    
    return email;
  } catch (error) {
    console.error('\nRegistration failed:', error.response?.data || error.message);
  }
};

// Test verification code
const testVerifyEmail = async (email) => {
  try {
    if (!email) {
      email = await questionAsync('Enter your email: ');
    }
    
    const code = await questionAsync('Enter the 6-digit verification code from your email: ');
    
    console.log('\nVerifying email...');
    const response = await axios.post(`${apiUrl}/users/verify-email`, {
      email,
      code
    });
    
    console.log('\nEmail verification successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    userToken = response.data.token;
    console.log('\nJWT Token:', userToken);
    console.log('API Key:', response.data.apiKey);
    
    return userToken;
  } catch (error) {
    console.error('\nVerification failed:', error.response?.data || error.message);
  }
};

// Test user login
const testLoginUser = async () => {
  try {
    const email = await questionAsync('Enter email: ');
    const password = await questionAsync('Enter password: ');
    
    console.log('\nLogging in...');
    const response = await axios.post(`${apiUrl}/users/login`, {
      email,
      password
    });
    
    console.log('\nLogin successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    userToken = response.data.token;
    console.log('\nToken:', userToken);
    
    return userToken;
  } catch (error) {
    console.error('\nLogin failed:', error.response?.data || error.message);
  }
};

// Test admin login
const testLoginAdmin = async () => {
  try {
    const email = await questionAsync('Enter admin email: ');
    const password = await questionAsync('Enter admin password: ');
    
    console.log('\nLogging in as admin...');
    const response = await axios.post(`${apiUrl}/admin/login`, {
      email,
      password
    });
    
    console.log('\nAdmin login successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
    adminToken = response.data.token;
    console.log('\nAdmin Token:', adminToken);
    
    return adminToken;
  } catch (error) {
    console.error('\nAdmin login failed:', error.response?.data || error.message);
  }
};

// Test get user profile
const testGetUserProfile = async (token) => {
  try {
    if (!token) {
      console.log('No token available. Please login first.');
      return;
    }
    
    console.log('\nGetting user profile...');
    const response = await axios.get(`${apiUrl}/users/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('\nProfile retrieved successfully!');
    console.log('Profile:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('\nProfile retrieval failed:', error.response?.data || error.message);
  }
};

// Test API key
const testApiKey = async () => {
  try {
    const apiKey = await questionAsync('Enter API key: ');
    
    console.log('\nTesting API key...');
    const response = await axios.get(`${apiUrl}/v1/user`, {
      headers: { 'x-api-key': apiKey }
    });
    
    console.log('\nAPI key test successful!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('\nAPI key test failed:', error.response?.data || error.message);
  }
};

// Main menu
const showMenu = async () => {
  console.log('\n=== Auth Testing Tool ===');
  console.log('1. Register new user');
  console.log('2. Verify email with code');
  console.log('3. Login as user');
  console.log('4. Login as admin');
  console.log('5. Get user profile');
  console.log('6. Test API key');
  console.log('7. Exit');
  
  const choice = await questionAsync('\nEnter your choice (1-7): ');
  
  switch (choice) {
    case '1':
      await testRegisterUser();
      break;
    case '2':
      await testVerifyEmail();
      break;
    case '3':
      await testLoginUser();
      break;
    case '4':
      await testLoginAdmin();
      break;
    case '5':
      await testGetUserProfile(userToken);
      break;
    case '6':
      await testApiKey();
      break;
    case '7':
      console.log('Exiting...');
      rl.close();
      return;
    default:
      console.log('Invalid choice. Try again.');
  }
  
  await showMenu();
};

// Start the program
showMenu().catch(error => {
  console.error('Unhandled error:', error);
  rl.close();
}); 