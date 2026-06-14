const fs = require('fs');
let c = fs.readFileSync('pyq_data.js', 'utf8');
const start = c.indexOf('const pyqEssayData');
let section = c.slice(start);

// Replace { year: 2023, q: "..." } with { year: "2023", question: "..." }
section = section.replace(/\{ year: (\d+), q: /g, (m, yr) => {
    return '{ year: "' + yr + '", question: ';
});

c = c.slice(0, start) + section;
fs.writeFileSync('pyq_data.js', c, 'utf8');

// Verify
const fn = new Function(c + '; return pyqEssayData[0].questions[0]');
console.log(fn());
