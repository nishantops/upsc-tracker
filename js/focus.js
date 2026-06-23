// =========================================================================
// UPSC Tracker — Focus Mode Module  (v4)
// localStorage-first, Supabase sync when available.
// =========================================================================

let focusIntervalId = null;
let focusSessionId  = null;   // UUID if DB row, 'local-...' if offline
let focusStartTime  = null;   // ms epoch
let focusPanelOpen  = false;
let focusDbAvailable = true;  // optimistic; set false on first DB failure

const FOCUS_LS      = 'upsc_focus_v4';
const FOCUS_HIST_LS = 'upsc_focus_hist_v4';

// -- Init -----------------------------------------------------------------
async function initFocusMode() {
    loadFocusFromLocalStorage();          // always restore local state first
    if (!dbClient || !currentUserId) return;
    try {
        const { data, error } = await dbClient
            .from('upsc_focus_sessions')
            .select('*')
            .eq('user_id', currentUserId)
            .is('ended_at', null)
            .order('started_at', { ascending: false })
            .limit(1);
        if (error) throw error;
        focusDbAvailable = true;
        if (data && data.length > 0 && !focusSessionId) {
            // DB session found and no local session running — restore from DB
            focusSessionId = data[0].id;
            focusStartTime = new Date(data[0].started_at).getTime();
            saveFocusToLocalStorage();
            startFocusUI();
        }
        await updateFocusTotals();
        await updateFocusLastSession();
    } catch(e) {
        console.warn('[Focus] DB unavailable:', e.message);
        focusDbAvailable = false;
    }
}

function loadFocusFromLocalStorage() {
    try {
        const raw = localStorage.getItem(FOCUS_LS);
        if (!raw) return;
        const s = JSON.parse(raw);
        if (s.sessionId && s.startTime) {
            focusSessionId = s.sessionId;
            focusStartTime  = s.startTime;
            startFocusUI();
        }
    } catch(e) { /* ignore */ }
}
function saveFocusToLocalStorage() {
    try { localStorage.setItem(FOCUS_LS, JSON.stringify({ sessionId: focusSessionId, startTime: focusStartTime })); } catch(e) {}
}
function clearFocusLocalStorage() {
    try { localStorage.removeItem(FOCUS_LS); } catch(e) {}
}
function getFocusHistory() {
    try { return JSON.parse(localStorage.getItem(FOCUS_HIST_LS) || '[]'); } catch(e) { return []; }
}
function addToFocusHistory(entry) {
    try {
        const h = getFocusHistory();
        h.unshift(entry);
        if (h.length > 30) h.length = 30;
        localStorage.setItem(FOCUS_HIST_LS, JSON.stringify(h));
    } catch(e) {}
}

// -- Panel open / close ----------------------------------------------------
function openFocusPanel() {
    const panel = document.getElementById('focus-panel');
    if (!panel) { toggleFocusMode(); return; }
    if (focusPanelOpen) { closeFocusPanel(); return; }
    focusPanelOpen = true;
    panel.classList.remove('hidden');
    updateFocusPanelDisplay();
    if (focusDbAvailable && dbClient && currentUserId) {
        loadFocusHistoryFromDB().catch(() => renderFocusHistoryLocal());
    } else {
        renderFocusHistoryLocal();
        updateFocusTotalsLocal();
    }
}
function closeFocusPanel() {
    const panel = document.getElementById('focus-panel');
    if (panel) panel.classList.add('hidden');
    focusPanelOpen = false;
}
document.addEventListener('click', (e) => {
    if (!focusPanelOpen) return;
    const panel  = document.getElementById('focus-panel');
    const widget = document.getElementById('focus-mode-widget');
    if (panel && widget && !panel.contains(e.target) && !widget.contains(e.target)) closeFocusPanel();
});

// -- Start / Stop ----------------------------------------------------------
async function toggleFocusMode() {
    if (focusSessionId) { await stopFocusMode(); } else { await startFocusMode(); }
    if (focusPanelOpen) updateFocusPanelDisplay();
}

async function startFocusMode() {
    const btn = document.getElementById('fp-toggle-btn');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    const now = new Date();
    try {
        if (dbClient && currentUserId && focusDbAvailable) {
            const { data, error } = await dbClient
                .from('upsc_focus_sessions')
                .insert({ user_id: currentUserId, started_at: now.toISOString() })
                .select().single();
            if (error) throw error;
            focusSessionId = data.id;
            focusStartTime  = new Date(data.started_at).getTime();
            showToast('?? Focus mode started — studying tracked!', 'focus', 2500);
        } else { throw new Error('offline'); }
    } catch(e) {
        focusDbAvailable = e.message !== 'offline' ? false : focusDbAvailable;
        focusSessionId = 'local-' + Date.now();
        focusStartTime  = now.getTime();
        if (!focusDbAvailable) showToast('Focus timer started (local only — run DB migrations for sync)', 'info', 4000);
        else showToast('?? Focus timer started (local)!', 'focus', 2000);
    }
    saveFocusToLocalStorage();
    startFocusUI();
    if (btn) { btn.disabled = false; btn.textContent = '? STOP SESSION'; btn.classList.add('fp-stop-btn'); }
}

