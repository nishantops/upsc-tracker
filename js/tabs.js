// =========================================================================
// UPSC Tracker - Tab Navigation Module
// =========================================================================

function activateRootTab(id) {
    document.querySelectorAll('.root-pane-view').forEach(p => p.classList.add('hidden'));
    document.getElementById(`view-${id}`).classList.remove('hidden');
    ['marathon', 'planner'].forEach(k => {
        const btn = document.getElementById(`btn-root-${k}`);
        if (k === id) { btn.className = "cursor-pointer flex-1 text-center py-4 px-6 rounded-xl font-black text-sm uppercase tracking-widest transition-all bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 heading-font border border-indigo-500"; }
        else { btn.className = "cursor-pointer flex-1 text-center py-4 px-6 rounded-xl font-black text-sm uppercase tracking-widest transition-all text-slate-400 hover:text-violet-300 hover:bg-white/5 heading-font border border-transparent"; }
    });
}

function activatePlannerTab(id) {
    document.querySelectorAll('.planner-subtab').forEach(p => p.classList.add('hidden'));
    document.getElementById(`planner-tab-${id}`).classList.remove('hidden');
    ['master', 'plans', 'sources'].forEach(k => {
        const btn = document.getElementById(`btn-planner-${k}`);
        if (!btn) return;
        if (k === id) { btn.className = "cursor-pointer flex-1 text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25 heading-font border border-emerald-500"; }
        else { btn.className = "cursor-pointer flex-1 text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-widest transition-all text-slate-500 hover:text-teal-700 hover:bg-white/80 heading-font border border-transparent"; }
    });
    if (id === 'sources') loadSources();
    if (id === 'master' && typeof renderGanttTimeline === 'function') renderGanttTimeline('month');
}

function activateMasterTab(id) {
    document.querySelectorAll('.master-pane-view').forEach(p => p.classList.add('hidden'));
    document.getElementById(`master-${id}`).classList.remove('hidden');
    ['syllabus', 'ca', 'pyq', 'testseries'].forEach(k => {
        const btn = document.getElementById(`btn-master-${k}`);
        if (k === id) { btn.className = "cursor-pointer flex-1 text-center py-4 px-6 rounded-xl font-black text-sm uppercase tracking-wider transition-all bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md heading-font"; }
        else { btn.className = "cursor-pointer flex-1 text-center py-4 px-6 rounded-xl font-black text-sm uppercase tracking-wider transition-all text-slate-300 hover:text-white hover:bg-white/10 heading-font"; }
    });
    if (id === 'pyq') { lazyRenderPYQ(); lazyRenderCSAT(); }
}

function activateStageTab(id) {
    document.querySelectorAll('.stage-pane-view').forEach(p => p.classList.add('hidden'));
    document.getElementById(`deck-${id}`).classList.remove('hidden');
    ['prelims', 'mains', 'anthro'].forEach(k => {
        const btn = document.getElementById(`btn-stage-${k}`);
        btn.className = `deck-${k}` === `deck-${id}` ? "cursor-pointer flex-1 text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-wider transition-all bg-indigo-600 text-white shadow-md heading-font border border-transparent" : "cursor-pointer flex-1 text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-wider transition-all stage-btn-inactive heading-font";
    });
}

function activateStageTab_PYQ(id) {
    document.querySelectorAll('.stage-pane-pyq').forEach(p => p.classList.add('hidden'));
    document.getElementById(`deck-pyq-${id}`).classList.remove('hidden');
    ['prelims', 'mains'].forEach(k => {
        const btn = document.getElementById(`btn-pyq-stage-${k}`);
        btn.className = k === id ? "cursor-pointer flex-1 text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-wider transition-all bg-indigo-600 text-white shadow-md heading-font border border-transparent" : "cursor-pointer flex-1 text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-wider transition-all stage-btn-inactive heading-font";
    });
    if (id === 'mains') renderMainsGS1PYQ();
}

