const fs = require('fs');
let c = fs.readFileSync('pyq_data.js', 'utf8');

const start = c.indexOf('const pyqEssayData');
const fn = new Function(c + '; return pyqEssayData');
const data = fn();

// Add number field to each question (sequential per topic)
data.forEach(topic => {
    topic.questions.forEach((q, i) => {
        q.number = String(i + 1);
    });
});

// Rebuild the Essay section
const jsStr = 'const pyqEssayData = ' + JSON.stringify(data, null, 2) + ';';

// Find end of pyqEssayData in file
let endIdx = start;
let depth = 0;
const searchStart = start + 'const pyqEssayData = '.length;
for (let i = searchStart; i < c.length; i++) {
    if (c[i] === '[') depth++;
    if (c[i] === ']') {
        depth--;
        if (depth === 0) {
            endIdx = i + 2; // ];
            break;
        }
    }
}

c = c.slice(0, start) + jsStr + c.slice(endIdx);
fs.writeFileSync('pyq_data.js', c, 'utf8');

// Validate
try {
    new Function(c);
    console.log('OK - Added number field to all Essay questions');
} catch(e) {
    console.log('ERROR:', e.message.slice(0, 200));
}
