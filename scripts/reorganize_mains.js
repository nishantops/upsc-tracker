/**
 * Reorganize Mains PYQ data with proper UPSC syllabus topic names.
 * Topics are based on the Vishnu IAS "13 Years" PDF structure which follows
 * the official UPSC syllabus headings.
 * 
 * Questions from both sources (Unacademy + 13 Years) are mapped into these 
 * proper topics using keyword matching.
 */

const fs = require('fs');

// Read current data
const content = fs.readFileSync('pyq_data.js', 'utf8');
const fn = new Function(content + '; return { gs1: pyqMainsGS1Data, gs2: pyqMainsGS2Data, gs3: pyqMainsGS3Data, gs4: pyqMainsGS4Data }');
const data = fn();

// === PROPER UPSC SYLLABUS TOPICS ===

const GS1_TOPICS = [
    "Art & Culture",
    "Modern Indian History & Freedom Struggle",
    "Post-Independence India",
    "World History",
    "Indian Society: Diversity & Social Issues",
    "Role of Women & Women's Organizations",
    "Poverty, Population & Development",
    "Urbanization",
    "Globalization & Its Effects",
    "Physical Geography & Climate",
    "Resource Distribution",
    "Industrial Location Factors"
];

const GS2_TOPICS = [
    "Indian Constitution: Features & Amendments",
    "Separation of Powers & Dispute Redressal",
    "Parliament, State Legislatures & Elections",
    "Executive & Judiciary",
    "Constitutional & Statutory Bodies",
    "Federal Structure & Devolution",
    "Government Policies & Interventions",
    "Welfare Schemes & Social Sector",
    "Governance, Transparency & Accountability",
    "Pressure Groups & Civil Society",
    "India's Neighbours & Bilateral Relations",
    "International Relations & Organizations"
];

const GS3_TOPICS = [
    "Indian Economy: Growth & Development",
    "Government Budgeting & Fiscal Policy",
    "Inclusive Growth & Employment",
    "Infrastructure & Investment Models",
    "Agriculture: Cropping & Irrigation",
    "Food Processing & Supply Chain",
    "MSP, PDS & Food Security",
    "Land Reforms & Liberalization",
    "Science & Technology: Developments",
    "Indigenization & S&T Achievements",
    "Environment & Biodiversity Conservation",
    "Disaster Management",
    "Internal Security & Extremism",
    "Border Management & Security Forces",
    "Cyber Security & Money Laundering"
];

const GS4_TOPICS = [
    "Ethics & Human Values",
    "Attitude & Aptitude",
    "Emotional Intelligence",
    "Thinkers & Philosophies",
    "Public Administration Ethics",
    "Integrity & Probity in Governance",
    "Case Studies: Conflict of Interest",
    "Case Studies: Administrative Ethics",
    "Case Studies: Corruption & Accountability"
];

// === KEYWORD-BASED CLASSIFICATION ===

function classifyGS1(q) {
    const t = (q.question || '').toLowerCase();
    if (/art|culture|architecture|temple|sculpture|painting|music|dance|literature|bhakti|sufi|mughal|gupta|chola|vijayanag|pallav|chalukya|maurya|gandhara|numismat|heritage/.test(t)) return 0;
    if (/freedom|independence|revolt|gandhi|nehru|congress|swadeshi|quit india|civil disobedience|moderate|extremist|reform|colonial|british|1857|19th century|nationalist|subhas|tilak|gokhale|partition|artisan|colonial/.test(t)) return 1;
    if (/post.?independence|consolidation|reorgani[sz]ation|integration|nehruvian|five year plan|non.?alignment|panchsheel|green revolution/.test(t)) return 2;
    if (/world war|french revolution|industrial revolution|american|russian revolution|colonialism|decoloni|communism|capitalism|socialism|fascism|cold war|unification|napoleon/.test(t)) return 3;
    if (/communalism|regionalism|secularism|caste|tribe|diversity|social|empowerment|linguistic|ethnic|salient features.*society/.test(t)) return 4;
    if (/women|gender|feminist|female|girl|maternal|dowry|empowerment of women/.test(t)) return 5;
    if (/poverty|population|development|demographic|hunger|malnutrition|hdi/.test(t)) return 6;
    if (/urban|city|cities|smart city|rural.?urban|migration|slum|metropolitan/.test(t)) return 7;
    if (/globali[sz]ation|mne|multinational|fdi|wto|liberali[sz]ation effect on society/.test(t)) return 8;
    if (/climate|earthquake|tsunami|cyclone|flood|drought|volcano|monsoon|ocean|geomorpholog|geograph|el nino|weather|physical geography|landform/.test(t)) return 9;
    if (/resource|mineral|water resource|energy resource|soil|forest resource/.test(t)) return 10;
    if (/industr.*location|primary sector|secondary sector|tertiary sector|factor.*location|industrial location/.test(t)) return 11;
    // Fallbacks based on old topic names
    return 4; // default to society
}

