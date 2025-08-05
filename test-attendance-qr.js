// Test ATTENDANCE_ QR code parsing logic
const qrCode = "ATTENDANCE_Test_Subject_1234_2025-08-05";

console.log('Testing QR code:', qrCode);

// Check if it starts with ATTENDANCE_
if (qrCode.startsWith("ATTENDANCE_")) {
  console.log('✓ QR code starts with ATTENDANCE_');
  
  // Parse format: "ATTENDANCE_Test_Subject_1234_2025-08-05"
  const attendanceInfo = qrCode.replace("ATTENDANCE_", "").trim();
  const parts = attendanceInfo.split('_');
  
  console.log('Parts after splitting:', parts);
  
  if (parts.length >= 3) {
    const date = parts[parts.length - 1];
    const subjectCode = parts[parts.length - 2];
    const subjectName = parts.slice(0, -2).join(' ').replace(/_/g, ' ');
    
    console.log('Subject Name:', subjectName.trim());
    console.log('Subject Code:', subjectCode.trim());
    console.log('Date:', date.trim());
    console.log('SUCCESS: ATTENDANCE_ QR code parsed correctly!');
  } else {
    console.log('ERROR: Invalid ATTENDANCE_ QR code format - not enough parts');
  }
} else {
  console.log('ERROR: QR code does not start with ATTENDANCE_');
} 