function activateStageTab_TS(id) {
    document.querySelectorAll('.stage-pane-ts').forEach(p => p.classList.add('hidden'));
    document.getElementById(`deck-ts-${id}`).classList.remove('hidden');
    ['prelims', 'mains'].forEach(k => {
        const btn = document.getElementById(`btn-ts-stage-${k}`);
        btn.className = k === id ? "cursor-pointer flex-1 text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-wider transition-all bg-indigo-600 text-white shadow-md heading-font border border-transparent" : "cursor-pointer flex-1 text-center py-3.5 px-6 rounded-xl font-black text-xs uppercase tracking-wider transition-all stage-btn-inactive heading-font";
    });
}

function activateSubTab(groupClass, panelId, btnElement) {
    document.querySelectorAll('.sub-pane-' + groupClass).forEach(p => p.classList.add('hidden'));
    document.getElementById(panelId).classList.remove('hidden');
    document.querySelectorAll('.sub-tab-' + groupClass).forEach(btn => {
        btn.className = `sub-tab-${groupClass} inline-block py-2.5 px-5 rounded-lg font-bold text-xs uppercase transition-all text-slate-300 hover:text-white hover:bg-white/10 border border-transparent`;
    });
    btnElement.className = `sub-tab-${groupClass} inline-block py-2.5 px-5 rounded-lg font-bold text-xs uppercase transition-all bg-indigo-600 text-white shadow-sm border border-indigo-500`;
    // Lazy-render trend panels
    if (panelId === 'panel-prelims-trend') renderPrelimsTrend();
}

function activateInnerTab(gsNum, tab, btnEl) {
    document.querySelectorAll('.inner-pane-gs' + gsNum).forEach(p => p.classList.add('hidden'));
    document.getElementById('inner-gs' + gsNum + '-' + tab).classList.remove('hidden');
    document.querySelectorAll('.inner-tab-gs' + gsNum).forEach(btn => {
        btn.className = `inner-tab-gs${gsNum} text-[11px] py-1.5 px-4 rounded-lg font-bold uppercase transition-all text-slate-400 hover:text-white hover:bg-white/10 border border-transparent`;
    });
    btnEl.className = `inner-tab-gs${gsNum} text-[11px] py-1.5 px-4 rounded-lg font-bold uppercase transition-all bg-violet-600 text-white border border-violet-500`;
    if (tab === 'trend') {
        const renderers = [null, renderMainsGS1Trend, renderMainsGS2Trend, renderMainsGS3Trend, renderMainsGS4Trend];
        renderers[gsNum]();
    }
}

function activateSubTab_PYQ(groupClass, panelId, btnElement) {
    document.querySelectorAll('.sub-pane-pyq-' + groupClass).forEach(p => p.classList.add('hidden'));
    document.getElementById(panelId).classList.remove('hidden');
    document.querySelectorAll('.sub-tab-pyq-' + groupClass).forEach(btn => {
        btn.className = `sub-tab-pyq-${groupClass} inline-block py-2.5 px-5 rounded-lg font-bold text-xs uppercase transition-all text-slate-300 hover:text-white hover:bg-white/10 border border-transparent`;
    });
    btnElement.className = `sub-tab-pyq-${groupClass} inline-block py-2.5 px-5 rounded-lg font-bold text-xs uppercase transition-all bg-indigo-600 text-white shadow-sm border border-indigo-500`;
    if (panelId === 'panel-pyq-a1') renderAnthroP1PYQ();
    if (panelId === 'panel-pyq-a2') renderAnthroP2PYQ();
    if (panelId === 'panel-pyq-essay') renderEssayPYQ();
    if (panelId === 'panel-pyq-gs1') renderMainsGS1PYQ();
    if (panelId === 'panel-pyq-gs2') renderMainsGS2PYQ();
    if (panelId === 'panel-pyq-gs3') renderMainsGS3PYQ();
    if (panelId === 'panel-pyq-gs4') renderMainsGS4PYQ();
}