function classifyGS2(q) {
    const t = (q.question || '').toLowerCase();
    if (/constitution|fundamental right|dpsp|basic structure|amendment|preamble|right to|article|constitutional provision|federal|quasi.?federal/.test(t)) return 0;
    if (/separation of power|check.*balance|judicial review|dispute redressal|tribunal|judicial activism/.test(t)) return 1;
    if (/parliament|lok sabha|rajya sabha|legislature|election|evm|representation|anti.?defection|speaker|bill|legislative|state legislature/.test(t)) return 2;
    if (/executive|judiciary|supreme court|high court|governor|president|prime minister|council of minister|cabinet|ordinance|judicial appointment|collegium|attorney general/.test(t)) return 3;
    if (/statutory|regulatory|quasi.?judicial|upsc|election commission|cag|finance commission|niti|planning commission|nhrc|ncw|ncsc|ncst|cic/.test(t)) return 4;
    if (/federal|union.?state|inter.?state|local.*bod|panchayat|municipal|devolution|73rd|74th|cooperative federalism|centre.?state/.test(t)) return 5;
    if (/polic|intervention|development.*sector|scheme|programme|welfare.*polic|government.*polic|implementation/.test(t)) return 6;
    if (/welfare|poverty|hunger|health|education|nutrition|food security|vulnerable|child|adolescent|disabled|senior citizen|social security|mid.?day meal/.test(t)) return 7;
    if (/governance|transparency|accountab|e.?governance|citizen.*charter|rtl|rti|corruption|lokpal|ombudsman|whistleblower/.test(t)) return 8;
    if (/pressure group|ngo|shg|self.?help|civil society|civil service|ias|media|association/.test(t)) return 9;
    if (/neighbour|pakistan|china|sri lanka|bangladesh|nepal|myanmar|bhutan|afghanistan|indo.?pacific|bilateral|border.*relation/.test(t)) return 10;
    if (/international|united nations|wto|imf|world bank|multilateral|asean|saarc|brics|g20|foreign policy|diaspora|global|treaty|agreement/.test(t)) return 11;
    return 6; // default to policies
}

