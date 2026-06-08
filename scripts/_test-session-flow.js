// Test: verify the dialog opens with correct session number in all scenarios
// Simulates the frontend logic

const totalSessions = 14;
const nextSessionNumber = 15;

function openSessionReportDialog(targetSessionNum) {
  const targetNum = targetSessionNum ?? totalSessions;
  // This is what gets sent to the API: ?sessionNumber=targetNum
  return targetNum;
}

console.log('=== Test openSessionReportDialog logic ===');

// 1. "Rapport séance" header button (no arg)
let result = openSessionReportDialog();
console.log('Header button (no arg): targetNum=' + result + ' → should be 14 (latest). ' + (result === 14 ? 'OK' : 'FAIL'));

// 2. "Voir séance" with activeSession="14" (existing)
const activeSession14 = '14';
result = openSessionReportDialog(Math.min(parseInt(activeSession14) || totalSessions, totalSessions));
console.log('Voir séance, active=14: targetNum=' + result + ' → should be 14. ' + (result === 14 ? 'OK' : 'FAIL'));

// 3. "Voir séance" with activeSession="10" (existing)
const activeSession10 = '10';
result = openSessionReportDialog(Math.min(parseInt(activeSession10) || totalSessions, totalSessions));
console.log('Voir séance, active=10: targetNum=' + result + ' → should be 10. ' + (result === 10 ? 'OK' : 'FAIL'));

// 4. "Voir séance" with activeSession="15" (new session, doesn't exist)
const activeSession15 = '15';
result = openSessionReportDialog(Math.min(parseInt(activeSession15) || totalSessions, totalSessions));
console.log('Voir séance, active=15 (new): targetNum=' + result + ' → should be 14 (capped). ' + (result === 14 ? 'OK' : 'FAIL'));

// 5. Prev from S14
result = openSessionReportDialog(14 - 1);
console.log('Prev from S14: targetNum=' + result + ' → should be 13. ' + (result === 13 ? 'OK' : 'FAIL'));

// 6. Next from S13
result = openSessionReportDialog(13 + 1);
console.log('Next from S13: targetNum=' + result + ' → should be 14. ' + (result === 14 ? 'OK' : 'FAIL'));

// 7. Prev from S1
result = openSessionReportDialog(1 - 1);
console.log('Prev from S1 (edge): targetNum=' + result + ' → would be 0 but button disabled. ');

// 8. Navigation boundary checks
console.log('\n=== Navigation boundary checks ===');
for (const sn of [1, 7, 14]) {
  const prevDisabled = sn <= 1;
  const nextDisabled = sn >= totalSessions;
  console.log('S' + sn + ': prev=' + (prevDisabled ? 'disabled' : 'enabled') + ', next=' + (nextDisabled ? 'disabled' : 'enabled'));
}

console.log('\n=== All scenarios tested ===');
