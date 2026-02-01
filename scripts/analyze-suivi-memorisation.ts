/**
 * Analyze the "Suivi Mémorisation" sheet structure
 *
 * Run with: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/analyze-suivi-memorisation.ts
 */

import * as XLSX from 'xlsx';
import * as path from 'path';

const excelPath = path.join(__dirname, '..', 'docs', 'Suivi_Cours_Montmagny.xlsx');
const workbook = XLSX.readFile(excelPath);

console.log('📊 Available sheets:', workbook.SheetNames);

const sheet = workbook.Sheets['Suivi Mémorisation'];
if (!sheet) {
  console.log('❌ Sheet "Suivi Mémorisation" not found');
  process.exit(1);
}

const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

console.log('\n📋 First 5 rows (header + data):');
for (let i = 0; i < Math.min(5, data.length); i++) {
  console.log(`Row ${i}:`, data[i]?.slice(0, 20));
}

console.log('\n📋 Row 0 (likely student names):');
console.log(data[0]);

console.log('\n📋 Column A (likely surah names):');
for (let i = 0; i < Math.min(40, data.length); i++) {
  if (data[i]?.[0]) {
    console.log(`  ${i}: ${data[i][0]}`);
  }
}

console.log('\n📋 Sample data cells (rows 1-5, cols 1-5):');
for (let i = 1; i < Math.min(6, data.length); i++) {
  const row = data[i];
  if (row) {
    console.log(`  Row ${i}: ${row.slice(1, 6).map(c => c || '-').join(' | ')}`);
  }
}

// Find unique status codes in student columns (8 onwards)
const codes = new Set<string>();
const STUDENT_START_COL = 8;

for (let i = 1; i < data.length; i++) {
  for (let j = STUDENT_START_COL; j < (data[i]?.length || 0); j++) {
    const cell = data[i][j];
    if (cell && typeof cell === 'string') {
      codes.add(cell);
    }
  }
}

console.log('\n📋 Unique status codes found in student columns:');
console.log([...codes].sort());

// Show some sample data for students
console.log('\n📋 Sample student data (first 10 surahs from end, cols 8-11):');
const lastSurahIndex = data.length - 1;
for (let i = Math.max(1, lastSurahIndex - 10); i <= lastSurahIndex; i++) {
  const row = data[i];
  if (row && row[0]) {
    const surahNum = row[1];
    const studentCells = row.slice(STUDENT_START_COL, STUDENT_START_COL + 4);
    console.log(`  Surah ${surahNum}: ${studentCells.map(c => c || '-').join(' | ')}`);
  }
}