function classifyGS3(q) {
    const t = (q.question || '').toLowerCase();
    // Order matters - more specific patterns first
    if (/cyber|social media|communication network|money laundering|organised crime|hawala|terror finance|digital signature|social networking site/.test(t)) return 14;
    if (/border|security force|bsf|crpf|army|paramilitary|coastguard|mandate.*securit|external.*actor|non.?state|maritime security|coastal security/.test(t)) return 13;
    if (/extremis|naxal|lwe|left.?wing|maoist|terrorism|insurgency|north.?east|separatis|radical|internal security/.test(t)) return 12;
    if (/disaster|flood.*manage|earthquake.*manage|cyclone.*manage|drought.*manage|disaster management|ndma|resilience|early warning|dam failure|sendai/.test(t)) return 11;
    if (/environment|pollution|biodiversity|climate change|conservation|forest|wildlife|wetland|coral|marine.*eco|emission|carbon|paris|cop26|cop27|eia|green.*tribunal|ipcc|ozone|waste management|plastic|river.*clean/.test(t)) return 10;
    if (/indigenous|indigeni[sz]|indian.*achievement|drdo|self.?relian|atmanirbhar|semiconductor|chip.*manufactur/.test(t)) return 9;
    if (/science|technology|it\b|space|isro|nano|bio.?tech|robot|artificial intelligence|\bai\b|drone|quantum|5g|iot|computer|innovation|research|patent|ipr|3d print|fdc|gmo|crispr|dna|genome|digital|internet of thing/.test(t)) return 8;
    if (/land reform|liberali[sz]ation|industrial policy|disinvest|privati[sz]ation|sez|fdi.*polic|wto.*trade|trade polic/.test(t)) return 7;
    if (/msp|pds|public distribution|food security|buffer stock|fci|essential commodit|subsid.*farm|procurement/.test(t)) return 6;
    if (/food process|cold chain|supply chain|agro.?process|fpo|value addition|food.*industr/.test(t)) return 5;
    if (/crop|irrigation|agriculture|farming|farmer|organic|green revolution|seed|fertilizer|kisan|horticultur|animal.?rear|fisheries|aquaculture/.test(t)) return 4;
    if (/infrastructure|investment model|ppp|public.?private|road|railway|airport|port|energy|power sector|smart city|logistics|electri|solar|wind.*energy|nuclear.*energy|coal|petroleum|mineral|groundwater|water.*resource|hydroelectric/.test(t)) return 3;
    if (/inclusive|employ|unemployment|poverty.*program|skill|mgnrega|make in india|startup|pli|production.?linked/.test(t)) return 2;
    if (/budget|fiscal|deficit|revenue|expenditure|frbm|finance commission|public debt|taxation/.test(t)) return 1;
    if (/growth|gdp|development model|economic.*reform|planning|mobilisation|niti aayog|five year plan|economic survey|gst|tax.*reform|demonetis|economy|trade|export|import|forex|inflation|banking|rbi|nbfc/.test(t)) return 0;
    return 0; // default to economy
}

function classifyGS4(q) {
    const t = (q.question || '').toLowerCase();
    if (/ethics|moral|value|virtue|conscience|dharma|right.*wrong|good.*evil|human value|ethical theory|deontolog|utilitar|categorical/.test(t)) return 0;
    if (/attitude|persuasion|cognitive|belief|opinion|behaviour change|social influence|aptitude|foundational value/.test(t)) return 1;
    if (/emotional intelligence|eq|empathy|self.?awareness|self.?regulation|motivation|social skill/.test(t)) return 2;
    if (/thinker|gandhi|ambedkar|kautilya|confucius|aristotle|plato|kant|rawls|singer|philosopher|chanakya/.test(t)) return 3;
    if (/public.*admin|civil.*serv|bureaucra|public service|code of conduct|code of ethics|public duty|public interest|public servant|dedication/.test(t)) return 4;
    if (/integrity|probity|impartial|non.?partisan|objectiv|transparen|accountab|diligence|commitment/.test(t)) return 5;
    if (/case.*stud|dilemma|scenario|situation|you are|suppose you|consider the following case|ethical issue.*faced/.test(t)) return 6;
    if (/corrupt|bribe|nepotism|favouritism|whistle.?blow|rti.*case|misuse.*power|conflict of interest/.test(t)) return 8;
    // If it seems like a case study (long text with scenario)
    if (t.length > 200 && /you |your |officer|situation|following|option/.test(t)) return 7;
    return 0; // default to ethics & values
}

// === REBUILD DATA ===

