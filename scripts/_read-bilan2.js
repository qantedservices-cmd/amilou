const XLSX = require('xlsx');
const path = require('path');

const EXCEL_FILE = path.join(__dirname, '../docs/Suivi cours de coran.xlsx');
const workbook = XLSX.readFile(EXCEL_FILE);

// Read raw Bilan de séance
const sheet = workbook.Sheets['Bilan de séance'];
const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

// Row 0 = dates (serial numbers), Row 1+ = student data
const dateRow = data[0];
const colNames = Object.keys(dateRow);

// Decode dates from serial numbers
console.log('=== Dates des séances ===');
const sessionDates = {};
for (const col of colNames) {
  const val = dateRow[col];
  if (typeof val === 'number' && val > 40000) {
    const jsDate = new Date(Math.round((val - 25569) * 86400 * 1000));
    sessionDates[col] = jsDate.toISOString().split('T')[0];
  }
}

// Sort by date and print
const sortedCols = Object.entries(sessionDates).sort((a, b) => a[1].localeCompare(b[1]));
for (const [col, date] of sortedCols) {
  console.log(`  ${col.padEnd(10)} → ${date}`);
}

// For each student row, find last non-empty session
console.log('\n=== Dernière activité par étudiant (Bilan de séance) ===');
for (let i = 1; i < data.length; i++) {
  const row = data[i];
  const name = String(row['Bilan de séance'] || '').trim();
  if (!name) continue;

  // Check all session columns (right to left) to find last activity
  let lastCol = null;
  let lastDate = null;
  let lastVal = null;
  for (let j = sortedCols.length - 1; j >= 0; j--) {
    const [col, date] = sortedCols[j];
    const val = String(row[col] || '').trim();
    if (val && val.toLowerCase() !== 'abs' && val !== '') {
      lastCol = col;
      lastDate = date;
      lastVal = val;
      break;
    }
  }

  console.log(`  ${name.padEnd(20)} | Dernière séance: ${lastDate || 'AUCUNE'} | "${(lastVal || '').substring(0, 60)}"`);
}
