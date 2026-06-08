const XLSX = require('xlsx');
const path = require('path');

const EXCEL_FILE = path.join(__dirname, '../docs/Suivi cours de coran.xlsx');
const workbook = XLSX.readFile(EXCEL_FILE);

const sheet = workbook.Sheets['Bilan de séance'];
if (!sheet) {
  console.log('Sheet not found');
  process.exit(1);
}

// Decode all header dates (row 0 = dates as serial numbers)
const range = XLSX.utils.decode_range(sheet['!ref']);
console.log('Range:', sheet['!ref']);
console.log('\n=== En-têtes (dates des séances) ===');

const headerDates = {};
for (let c = range.s.c; c <= range.e.c; c++) {
  const cell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
  if (cell && typeof cell.v === 'number') {
    // Excel serial date to JS date
    const jsDate = new Date((cell.v - 25569) * 86400 * 1000);
    const dateStr = jsDate.toISOString().split('T')[0];
    const colLetter = XLSX.utils.encode_col(c);
    headerDates[colLetter] = dateStr;
    console.log(`  Col ${colLetter}: ${cell.v} → ${dateStr}`);
  }
}

// Now read each student row with all columns
console.log('\n=== Données par étudiant (dernières colonnes non-vides) ===');
for (let r = 1; r <= 6; r++) {
  const nameCell = sheet[XLSX.utils.encode_cell({ r, c: 2 })]; // Column C = name
  if (!nameCell || !nameCell.v) continue;
  const name = nameCell.v;

  // Find last non-empty column for this student
  let lastCol = null;
  let lastDate = null;
  let lastValue = null;
  for (let c = range.e.c; c >= 3; c--) { // Start from right
    const cell = sheet[XLSX.utils.encode_cell({ r, c })];
    if (cell && cell.v && cell.v.toString().trim()) {
      lastCol = XLSX.utils.encode_col(c);
      lastValue = cell.v;
      // Find corresponding date from row 0
      const headerCell = sheet[XLSX.utils.encode_cell({ r: 0, c })];
      if (headerCell && typeof headerCell.v === 'number') {
        lastDate = new Date((headerCell.v - 25569) * 86400 * 1000).toISOString().split('T')[0];
      }
      break;
    }
  }

  // Count non-empty data cells
  let dataCount = 0;
  for (let c = 3; c <= range.e.c; c++) {
    const cell = sheet[XLSX.utils.encode_cell({ r, c })];
    if (cell && cell.v && cell.v.toString().trim() && cell.v !== 'Abs') {
      dataCount++;
    }
  }

  console.log(`  ${name.padEnd(20)} | Dernière col: ${lastCol || '-'} | Date: ${lastDate || '-'} | Valeur: "${(lastValue || '').toString().substring(0, 50)}" | ${dataCount} séances`);
}

// Check Form Responses for most recent entries
console.log('\n\n=== Form Responses - Dernières 15 entrées ===');
const formSheet = workbook.Sheets['Form Responses'];
const formData = XLSX.utils.sheet_to_json(formSheet);
const last15 = formData.slice(-15);
for (const row of last15) {
  console.log(`  ${row['Année']} S${String(row['Semaine']).padStart(2)} | ${(row['Qui'] || '?').padEnd(20)} | ${row['Type de suivi']} ${row['Sourate'] ? '| ' + row['Sourate'].substring(0, 30) : ''}`);
}
