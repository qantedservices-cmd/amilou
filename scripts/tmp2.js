const XLSX = require('xlsx');
const workbook = XLSX.readFile('./docs/Suivi_Cours_Montmagny.xlsx');
console.log('Sheets:', workbook.SheetNames);
workbook.SheetNames.forEach(name => {
  const sheet = workbook.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(name + ': ' + data.length + ' rows, first row:', data[0]?.slice(0,5));
});
