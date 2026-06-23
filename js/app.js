// =========================================================================
// UPSC Tracker - App Core (Global State + Data + Initialization)
// =========================================================================

// CACHE MANAGEMENT — auto-reload on version change
(() => {
    const STORED_VER = localStorage.getItem('upsc_app_version');
    const CURRENT_VER = ENV.APP_VERSION;
    if (STORED_VER && STORED_VER !== CURRENT_VER) {
        localStorage.removeItem('upsc_app_version');
        if ('caches' in window) caches.keys().then(ks => ks.forEach(k => caches.delete(k)));
        localStorage.setItem('upsc_app_version', CURRENT_VER);
        location.reload(true);
        return;
    }
    if (!STORED_VER) localStorage.setItem('upsc_app_version', CURRENT_VER);
})();

// =========================================================================
// CONFIGURATION (from env.js)
// =========================================================================
const SUPABASE_URL = ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = ENV.SUPABASE_ANON_KEY;
const SUPERUSER_EMAIL = ENV.SUPERUSER_EMAIL;
const SUPERUSER_ALIAS = ENV.SUPERUSER_ALIAS;
const AUTO_LOGOUT_MS = ENV.AUTO_LOGOUT_MS;

// =========================================================================
// GLOBAL STATE
// =========================================================================
let dbClient = null;
let currentUserId = null;

