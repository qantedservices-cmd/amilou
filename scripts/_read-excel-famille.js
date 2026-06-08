const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.readFile(path.join(__dirname, '..', 'docs', 'Suivi_Cours_Montmagny.xlsx'));

console.log('=== Feuilles disponibles ===');
console.log(wb.SheetNames);

// Read "Suivi Famille" sheet
const famSheet = wb.Sheets['Suivi Famille'];
if (!famSheet) {
  console.log('Feuille "Suivi Famille" non trouvée');
  process.exit(1);
}

const data = XLSX.utils.sheet_to_json(famSheet, { header: 1, defval: '' });
console.log('\n=== Suivi Famille — Premières lignes ===');
for (let i = 0; i < Math.min(data.length, 5); i++) {
  console.log('Row', i, ':', JSON.stringify(data[i]));
}

console.log('\n=== Toutes les données (colonnes A-F) ===');
for (let i = 0; i < data.length; i++) {
  const row = data[i];
  if (row.some(cell => cell !== '')) {
    console.log('Row', i, ':', row.slice(0, 8).map(c => String(c).substring(0, 40)).join(' | '));
  }
}

// Also check Suivi Mémorisation sheet for comparison
const memSheet = wb.Sheets['Suivi Mémorisation'];
if (memSheet) {
  const memData = XLSX.utils.sheet_to_json(memSheet, { header: 1, defval: '' });
  console.log('\n=== Suivi Mémorisation — Premières lignes ===');
  for (let i = 0; i < Math.min(memData.length, 5); i++) {
    console.log('Row', i, ':', JSON.stringify(memData[i]));
  }
}