async function stopFocusMode() {
    if (!focusSessionId) return;
    const endTime         = new Date();
    const durationSeconds = Math.floor((endTime.getTime() - focusStartTime) / 1000);
    const sid    = focusSessionId;
    const isLocal = String(sid).startsWith('local-');
    const startIso = new Date(focusStartTime).toISOString();

    addToFocusHistory({ started_at: startIso, ended_at: endTime.toISOString(), duration_seconds: durationSeconds });
    focusSessionId = null; focusStartTime = null;
    clearFocusLocalStorage();
    stopFocusUI();
    updateFocusPanelDisplay();

    showToast('? Session saved: ' + formatStudyDuration(durationSeconds), 'success', 3500);

    if (!isLocal && dbClient && currentUserId) {
        try {
            await dbClient.from('upsc_focus_sessions')
                .update({ ended_at: endTime.toISOString(), duration_seconds: durationSeconds })
                .eq('id', sid).eq('user_id', currentUserId);
        } catch(e) { /* non-critical — already saved locally */ }
    }
    await updateFocusTotals();
    await updateFocusLastSession();
    if (focusPanelOpen) {
        if (focusDbAvailable && dbClient && currentUserId) { loadFocusHistoryFromDB().catch(() => renderFocusHistoryLocal()); }
        else renderFocusHistoryLocal();
    }
}

// -- UI --------------------------------------------------------------------
function startFocusUI() {
    document.getElementById('focus-mode-btn')?.classList.add('focus-active');
    document.getElementById('focus-mode-widget')?.classList.add('focus-widget-active');
    const label = document.getElementById('focus-status-label');
    if (label) label.textContent = 'ON';
    if (focusIntervalId) clearInterval(focusIntervalId);
    focusIntervalId = setInterval(() => {
        updateFocusTimerDisplay();
        if (focusPanelOpen) updateFocusPanelTimer();
    }, 1000);
    updateFocusTimerDisplay();
}
function stopFocusUI() {
    document.getElementById('focus-mode-btn')?.classList.remove('focus-active');
    document.getElementById('focus-mode-widget')?.classList.remove('focus-widget-active');
    const lbl = document.getElementById('focus-status-label');
    if (lbl) lbl.textContent = 'FOCUS';
    const t = document.getElementById('focus-timer-display');
    if (t) t.textContent = '00:00:00';
    if (focusIntervalId) { clearInterval(focusIntervalId); focusIntervalId = null; }
}
function updateFocusTimerDisplay() {
    if (!focusStartTime) return;
    const el = document.getElementById('focus-timer-display');
    if (el) el.textContent = formatStudyDuration(Math.floor((Date.now() - focusStartTime) / 1000));
}
function updateFocusPanelTimer() {
    if (!focusStartTime) return;
    const el = document.getElementById('fp-big-timer');
    if (el) el.textContent = formatStudyDuration(Math.floor((Date.now() - focusStartTime) / 1000));
}

// -- Panel display ---------------------------------------------------------
function updateFocusPanelDisplay() {
    const panel  = document.getElementById('focus-panel');
    const btn    = document.getElementById('fp-toggle-btn');
    const status = document.getElementById('fp-status-badge');
    const dbBadge= document.getElementById('fp-db-badge');
    const timer  = document.getElementById('fp-big-timer');

    if (focusSessionId) {
        panel?.classList.add('fp-active');
        if (btn) { btn.textContent = '? STOP SESSION'; btn.classList.add('fp-stop-btn'); }
        if (status) status.textContent = '? ACTIVE';
        if (timer) updateFocusPanelTimer();
    } else {
        panel?.classList.remove('fp-active');
        if (btn) { btn.textContent = '? START SESSION'; btn.classList.remove('fp-stop-btn'); }
        if (status) status.textContent = '? IDLE';
        if (timer) timer.textContent = '00:00:00';
    }
    if (dbBadge) {
        dbBadge.textContent = focusDbAvailable ? '? Cloud sync' : '? Local only';
        dbBadge.style.color = focusDbAvailable ? '#10b981' : '#f59e0b';
    }
}