function rebuildSection(oldData, topics, classifier) {
    // Initialize new structure
    const newData = topics.map(name => ({ name, questions: [] }));
    
    // Classify all questions from all old topics
    for (const oldTopic of oldData) {
        for (const q of oldTopic.questions) {
            const idx = classifier(q);
            newData[idx].questions.push(q);
        }
    }
    
    // Sort questions within each topic by year (descending)
    for (const topic of newData) {
        topic.questions.sort((a, b) => {
            const ya = parseInt(a.year) || 0;
            const yb = parseInt(b.year) || 0;
            return yb - ya;
        });
    }
    
    // Remove empty topics
    return newData.filter(t => t.questions.length > 0);
}

const newGS1 = rebuildSection(data.gs1, GS1_TOPICS, classifyGS1);
const newGS2 = rebuildSection(data.gs2, GS2_TOPICS, classifyGS2);
const newGS3 = rebuildSection(data.gs3, GS3_TOPICS, classifyGS3);
const newGS4 = rebuildSection(data.gs4, GS4_TOPICS, classifyGS4);

console.log('=== GS1 Topics ===');
newGS1.forEach(t => console.log(`  ${t.name} (${t.questions.length}Q)`));
console.log(`  TOTAL: ${newGS1.reduce((s,t) => s + t.questions.length, 0)}Q\n`);

console.log('=== GS2 Topics ===');
newGS2.forEach(t => console.log(`  ${t.name} (${t.questions.length}Q)`));
console.log(`  TOTAL: ${newGS2.reduce((s,t) => s + t.questions.length, 0)}Q\n`);

console.log('=== GS3 Topics ===');
newGS3.forEach(t => console.log(`  ${t.name} (${t.questions.length}Q)`));
console.log(`  TOTAL: ${newGS3.reduce((s,t) => s + t.questions.length, 0)}Q\n`);

console.log('=== GS4 Topics ===');
newGS4.forEach(t => console.log(`  ${t.name} (${t.questions.length}Q)`));
console.log(`  TOTAL: ${newGS4.reduce((s,t) => s + t.questions.length, 0)}Q\n`);

// === WRITE BACK TO FILE ===
// Replace only the Mains GS1-4 sections in pyq_data.js

let fileContent = fs.readFileSync('pyq_data.js', 'utf8');

function toJS(data) {
    return JSON.stringify(data, null, 2)
        .replace(/"name":/g, 'name:')
        .replace(/"questions":/g, 'questions:')
        .replace(/"question":/g, 'question:')
        .replace(/"year":/g, 'year:')
        .replace(/"marks":/g, 'marks:')
        .replace(/"number":/g, 'number:')
        // Keep strings as double-quoted (they already are from JSON.stringify)
        ;
}

// Find and replace each section
const sections = [
    { name: 'pyqMainsGS1Data', data: newGS1 },
    { name: 'pyqMainsGS2Data', data: newGS2 },
    { name: 'pyqMainsGS3Data', data: newGS3 },
    { name: 'pyqMainsGS4Data', data: newGS4 },
];

for (const sec of sections) {
    const startMarker = `const ${sec.name} = `;
    const startIdx = fileContent.indexOf(startMarker);
    if (startIdx === -1) {
        console.error(`Could not find ${sec.name}!`);
        continue;
    }
    // Find the end of the array (matching ];)
    let depth = 0;
    let endIdx = startIdx + startMarker.length;
    for (let i = endIdx; i < fileContent.length; i++) {
        if (fileContent[i] === '[') depth++;
        if (fileContent[i] === ']') {
            depth--;
            if (depth === 0) {
                endIdx = i + 2; // +2 for ]; 
                break;
            }
        }
    }
    const replacement = `const ${sec.name} = ${toJS(sec.data)};`;
    fileContent = fileContent.slice(0, startIdx) + replacement + fileContent.slice(endIdx);
}

fs.writeFileSync('pyq_data.js', fileContent, 'utf8');
console.log('Written reorganized data to pyq_data.js');

// Validate
try {
    new Function(fileContent);
    console.log('JS syntax: VALID');
} catch(e) {
    console.log('JS syntax ERROR:', e.message.slice(0, 200));
}
