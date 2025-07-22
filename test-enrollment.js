const fetch = require('node-fetch');

async function testEnrollment() {
  try {
    console.log('Testing QR enrollment functionality...');
    
    // Test data
    const testData = {
      qrCode: "SUBJECT:Data Structures (CS201)",
      studentId: 1
    };
    
    console.log('QR Code:', testData.qrCode);
    console.log('Student ID:', testData.studentId);
    
    const response = await fetch('http://localhost:4000/api/auth/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response body:', JSON.stringify(result, null, 2));
    
    if (response.ok) {
      console.log('✅ Enrollment test successful!');
    } else {
      console.log('❌ Enrollment test failed!');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Check if backend is running
async function checkBackend() {
  try {
    const response = await fetch('http://localhost:4000/api/health');
    const result = await response.json();
    console.log('Backend status:', result);
    return true;
  } catch (error) {
    console.log('❌ Backend not running. Please start the backend server first.');
    return false;
  }
}

async function runTests() {
  console.log('🔍 Checking backend status...');
  const backendRunning = await checkBackend();
  
  if (backendRunning) {
    await testEnrollment();
  }
}

runTests(); 