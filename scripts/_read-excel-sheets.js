const XLSX = require('xlsx');
const path = require('path');

const EXCEL_FILE = path.join(__dirname, '../docs/Suivi cours de coran.xlsx');
const workbook = XLSX.readFile(EXCEL_FILE);

// Check Avancement 2025, Avancement 2026, Bilan de séance
for (const sheetName of ['Avancement 2025', 'Avancement 2026', 'Bilan de séance']) {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.log(`\n=== ${sheetName}: NON TROUVÉE ===`);
    continue;
  }

  const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  console.log(`\n=== ${sheetName}: ${data.length} lignes ===`);

  if (data.length > 0) {
    console.log('Colonnes:', Object.keys(data[0]).join(', '));
    // Show first 3 and last 5 rows
    console.log('\nPremières lignes:');
    for (let i = 0; i < Math.min(3, data.length); i++) {
      console.log(`  Row ${i}:`, JSON.stringify(data[i]).substring(0, 250));
    }
    console.log('\nDernières lignes:');
    for (let i = Math.max(0, data.length - 5); i < data.length; i++) {
      console.log(`  Row ${i}:`, JSON.stringify(data[i]).substring(0, 250));
    }
  }
}

// Also check the raw range of Avancement 2026 to understand structure
const sheet2026 = workbook.Sheets['Avancement 2026'];
if (sheet2026) {
  console.log('\n=== Avancement 2026 - Structure brute ===');
  console.log('Range:', sheet2026['!ref']);
  // Read first few cells
  for (let c = 0; c < 20; c++) {
    const col = String.fromCharCode(65 + c);
    const cell1 = sheet2026[`${col}1`];
    const cell2 = sheet2026[`${col}2`];
    if (cell1 || cell2) {
      console.log(`  ${col}1: ${cell1?.v || '-'} | ${col}2: ${cell2?.v || '-'}`);
    }
  }
}
