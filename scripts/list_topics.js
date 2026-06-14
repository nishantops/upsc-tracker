const fs = require('fs');
const c = fs.readFileSync('pyq_data.js', 'utf8');
const fn = new Function(c + '; return { gs1: pyqMainsGS1Data, gs2: pyqMainsGS2Data, gs3: pyqMainsGS3Data, gs4: pyqMainsGS4Data }');
const d = fn();

console.log('=== GS1 Topics ===');
d.gs1.forEach(t => console.log(`  ${t.topic} (${t.questions.length}Q)`));
console.log(`  TOTAL: ${d.gs1.reduce((s,t) => s + t.questions.length, 0)}Q\n`);

console.log('=== GS2 Topics ===');
d.gs2.forEach(t => console.log(`  ${t.topic} (${t.questions.length}Q)`));
console.log(`  TOTAL: ${d.gs2.reduce((s,t) => s + t.questions.length, 0)}Q\n`);

console.log('=== GS3 Topics ===');
d.gs3.forEach(t => console.log(`  ${t.topic} (${t.questions.length}Q)`));
console.log(`  TOTAL: ${d.gs3.reduce((s,t) => s + t.questions.length, 0)}Q\n`);

console.log('=== GS4 Topics ===');
d.gs4.forEach(t => console.log(`  ${t.topic} (${t.questions.length}Q)`));
console.log(`  TOTAL: ${d.gs4.reduce((s,t) => s + t.questions.length, 0)}Q\n`);
