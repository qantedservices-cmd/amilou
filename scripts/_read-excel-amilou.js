const XLSX = require('xlsx');
const path = require('path');

const EXCEL_FILE = path.join(__dirname, '../docs/Suivi cours de coran.xlsx');
const workbook = XLSX.readFile(EXCEL_FILE);

console.log('=== Feuilles disponibles ===');
console.log(workbook.SheetNames);

const formSheet = workbook.Sheets['Form Responses'];
if (!formSheet) {
  console.log('Feuille "Form Responses" non trouvée!');
  // Try other sheets
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet, { range: 0 });
    console.log(`\nFeuille "${name}" - ${data.length} lignes`);
    if (data.length > 0) {
      console.log('Colonnes:', Object.keys(data[0]).join(', '));
      console.log('Première ligne:', JSON.stringify(data[0]).substring(0, 200));
    }
  }
} else {
  const formData = XLSX.utils.sheet_to_json(formSheet);
  console.log(`\nForm Responses: ${formData.length} lignes`);
  if (formData.length > 0) {
    console.log('Colonnes:', Object.keys(formData[0]).join(', '));
  }

  // Filter Mohamed B. entries
  const mohamedEntries = formData.filter(r => r['Qui'] === 'Mohamed B.');
  console.log(`\nMohamed B.: ${mohamedEntries.length} entrées`);

  // Get last 10
  const last10 = mohamedEntries.slice(-10);
  for (const row of last10) {
    const type = row['Type de suivi'];
    const year = row['Année'];
    const week = row['Semaine'];
    if (type === 'Avancement Mémorisation') {
      console.log(`  ${year} S${week} - ${type} - Sourate: ${row['Sourate']} v${row['Verset début']}-${row['Verset fin']}`);
    } else {
      console.log(`  ${year} S${week} - ${type}`);
    }
  }

  // Check all users and their latest week
  console.log('\n=== Dernière entrée par utilisateur ===');
  const users = [...new Set(formData.map(r => r['Qui']))];
  for (const user of users) {
    const entries = formData.filter(r => r['Qui'] === user);
    const lastEntry = entries[entries.length - 1];
    const progressEntries = entries.filter(r => r['Type de suivi'] === 'Avancement Mémorisation');
    const lastProgress = progressEntries.length > 0 ? progressEntries[progressEntries.length - 1] : null;
    console.log(`  ${(user || '?').padEnd(20)} | ${entries.length} entrées | Dernière: ${lastEntry?.Année} S${lastEntry?.Semaine} (${lastEntry?.['Type de suivi']}) | Dernier avancement: ${lastProgress ? `${lastProgress.Année} S${lastProgress.Semaine}` : '-'}`);
  }
}