// -- Totals & last session -------------------------------------------------
async function updateFocusTotals() {
    if (!dbClient || !currentUserId || !focusDbAvailable) { updateFocusTotalsLocal(); return; }
    try {
        const todayStart = new Date(); todayStart.setHours(0,0,0,0);
        const { data } = await dbClient.from('upsc_focus_sessions')
            .select('duration_seconds').eq('user_id', currentUserId)
            .gte('started_at', todayStart.toISOString()).not('ended_at', 'is', null);
        const total = (data || []).reduce((s,r) => s + (r.duration_seconds || 0), 0);
        displayTodayTotal(total);
    } catch(e) { updateFocusTotalsLocal(); }
}
function updateFocusTotalsLocal() {
    const todayStr = new Date().toDateString();
    const total = getFocusHistory()
        .filter(s => new Date(s.started_at).toDateString() === todayStr)
        .reduce((s,r) => s + (r.duration_seconds || 0), 0);
    displayTodayTotal(total);
}
function displayTodayTotal(sec) {
    const label = sec >= 3600 ? `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}m today`
                : sec >= 60  ? `${Math.floor(sec/60)}m today`
                : sec > 0    ? `${sec}s today` : '';
    const el  = document.getElementById('focus-today-total');
    const el2 = document.getElementById('fp-stat-today');
    if (el)  { el.textContent = label; if (label) el.classList.remove('hidden'); }
    if (el2) el2.textContent = label || '—';
}

async function updateFocusLastSession() {
    if (!dbClient || !currentUserId || !focusDbAvailable) { updateFocusLastSessionLocal(); return; }
    try {
        const { data } = await dbClient.from('upsc_focus_sessions')
            .select('started_at, duration_seconds').eq('user_id', currentUserId)
            .not('ended_at', 'is', null).order('started_at', { ascending: false }).limit(1);
        if (data && data.length > 0) displayLastSession(data[0].started_at, data[0].duration_seconds);
        else updateFocusLastSessionLocal();
    } catch(e) { updateFocusLastSessionLocal(); }
}
function updateFocusLastSessionLocal() {
    const h = getFocusHistory();
    if (h.length > 0) displayLastSession(h[0].started_at, h[0].duration_seconds);
}
function displayLastSession(startedAt, durationSeconds) {
    const el = document.getElementById('fp-stat-last');
    if (!el) return;
    const when = formatRelativeTime(new Date(startedAt));
    el.textContent = formatStudyDuration(durationSeconds || 0) + ' · ' + when;
}

// -- History ---------------------------------------------------------------
async function loadFocusHistoryFromDB() {
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0,0,0,0);
    const [histRes, weekRes] = await Promise.all([
        dbClient.from('upsc_focus_sessions').select('started_at,ended_at,duration_seconds')
            .eq('user_id', currentUserId).not('ended_at','is',null)
            .order('started_at',{ascending:false}).limit(7),
        dbClient.from('upsc_focus_sessions').select('duration_seconds')
            .eq('user_id', currentUserId).not('ended_at','is',null)
            .gte('started_at', weekStart.toISOString())
    ]);
    renderFocusHistory(histRes.data || []);
    const weekSec = (weekRes.data || []).reduce((s,r) => s + (r.duration_seconds||0), 0);
    const el = document.getElementById('fp-stat-week');
    if (el) el.textContent = formatStudyDuration(weekSec);
}
function renderFocusHistoryLocal() {
    const h = getFocusHistory();
    renderFocusHistory(h.slice(0,7));
    const weekStart = new Date(); weekStart.setDate(weekStart.getDate()-6); weekStart.setHours(0,0,0,0);
    const weekSec = h.filter(s => new Date(s.started_at) >= weekStart)
                     .reduce((s,r) => s + (r.duration_seconds||0), 0);
    const el = document.getElementById('fp-stat-week');
    if (el) el.textContent = formatStudyDuration(weekSec);
}
function renderFocusHistory(sessions) {
    const el = document.getElementById('fp-history-list');
    if (!el) return;
    if (!sessions || sessions.length === 0) {
        el.innerHTML = '<div class="fp-empty">No sessions yet — hit START to begin!</div>';
        return;
    }
    el.innerHTML = sessions.map(s => {
        const d   = new Date(s.started_at);
        const dur = formatStudyDuration(s.duration_seconds || 0);
        const ago = formatRelativeTime(d);
        const dt  = d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
        return `<div class="fp-hist-item">
          <span class="fp-hist-date">${dt}</span>
          <span class="fp-hist-dur">${dur}</span>
          <span class="fp-hist-ago">${ago}</span>
        </div>`;
    }).join('');
}

// -- Helpers ---------------------------------------------------------------
function formatStudyDuration(s) {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function formatRelativeTime(date) {
    const d = Date.now() - date.getTime(), m = Math.floor(d/60000);
    if (m < 2) return 'just now';
    if (m < 60) return m + 'm ago';
    const h = Math.floor(m/60);
    return h < 24 ? h + 'h ago' : Math.floor(h/24) + 'd ago';
}
function showFocusError() {
    const el = document.getElementById('focus-timer-display');
    if (el) { el.textContent = 'ERR'; setTimeout(() => { el.textContent = '00:00:00'; }, 2000); }
}
