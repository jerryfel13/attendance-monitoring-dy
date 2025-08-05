// Test QR code parsing logic
const qrCode = "ATTENDANCE:Test Subject 1001234 - 2025-07-29";

console.log('Testing QR code:', qrCode);

// Parse format: "Test Subject 1001234 - 2025-07-29" or "Data Structures (CS201) - 2024-01-15"
let match = qrCode.replace("ATTENDANCE:", "").trim().match(/^(.+?)\s*\(([^)]+)\)\s*-\s*(.+)$/);
let subjectName, subjectCode, date;

if (match) {
  // Format with parentheses: "Data Structures (CS201) - 2024-01-15"
  [, subjectName, subjectCode, date] = match;
  console.log('Parsed with parentheses format');
} else {
  // Format without parentheses: "Test Subject 1001234 - 2025-07-29"
  match = qrCode.replace("ATTENDANCE:", "").trim().match(/^(.+?)\s+(\d+)\s*-\s*(.+)$/);
  if (!match) {
    console.log('ERROR: Invalid attendance QR code format');
    process.exit(1);
  }
  [, subjectName, subjectCode, date] = match;
  console.log('Parsed with number format');
}

console.log('Subject Name:', subjectName.trim());
console.log('Subject Code:', subjectCode.trim());
console.log('Date:', date.trim());
console.log('SUCCESS: QR code parsed correctly!'); 