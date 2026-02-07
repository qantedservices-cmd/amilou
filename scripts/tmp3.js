const XLSX = require('xlsx');
const workbook = XLSX.readFile('./docs/Suivi_Cours_Montmagny.xlsx');
const sheet = workbook.Sheets['Suivi Mémorisation'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log('=== En-têtes (colonnes) ===');
console.log(data[0]);
console.log('\n=== Premières lignes ===');
for (let i = 1; i < 5; i++) {
  console.log('Row', i, ':', data[i]?.slice(0, 10));
}