function activateSubTab_TS(groupClass, panelId, btnElement) {
    document.querySelectorAll('.sub-pane-ts-' + groupClass).forEach(p => p.classList.add('hidden'));
    document.getElementById(panelId).classList.remove('hidden');
    document.querySelectorAll('.sub-tab-ts-' + groupClass).forEach(btn => {
        btn.className = `sub-tab-ts-${groupClass} inline-block py-2.5 px-5 rounded-lg font-bold text-xs uppercase transition-all text-slate-300 hover:text-white hover:bg-white/10 border border-transparent`;
    });
    btnElement.className = `sub-tab-ts-${groupClass} inline-block py-2.5 px-5 rounded-lg font-bold text-xs uppercase transition-all bg-indigo-600 text-white shadow-sm border border-indigo-500`;
}

// ===== CA SECTION: Tab Switching & Link Management =====
function activateCATab(tab) {
    document.querySelectorAll('.ca-pane').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.sub-tab-ca').forEach(btn => {
        btn.className = 'sub-tab-ca inline-block py-2.5 px-5 rounded-lg font-bold text-xs uppercase transition-all text-slate-300 hover:text-white hover:bg-white/10 border border-transparent';
    });
    const activeClass = 'sub-tab-ca inline-block py-2.5 px-5 rounded-lg font-bold text-xs uppercase transition-all bg-indigo-600 text-white shadow-sm border border-indigo-500';
    if (tab === 'tracker') {
        document.getElementById('panel-ca-tracker').classList.remove('hidden');
        document.getElementById('btn-ca-tab-tracker').className = activeClass;
    } else if (tab === 'notes') {
        document.getElementById('panel-ca-notes').classList.remove('hidden');
        document.getElementById('btn-ca-tab-notes').className = activeClass;
        _initNotesPane();
    } else {
        document.getElementById('panel-ca-links').classList.remove('hidden');
        document.getElementById('btn-ca-tab-links').className = activeClass;
    }
    if (tab === 'links') renderCALinks();
}

function getCALinks() { return JSON.parse(localStorage.getItem('upsc_ca_links') || '[]'); }
function setCALinks(links) { localStorage.setItem('upsc_ca_links', JSON.stringify(links)); }

function openCALinkForm() {
    document.getElementById('ca-link-form').classList.remove('hidden');
    document.getElementById('ca-link-input-title').value = '';
    document.getElementById('ca-link-input-url').value = '';
    document.getElementById('ca-link-input-title').focus();
}
function closeCALinkForm() { document.getElementById('ca-link-form').classList.add('hidden'); }

function saveCALink() {
    const title = document.getElementById('ca-link-input-title').value.trim();
    const url = document.getElementById('ca-link-input-url').value.trim();
    if (!title || !url) { alert('Both title and URL are required.'); return; }
    try { new URL(url); } catch { alert('Please enter a valid URL.'); return; }
    const links = getCALinks();
    links.push({ id: Date.now().toString(), title, url });
    setCALinks(links);
    closeCALinkForm();
    renderCALinks();
    renderCADynamicLinks();
}

function deleteCALink(id) {
    const links = getCALinks().filter(l => l.id !== id);
    setCALinks(links);
    renderCALinks();
    renderCADynamicLinks();
}

function renderCALinks() {
    const container = document.getElementById('ca-links-list');
    const links = getCALinks();
    if (!links.length) {
        container.innerHTML = '<p class="text-xs text-slate-400 text-center py-6">No links added yet. Click "+ ADD LINK" to add your first CA resource.</p>';
        return;
    }
    container.innerHTML = links.map(l => `
        <div class="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-white/60 hover:bg-white transition-all group">
            <div class="flex items-center gap-3 min-w-0">
                <span class="text-amber-500 text-sm flex-shrink-0">🔗</span>
                <div class="min-w-0">
                    <a href="${l.url}" target="_blank" rel="noopener" class="text-xs font-bold text-slate-700 hover:text-amber-600 transition truncate block">${l.title}</a>
                    <span class="text-[10px] text-slate-400 font-mono truncate block">${l.url}</span>
                </div>
            </div>
            <button onclick="deleteCALink('${l.id}')" class="cursor-pointer opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-all" title="Delete">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
        </div>
    `).join('');
}

