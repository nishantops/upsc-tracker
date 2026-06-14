const fs = require('fs');
const { execSync } = require('child_process');

// Revert pyq_data.js to last committed clean version
console.log('Reverting pyq_data.js to last committed version...');
execSync('git checkout HEAD -- pyq_data.js');

let content = fs.readFileSync('pyq_data.js', 'utf8');
console.log('Reverted. File size:', content.length);

let count = 0;

// Encoding fixes - safe characters (apostrophe safe inside double-quoted JS strings)
const replacements = [
    ['Ã¢â‚¬â„¢', "'"],
    ['Ã¢â‚¬Ëœ', "'"],
    ['Ã¢â‚¬â€œ', '-'],
    ['Ã¢â‚¬â€"', '-'],
    ['Ã¢â‚¬Â¦', '...'],
    ['Ã©', 'e'],
    ['Ã¨', 'e'],
    ['Ã¢â‚¬Å"', '\\"'],
    ['Ã¢â‚¬\u009d', '\\"'],
    ['Ã¢â‚¬Â', ''],
    ['Ã¢', ''],
    ['Â¦', ''],
    ['Â', ''],
];

for (const [bad, good] of replacements) {
    const escaped = bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const matches = content.match(regex);
    if (matches) {
        count += matches.length;
        content = content.replace(regex, good);
    }
}

// Second pass
const pass2 = [
    ['â€™', "'"],
    ['â€˜', "'"],
    ['â€œ', '\\"'],
    ['â€\u009d', '\\"'],
    ['â€"', '-'],
];

for (const [bad, good] of pass2) {
    const escaped = bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    const matches = content.match(regex);
    if (matches) {
        count += matches.length;
        content = content.replace(regex, good);
    }
}

fs.writeFileSync('pyq_data.js', content, 'utf8');
console.log(`Applied ${count} encoding fixes`);

// Validate
try {
    new Function(content);
    console.log('JS syntax: VALID');
} catch(e) {
    console.log('JS syntax ERROR:', e.message.slice(0, 300));
}