// =========================================================================
// THEME SYSTEM
// =========================================================================
function toggleTheme() {
    const html  = document.documentElement;
    const next  = (html.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('upsc_theme', next);
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) icon.textContent = next === 'dark' ? '☀️' : '🌙';
}
function initTheme() {
    const saved = localStorage.getItem('upsc_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) icon.textContent = saved === 'dark' ? '☀️' : '🌙';
}
document.addEventListener('DOMContentLoaded', initTheme);

// =========================================================================
// SYLLABUS DATA ARRAYS
// =========================================================================
const dataP1 = ["Current Events: Current events of national and international importance.", "History of India and Indian National Movement: Social, economic, and political aspects of ancient, medieval, and modern Indian history; structural phases of the national freedom struggle.", "Indian and World Geography: Physical, social, and economic geography of India and the global domains.", "Indian Polity and Governance: Constitution, political system, Panchayati Raj, public policy, rights issues, statutory frameworks, and structural governance architectures.", "Economic and Social Development: Sustainable development, poverty inclusion dynamics, demographics, social sector initiatives, fiscal policies, and macroeconomic foundations.", "General Issues on Environmental Ecology, Bio-diversity, and Climate Change: Global environmental challenges, conservation paradigms, ecosystem parameters (that do not require specialized academic domain expertise).", "General Science: Foundational scientific vectors encompassing physics, chemistry, biology, and contemporary technological advancements."];
const dataP2 = ["Comprehension frameworks and contextual textual interpretation analytical streams.", "Interpersonal skills including comprehensive communication architectures.", "Logical reasoning and analytical capability domains.", "Decision-making mechanics and problem-solving scenarios.", "General mental ability parameters.", "Basic Numeracy: Numbers and their relations, orders of magnitude, etc. (Class X level data matrices).", "Data Interpretation: Charts, graphs, tables, data sufficiency profiles (Class X level presentation matrices)."];
const dataLA = ["One of the Indian languages to be selected by the candidate from the Languages included in the Eighth Schedule to the Constitution."];
const dataLB = ["English Language competence, text composition, precis mechanics, and general vocabulary expression."];
const dataES = ["Candidates shall be required to write essays on multiple topics. They will be expected to keep close to the subject of the essay to arrange their ideas in an orderly fashion and to write concisely. Credit will be given for effective and exact expression."];
const dataGS1 = ["Indian Culture shall cover the salient aspects of Art Forms, Literature and Architecture from Ancient to Modern times.", "Modern Indian History from about the middle of the eighteenth century until the present- significant events, personalities, issues.", "The Freedom Struggle its various stages and important contributors/contributions from different parts of the country.", "Post-independence consolidation and reorganization within the country.", "History of the World shall include events from 18th century such as Industrial Revolution, world wars, redrawal of national boundaries, colonization, decolonization, political philosophies like communism, capitalism, socialism etc. their forms and effect on the society.", "Salient features of Indian Society, Diversity of India.", "Role of women and women's organization, population and associated issues, poverty and developmental issues, urbanization, their problems and their remedies.", "Effects of globalization on Indian society.", "Social empowerment, communalism, regionalism & secularism.", "Salient features of world's physical geography.", "Distribution of key natural resources across the world (including South Asia and the Indian sub- continent).", "Important Geophysical phenomena such as earthquakes, Tsunami, Volcanic activity, cyclone etc., geographical features and their location-changes in critical geographical features (including water- bodies and ice-caps) and in flora and fauna and the effects of such changes."];
const dataGS2 = ["Indian Constitution-historical underpinnings, evolution, features, amendments, significant provisions and basic structure.", "Functions and responsibilities of the Union and the States, issues and challenges pertaining to the federal structure, devolution of powers and finances up to local levels and challenges therein.", "Separation of powers between various organs dispute redressal mechanisms and institutions.", "Comparison of the Indian constitutional scheme with that of other countries.", "Parliament and State Legislatures-structure, functioning, conduct of business, powers & privileges and issues arising out of these.", "Structure, organization and functioning of the Executive and the Judiciary-Ministries and Departments of the Government; pressure groups and formal/informal associations and their role in the Polity.", "Salient features of the Representation of People's Act.", "Appointment to various Constitutional posts, powers, functions and responsibilities of various Constitutional Bodies.", "Statutory, regulatory and various quasi-judicial bodies.", "Government policies and interventions for development in various sectors and issues arising out of their design and implementation.", "Development processes and the development industry-the role of NGOs, SHGs, various groups and associations, donors, charities, institutional and other stakeholders.", "Welfare schemes for vulnerable sections of the population by the Centre and States and the performance of these schemes.", "Issues relating to development and management of Social Sector/Services relating to Health, Education, Human Resources.", "Issues relating to poverty and hunger.", "Important aspects of governance, transparency and accountability, e-governance- applications, models, successes, limitations, and potential; citizens charters, transparency & accountability and institutional and other measures.", "Role of civil services in a democracy.", "India and its neighborhood- relations.", "Bilateral, regional and global groupings and agreements involving India and/or affecting India's interests.", "Effect of policies and politics of developed and developing countries on India's interests, Indian diaspora.", "Important International institutions, agencies and fora- their structure, mandate."];
const dataGS3 = ["Indian Economy and issues relating to planning, mobilization of resources, growth, development and employment.", "Inclusive growth and issues arising from it.", "Government Budgeting.", "Major crops-cropping patterns in various parts of the country, different types of irrigation and irrigation systems storage, transport and marketing of agricultural produce and issues and related constraints; e-technology in the aid of farmers.", "Issues related to direct and indirect farm subsidies and minimum support prices; Public Distribution System- objectives, functioning, limitations, revamping; issues of buffer stocks and food security; Technology missions; economics of animal-rearing.", "Food processing and related industries in India- scope and significance, location, upstream and downstream requirements, supply chain management.", "Land reforms in India.", "Effects of liberalization on the economy, changes in industrial policy and their effects on industrial growth.", "Infrastructure: Energy, Ports, Roads, Airports, Railways etc.", "Investment models.", "Science and Technology- developments and their applications and effects in everyday life.", "Achievements of Indians in science & technology; indigenization of technology and developing new technology.", "Awareness in the fields of IT, Space, Computers, Robotics, Nano-technology, Bio-technology and issues relating to intellectual property rights.", "Conservation, environmental pollution and degradation, environmental impact assessment.", "Disaster and disaster management.", "Linkages between development and spread of extremism.", "Role of external state and non-state actors in creating challenges to internal security.", "Challenges to internal security through communication networks, role of media and social networking sites in internal security challenges, basics of cyber security; money-laundering and its prevention.", "Security challenges and their management in border areas linkages of organized crime with terrorism.", "Various Security forces and agencies and their mandate."];
const dataGS4 = ["Ethics and Human Interface: Essence, determinants and consequences of Ethics in human actions; dimensions of ethics; ethics in private and public relationships. Human Values-lessons from the lives and teachings of great leaders, reformers and administrators; role of family, society and educational institutions in imparting values.", "Attitude: Content, structure, function; its influence and relation with thought and behaviour; moral and political attitudes; social influence and persuasion.", "Aptitude: Aptitude and foundational values for Civil Service, integrity, impartiality and non- partisanship, objectivity, dedication to public service, empathy, tolerance and compassion towards the weaker-sections.", "Emotional Intelligence: Concepts, and their utilities and application in administration and governance.", "Contributions of Moral Thinkers: Contributions of moral thinkers and philosophers from India and world.", "Public/Civil Service Values and Ethics in Public Administration: Status and problems; ethical concerns and dilemmas in government and private institutions; laws, rules, regulations and conscience as sources of ethical guidance; accountability and ethical governance; strengthening of ethical and moral values in governance; ethical issues in international relations and funding; corporate governance.", "Probity in Governance: Concept of public service; Philosophical basis of governance and probity; Information sharing and transparency in government, Right to Information, Codes of Ethics, Codes of Conduct, Citizen's Charters, Work culture, Quality of service delivery, Utilization of public funds, challenges of corruption.", "Case Studies on above issues."];
const dataA1 = ["1.1 Meaning, Scope and Development of Anthropology.", "1.2 Relationships with other disciplines: Social Sciences, Behavioural Sciences, Life Sciences, Medical Sciences, Earth Sciences and Humanities.", "1.3 Main branches of Anthropology, their scope and relevance: (a) Social-cultural Anthropology. (b) Biological Anthropology. (c) Archaeological Anthropology. (d) Linguistic Anthropology.", "1.4 Human Evolution and emergence of Man: (a) Biological and Cultural factors in human evolution. (b) Theories of Organic Evolution (Pre- Darwinian, Darwinian and Post-Darwinian). (c) Synthetic theory of evolution; Brief outline of terms and concepts of evolutionary biology (Doll's rule, Cope's rule, Gause's rule, parallelism, convergence, adaptive radiation, and mosaic evolution).", "1.5 Characteristics of Primates; Evolutionary Trend and Primate Taxonomy; Primate Adaptations; (Arboreal and Terrestrial) Primate Behaviour; Tertiary and Quaternary fossil primates; Living Major Primates; Comparative Anatomy of Man and Apes; Skeletal changes due to erect posture and bipedalism.", "1.6 Phylogenetic status, characteristics and geographical distribution of the following: (a) Plio-pleistocene hominids in South and East Africa - Australopithecines. (b) Homo erectus: Africa (Homo ergaster), Europe (Homo heidelbergensis), Asia (Homo erectus pekinensis, Homo erectus javanicus). (c) Neanderthal Man - La-Chapelle-aux-Saints (Classical type), Mt. Carmel (Progressive type). (d) Rhodesian man. (e) Homo sapiens Cro-Magnon, Grimaldi and Chancelade.", "1.7 The biological basis of Life: Cell, DNA structure and replication, Protein Synthesis, Gene, Mutation, Chromosomes, and Cell Division.", "1.8 Principles of Prehistoric Archaeology: Chronology: Relative and Absolute dating methods. Cultural Evolution- Broad Outlines of Prehistoric cultures: (e) Paleolithic (b) Mesolithic (c) Neolithic (d) Chalcolithic (e) Copper-Bronze Age (f) Iron Age.", "2.1 The Nature of Culture: The concept and characteristics of culture and civilization; Ethnocentrism vis-a-vis Cultural Relativism.", "2.2 The Nature of Society: Concept of society; Society and Culture; Social Institutions; Social groups; and Social stratification.", "2.3 Marriage: Definition and universality; Laws of marriage (endogamy, exogamy, hypergamy, hypogamy, incest taboo); Types of marriage (monogamy, polygamy, polyandry, group marriage); Functions of marriage; Marriage regulations (preferential, prescriptive and proscriptive); Marriage payments (bride wealth and dowry).", "2.4 Family: Definition and universality; Family, household and domestic group; functions of family; Types of family (from the perspectives of structure, blood relation, marriage, residence and succession); Impact of urbanization, industrialization and feminist movements on family.", "2.5 Kinship: Consanguinity and Affinity; Principles and types of descent (Unilineal, Double, Bilateral, Ambilineal); Forms of descent groups (lineage, clan, phratry, moiety and kindred); Kinship terminology (descriptive and classificatory); Descent-Alliance networks.", "3. Economic Organization: Meaning, scope and relevance of economic anthropology; Formalist and Substantivist debate; Principles governing production, distribution and exchange (reciprocity, redistribution and market) in communities, subsisting on hunting and gathering, fishing, pastoralism, horticulture and agriculture; globalization and indigenous economic systems.", "4. Political Organization and Social Control: Band, tribe, chiefdom, kingdom and state; concepts of power, authority and legitimacy; social control, law and justice in simple societies.", "5. Religion: Anthropological approaches to the study of religion (evolutionary, psychological and functional); Monotheism and Polytheism; Sacred and profane; Myths and rituals; Forms of religion in tribal and peasant societies (animism, animatism, fetishism, naturism and totemism); Religion, magic and science distinguished; Magico-religious functionaries (priest, shaman, medicine man, sorcerer and witch).", "6. Anthropological Theories: (a) Classical Evolutionism (Tylor, Morgan and Frazer) (b) Historical Particularism (Boas); Diffusionism (British, German-Austrian and American) (c) Functionalism (Malinowski); Structural-functionalism (Radcliffe-Brown) (d) Structuralism (Lévi-Strauss and Leach) (e) Culture and Personality (Benedict, Mead, Linton, Kardiner and Cora-du Bois) (f) Neo - Evolutionism (Childe, White, Steward, Sahlins and Service) (g) Cultural Materialism (Harris) (h) Symbolic and Interpretive theories (Turner, Schneider and Geertz) (i) Cognitive Anthropology (Tyler, Conklin) (j) Post-modernism in Anthropology", "7. Culture, Language and Communication: Nature, origin and characteristics of language; verbal and non-verbal communication; social-context of language use.", "8. Research Methods in Anthropology: (a) Fieldwork tradition in anthropology (b) Distinction between technique, method and methodology (c) Tools of data collection: observation, interview, schedules, questionnaire, Case study, Strategies, life history, oral history, secondary sources of data, genealogical method. (d) Analysis, interpretation and presentation of data.", "9.1 Human Genetics: Methods and Application: Methods for study of genetic principles in man- family study (pedigree analysis, twin study, foster child, co-twin method, cytogenetic method, chromosomal and karyo-type analysis), biochemical methods, immunological methods, D.N.A. technology and recombinant technologies.", "9.2 Mendelian genetics in man-marriage and disease: Single locus inheritance (Autosomal dominant and recessive, sex-linked, sex-limited and sex-influenced traits); Linkage and crossing-over, sex determination and differentiation; Biochemical genetics (Rh, ABO blood groups, HLA, Gm, blood enzymes, Inborn errors of metabolism).", "9.3 Chromosomal aberrations in Man: numerical and structural aberrations (disorders); (a) Autosomal aberrations: Down's, Patau's, Edward's and Cri-du-chat syndromes. (b) Sex chromosomal aberrations: Klinefelter's, Turner's, Super female, XYY syndrome. (c) Genetic imprints in human disease, genetic screening, genetic counseling, forensics.", "9.4 Race and Racism: Biological concept of race, criteria of racial classification; race and intelligence, racism; race cross-breeding, genetic markers in racial classification.", "9.5 Ecological Anthropology: Bio-cultural adaptations to cold, heat, high altitude, and nutritional stresses.", "9.6 Epidemiological Anthropology: Infectious and non-infectious diseases; Nutritional deficiencies.", "10. Concept of Human Growth and Development: Stages of growth prenatal, natal, infant, childhood, adolescence, maturity, senescence; Factors affecting growth and development; Methodology of growth studies (cross-sectional, longitudinal, mixed longitudinal); Human physique and somatotyping.", "11.1 Relevance of menarche, menopause and other bioevents to fertility. Fertility patterns and differentials.", "11.2 Demographic theories - biological, social and cultural.", "11.3 Biological and socio-ecological factors influencing fecundity, fertility, natality and mortality.", "12. Applications of Anthropology: Anthropology of sports, Nutritional anthropology, Anthropology in designing of defence and other equipments, Forensic Anthropology, Methods and principles of personal identification and reconstruction, Applied human genetics Paternity diagnosis, genetic counseling and eugenics, DNA profiling, Gene mapping."];
const dataA2 = ["1.1 Evolution of the Indian Culture and Civilization: Prehistoric (Paleolithic, Mesolithic, Neolithic and Chalcolithic); Protohistoric (Indus Valley Civilization); Islamic impacts; Westernization and Modernization trends.", "1.2 Paleoanthropological evidences from India with special reference to Ramapithecus, Sivapithecus and Narmada Man.", "1.3 Ethno-archaeology in India: The concept of ethno-archaeology; Survivals and Parallels among the hunter-gatherers, pastoralists, nomadic communities, agriculturalists and artisan communities.", "2. Demographic profile of India: Ethnic and linguistic elements in the Indian population and their distribution; Social and economic characteristics of the ethnographic elements.", "3.1 The structure and nature of traditional Indian social system: Varnashrama, Purushartha, Karma, Rina and Rebirth concepts.", "3.2 Caste system in India: Structure and characteristics; Varna and Caste; Theories of origin of caste system; Dominant Caste; Caste mobility; Future of caste system; Jajmani system; Jati Panchayat.", "3.3 Sacred Complex and Nature-Man-Spirit Complex.", "3.4 Impact of Buddhism, Jainism, Islam and Christianity on Indian society.", "4. Emergence and Growth of Anthropology in India: Contributions of the 18th, 19th and early 20th Century scholar-administrators; Contributions of Indian anthropologists to tribal and peasant studies.", "5.1 Indian Village: Significance of village study in India; Indian village as a social system; Traditional and changing patterns of settlement and inter-caste relations; Agrarian relations in Indian villages; Impact of globalization on Indian villages.", "5.2 Linguistic and religious minorities and their social, political and economic problems.", "5.3 Indigenous and exogenous processes of socio-cultural change in Indian society: Sanskritization, Westernization, Modernization; Inter-play of Little and Great Traditions; Panchayati Raj and social change.", "6.1 Tribal situation in India: Bio-genetic variability, linguistic and socio-economic characteristics of tribal populations and their distribution.", "6.2 Problems of the tribal Communities: Land alienation, poverty, indebtedness, low literacy, poor health, malnutrition, underemployment; Tribal unrest and Left-Wing Extremism.", "6.3 Developmental projects and their impact on tribal displacement and rehabilitation problems; Development of forest policy and tribals.", "7.1 Problems of exploitation and deprivation of Scheduled Castes, Scheduled Tribes and Other Backward Classes; Constitutional safeguards for Scheduled Tribes and Scheduled Castes.", "7.2 Social change and contemporary tribal societies: Impact of modern democratic institutions, development programmes and welfare measures on tribals and weaker sections.", "7.3 The concept of PTGs (Particularly Vulnerable Tribal Groups) and their distribution; Special programmes for their development; Role of NGOs in tribal development.", "8.1 Impact of Hinduism, Buddhism, Christianity, Islam and other religions on tribal societies.", "8.2 Tribe and nation state: Comparative study of tribal communities in India and other democratic countries; issues of integration and autonomy.", "9.1 History of administration of tribal areas: Tribal policies and plans during British rule and post- independence; 5th and 6th Schedules of the Constitution; Panchayati Raj provisions for tribal areas (PESA); Tribal Sub-Plan framework.", "9.2 Role of Anthropology in tribal and rural development.", "9.3 Contributions of anthropology to the understanding of regionalism, communalism, and ethnic conflicts."];
const dataCA = ["May 2026 Monthly Compilation", "June 2026 Monthly Compilation", "July 2026 Monthly Compilation", "August 2026 Monthly Compilation", "September 2026 Monthly Compilation", "October 2026 Monthly Compilation", "November 2026 Monthly Compilation", "December 2026 Monthly Compilation", "January 2027 Monthly Compilation", "February 2027 Monthly Compilation", "March 2027 Monthly Compilation", "April 2027 Monthly Compilation", "May 2027 (Pre-Exam Update)"];

const dataPYQ_p1 = [];
const dataPYQ_p2 = ["CSAT PYQ (2023)", "CSAT PYQ (2022)"];
const dataPYQ_gs1 = ["GS-I PYQ (2023)", "GS-I PYQ (2022)"];
const dataPYQ_gs2 = ["GS-II PYQ (2023)", "GS-II PYQ (2022)"];
const dataPYQ_gs3 = ["GS-III PYQ (2023)", "GS-III PYQ (2022)"];
const dataPYQ_gs4 = ["GS-IV PYQ (2023)", "GS-IV PYQ (2022)"];
const dataPYQ_a1 = ["Anthro P1 PYQ (2023)", "Anthro P1 PYQ (2022)"];
const dataPYQ_a2 = ["Anthro P2 PYQ (2023)", "Anthro P2 PYQ (2022)"];

const dataTS_p1 = ["Prelims GS1 Mock Test 01", "Prelims GS1 Mock Test 02"];
const dataTS_p2 = ["Prelims CSAT Mock Test 01", "Prelims CSAT Mock Test 02"];
const dataTS_gs1 = ["Mains GS-I Sectional Test 01"];
const dataTS_gs2 = ["Mains GS-II Sectional Test 01"];
const dataTS_gs3 = ["Mains GS-III Sectional Test 01"];
const dataTS_gs4 = ["Mains GS-IV Sectional Test 01"];
const dataTS_essay = ["Mains Essay Test 01"];
const dataTS_a1 = ["Anthro P1 Sectional Test 01"];
const dataTS_a2 = ["Anthro P2 Sectional Test 01"];

const pieColors = {
    'p1':  { hex: '#6366f1', bg: '#e0e7ff', text: '#4f46e5' }, 'p2':  { hex: '#10b981', bg: '#d1fae5', text: '#059669' },
    'gs1': { hex: '#f59e0b', bg: '#fef3c7', text: '#d97706' }, 'gs2': { hex: '#f43f5e', bg: '#ffe4e6', text: '#e11d48' },
    'gs3': { hex: '#a855f7', bg: '#f3e8ff', text: '#9333ea' }, 'gs4': { hex: '#06b6d4', bg: '#cffafe', text: '#0891b2' },
    'a1':  { hex: '#d946ef', bg: '#fae8ff', text: '#c026d3' }, 'a2':  { hex: '#f97316', bg: '#ffedd5', text: '#ea580c' },
    'ca':  { hex: '#14b8a6', bg: '#ccfbf1', text: '#0d9488' }
};

// =========================================================================
// UTILITY FUNCTIONS
// =========================================================================
function escH(s) { return s ? s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') : ''; }
function escA(s) { return s ? s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;') : ''; }

function toggleNoteLock(id, isChecked) {
    const noteInput = document.getElementById('note-' + id);
    if(noteInput) {
        noteInput.readOnly = isChecked;
        if(isChecked) { noteInput.classList.add('locked-note'); } else { noteInput.classList.remove('locked-note'); }
    }
}

// =========================================================================
// TOAST NOTIFICATION SYSTEM
// =========================================================================
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const icons = { success: '✓', error: '✕', info: 'ℹ', focus: '🎯' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
}

// =========================================================================
// BUILD LIST (renders syllabus items into DOM containers)
// =========================================================================
function buildList(domId, dataArr, prefix) {
    const el = document.getElementById(domId);
    if(!el) return;
    el.innerHTML = dataArr.map((text, idx) => `
        <div class="task-row flex flex-col p-3.5 rounded-2xl transition duration-200 group relative">
            <label for="uid-${prefix}-${idx}" class="flex items-start cursor-pointer w-full text-xs sm:text-sm font-bold tracking-tight select-none">
                <input type="checkbox" id="uid-${prefix}-${idx}" onchange="handleSyncAction('uid-${prefix}-${idx}')" class="mt-0.5 mr-3.5 h-5 w-5 rounded-md border-violet-400/50 text-indigo-600 focus:ring-indigo-500/20 cursor-pointer">
                <span class="text-slate-200 font-medium ml-2 break-words group-has-[:checked]:text-slate-500 group-has-[:checked]:line-through transition-all">${text}</span>
            </label>
            <div class="mt-2 ml-10 w-[calc(100%-2.5rem)]">
                <input type="text" id="note-uid-${prefix}-${idx}" oninput="debouncedSync('uid-${prefix}-${idx}')" placeholder="Add a note or reminder here (e.g., 'Half done', 'Revise NCERT')..." class="w-full bg-slate-900/40 border border-violet-500/20 rounded-lg p-2 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-violet-400 focus:bg-slate-900/60 transition-all placeholder-slate-500">
            </div>
        </div>
    `).join('');
}

// =========================================================================
// INITIALIZE DOM LISTS
// =========================================================================
buildList('box-prelims-gs', dataP1, 'p1'); buildList('box-prelims-csat', dataP2, 'p2');
buildList('box-mains-lang-a', dataLA, 'la'); buildList('box-mains-lang-b', dataLB, 'lb'); buildList('box-mains-essay', dataES, 'es');
buildList('box-mains-gs1', dataGS1, 'gs1'); buildList('box-mains-gs2', dataGS2, 'gs2'); buildList('box-mains-gs3', dataGS3, 'gs3'); buildList('box-mains-gs4', dataGS4, 'gs4');
buildList('box-anthro-p1', dataA1, 'a1'); buildList('box-anthro-p2', dataA2, 'a2');
buildList('box-ca', dataCA, 'ca');

buildList('box-pyq-p1', dataPYQ_p1, 'pq1');
let _pyqRendered = false, _csatRendered = false;
function lazyRenderPYQ() { if (!_pyqRendered && typeof pyqGS1Data !== 'undefined') { renderPYQTopics(); _pyqRendered = true; } }
function lazyRenderCSAT() { if (!_csatRendered && typeof pyqCSATData !== 'undefined') { renderCSATTopics(); _csatRendered = true; } }
buildList('box-pyq-gs1', dataPYQ_gs1, 'qg1'); buildList('box-pyq-gs2', dataPYQ_gs2, 'qg2'); buildList('box-pyq-gs3', dataPYQ_gs3, 'qg3'); buildList('box-pyq-gs4', dataPYQ_gs4, 'qg4');
buildList('box-pyq-a1', dataPYQ_a1, 'qa1'); buildList('box-pyq-a2', dataPYQ_a2, 'qa2');

buildList('box-ts-p1', dataTS_p1, 'tp1'); buildList('box-ts-p2', dataTS_p2, 'tp2');
buildList('box-ts-gs1', dataTS_gs1, 'tg1'); buildList('box-ts-gs2', dataTS_gs2, 'tg2'); buildList('box-ts-gs3', dataTS_gs3, 'tg3'); buildList('box-ts-gs4', dataTS_gs4, 'tg4');
buildList('box-ts-essay', dataTS_essay, 'te1'); buildList('box-ts-a1', dataTS_a1, 'ta1'); buildList('box-ts-a2', dataTS_a2, 'ta2');

// trackLiveClockTimelines & calculateMetricsHUD called from tracker.js after definitions
