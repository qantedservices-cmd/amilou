const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.readFile(path.join(__dirname, '..', 'docs', 'Suivi_Cours_Montmagny.xlsx'));

// Read "Suivi Famille Commentaires" sheet
const sheet = wb.Sheets['Suivi Famille Commentaires'];
if (!sheet) {
  console.log('Feuille non trouvée');
  process.exit(1);
}

const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
console.log('=== Suivi Famille Commentaires ===');
console.log('Lignes:', data.length);
for (let i = 0; i < Math.min(data.length, 3); i++) {
  console.log('Row', i, ':', JSON.stringify(data[i]));
}

// Show all non-empty rows
console.log('\n=== Contenu complet ===');
for (let i = 0; i < data.length; i++) {
  const row = data[i];
  if (row.some(cell => cell !== '')) {
    const display = row.map((c, j) => {
      const s = String(c);
      return s.length > 50 ? s.substring(0, 50) + '...' : s;
    }).filter(s => s !== '').join(' | ');
    console.log('Row', i, ':', display);
  }
}

// Also check "Suivi Sécances" sheet
console.log('\n\n=== Suivi Sécances ===');
const seanceSheet = wb.Sheets['Suivi Sécances'];
if (seanceSheet) {
  const seanceData = XLSX.utils.sheet_to_json(seanceSheet, { header: 1, defval: '' });
  console.log('Lignes:', seanceData.length);
  for (let i = 0; i < Math.min(seanceData.length, 5); i++) {
    console.log('Row', i, ':', JSON.stringify(seanceData[i]));
  }
  // Show rows mentioning Feb or S5
  console.log('\n--- Recherche séances récentes ---');
  for (let i = 0; i < seanceData.length; i++) {
    const row = seanceData[i];
    const rowStr = row.join(' ');
    if (rowStr.includes('S5') || rowStr.includes('Famille') || rowStr.includes('fév') || rowStr.includes('Feb')) {
      console.log('Row', i, ':', row.slice(0, 10).map(c => String(c).substring(0, 30)).join(' | '));
    }
  }
}