function renderCADynamicLinks() {
    const container = document.getElementById('ca-dynamic-links');
    const links = getCALinks();
    container.innerHTML = links.map(l => `
        <a href="${l.url}" target="_blank" rel="noopener" class="flex items-center gap-1.5 bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 text-amber-700 text-[10px] font-bold px-3 py-2 rounded-lg transition-all border border-amber-200/60 shadow-sm">
            📰 ${l.title}
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/></svg>
        </a>
    `).join('');
}

// Initialize CA links on page load
if (!localStorage.getItem('upsc_ca_links')) {
    setCALinks([
        { id: '1', title: 'Newspaper', url: 'https://tracker.atishmathur.com/Welcome-to-your-Tracker-Pro-1365f7f7d62180b6ad13e8ee5d16ac78' },
        { id: '2', title: 'Monthly Magazine', url: 'https://visionias.in/current-affairs/monthly-magazine/archive' }
    ]);
}
renderCADynamicLinks();

// ── CA Notes ─────────────────────────────────────────────────────────────────
var _notesMode = 'word';
var _wordNoteTimer = null;
var _wordNoteLoaded = false;

function _initNotesPane() {
    switchNotesMode(_notesMode);
    if (!_wordNoteLoaded && _notesMode === 'word') _loadWordNote();
}

function switchNotesMode(mode) {
    _notesMode = mode;
    var wordPane  = document.getElementById('ca-notes-word-pane');
    var tablePane = document.getElementById('ca-notes-table-pane');
    var btnWord   = document.getElementById('btn-notes-mode-word');
    var btnTable  = document.getElementById('btn-notes-mode-table');
    if (wordPane)  wordPane.classList.toggle('hidden', mode !== 'word');
    if (tablePane) tablePane.classList.toggle('hidden', mode !== 'table');
    if (btnWord)  { btnWord.classList.toggle('notes-mode-active', mode === 'word'); }
    if (btnTable) { btnTable.classList.toggle('notes-mode-active', mode === 'table'); }
    if (mode === 'word' && !_wordNoteLoaded) _loadWordNote();
    if (mode === 'table') {
        // Full spreadsheet via plantable.js — same engine as Plan tables
        if (typeof loadPlanTables === 'function') loadPlanTables('ca_notes');
    }
}

// ── Word Style Editor ─────────────────────────────────────────────────────────
async function _loadWordNote() {
    if (!dbClient || !currentUserId) return;
    try {
        const { data } = await dbClient.from('upsc_tracker_progress')
            .select('topic_note')
            .eq('id', 'ca_note_word_doc')
            .eq('user_id', currentUserId)
            .maybeSingle();
        const editor = document.getElementById('ca-word-editor');
        if (editor && data && data.topic_note) {
            editor.innerHTML = data.topic_note;
        }
        _wordNoteLoaded = true;
    } catch(e) {}
}

function _wordNoteChanged() {
    clearTimeout(_wordNoteTimer);
    _setRteStatus('saving\u2026');
    _wordNoteTimer = setTimeout(_saveWordNote, 1200);
}

async function _saveWordNote() {
    const editor = document.getElementById('ca-word-editor');
    if (!editor || !dbClient || !currentUserId) return;
    try {
        await dbClient.from('upsc_tracker_progress').upsert(
            { id: 'ca_note_word_doc', user_id: currentUserId, is_checked: false, topic_note: editor.innerHTML, updated_at: new Date().toISOString() },
            { onConflict: 'id,user_id' }
        );
        _setRteStatus('\u2713 Saved');
        setTimeout(function() { _setRteStatus(''); }, 2000);
    } catch(e) { _setRteStatus('Save failed'); }
}

function _setRteStatus(msg) {
    var el = document.getElementById('ca-rte-status');
    if (el) el.textContent = msg;
}

function rtCmd(cmd, value) {
    document.execCommand(cmd, false, value !== undefined ? value : null);
    var editor = document.getElementById('ca-word-editor');
    if (editor) editor.focus();
    _wordNoteChanged();
}

// ── Table Style Notes — delegated to plantable.js ─────────────────────────────
// loadPlanTables('ca_notes') is called by switchNotesMode when 'table' is selected.
// All spreadsheet features (rows, columns, rename, fullscreen, zoom, sheets, save)
// come from js/plantable.js with planId = 'ca_notes'.

