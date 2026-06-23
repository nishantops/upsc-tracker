// =========================================================================
// UPSC Tracker - Focus Mode Module  (v5)
// localStorage-first, Supabase sync when available.
// Auto-restore DISABLED per user preference.
// =========================================================================

let focusIntervalId  = null;
let focusSessionId   = null;
let focusStartTime   = null;
let focusPanelOpen   = false;
let focusDbAvailable = true;

const FOCUS_LS      = 'upsc_focus_v4';
const FOCUS_HIST_LS = 'upsc_focus_hist_v4';

// -- Init (never auto-restores - always fresh start) ----------------------
async function initFocusMode() {
    // Always start fresh: clear any stored session state
    clearFocusLocalStorage();
    focusSessionId = null;
    focusStartTime = null;

    if (!dbClient || !currentUserId) {
        updateFocusTotalsLocal();
        updateFocusLastSessionLocal();
        return;
    }
    try {
        // Close any orphaned DB sessions silently (browser was closed mid-session)
        const { data: orphans, error: oErr } = await dbClient
            .from('upsc_focus_sessions')
            .select('id, started_at')
            .eq('user_id', currentUserId)
            .is('ended_at', null);

        if (!oErr && orphans && orphans.length > 0) {
            for (const s of orphans) {
                const dur = Math.max(0, Math.floor((Date.now() - new Date(s.started_at).getTime()) / 1000));
                if (dur > 5 && dur < 86400) {
                    await dbClient.from('upsc_focus_sessions')
                        .update({ ended_at: new Date().toISOString(), duration_seconds: dur })
                        .eq('id', s.id);
                } else {
                    // Too short or too old — delete
                    await dbClient.from('upsc_focus_sessions').delete().eq('id', s.id);
                }
            }
        }
        focusDbAvailable = true;
        await updateFocusTotals();
        await updateFocusLastSession();
    } catch(e) {
        console.warn('[Focus] DB unavailable:', e.message);
        focusDbAvailable = false;
        updateFocusTotalsLocal();
        updateFocusLastSessionLocal();
    }
}

// -- localStorage helpers (history only, no session restore) ---------------
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
        if (h.length > 60) h.length = 60;
        localStorage.setItem(FOCUS_HIST_LS, JSON.stringify(h));
    } catch(e) {}
}

// -- Panel open / close ---------------------------------------------------
function openFocusPanel() {
    const panel = document.getElementById('focus-panel');
    if (!panel) { toggleFocusMode(); return; }
    if (focusPanelOpen) { closeFocusPanel(); return; }
    focusPanelOpen = true;
    panel.classList.remove('hidden');
    updateFocusPanelDisplay();
    if (focusDbAvailable && dbClient && currentUserId) {
        loadFocusHistoryFromDB().catch(function() { renderFocusHistoryLocal(); });
    } else {
        renderFocusHistoryLocal();
        updateFocusTotalsLocal();
    }
}
function closeFocusPanel() {
    var panel = document.getElementById('focus-panel');
    if (panel) panel.classList.add('hidden');
    focusPanelOpen = false;
}
document.addEventListener('click', function(e) {
    if (!focusPanelOpen) return;
    var panel  = document.getElementById('focus-panel');
    var widget = document.getElementById('focus-mode-widget');
    if (panel && widget && !panel.contains(e.target) && !widget.contains(e.target)) closeFocusPanel();
});

// -- Start / Stop ---------------------------------------------------------
async function toggleFocusMode() {
    if (focusSessionId) { await stopFocusMode(); } else { await startFocusMode(); }
    if (focusPanelOpen) updateFocusPanelDisplay();
}

async function startFocusMode() {
    var btn = document.getElementById('fp-toggle-btn');
    if (btn) { btn.disabled = true; btn.textContent = '...'; }
    var now = new Date();
    try {
        if (dbClient && currentUserId && focusDbAvailable) {
            var ins = await dbClient.from('upsc_focus_sessions')
                .insert({ user_id: currentUserId, started_at: now.toISOString() })
                .select().single();
            if (ins.error) throw ins.error;
            focusSessionId = ins.data.id;
            focusStartTime = new Date(ins.data.started_at).getTime();
            showToast('Focus mode started - studying tracked!', 'focus', 2500);
        } else { throw new Error('offline'); }
    } catch(e) {
        if (e.message !== 'offline') focusDbAvailable = false;
        focusSessionId = 'local-' + Date.now();
        focusStartTime = now.getTime();
        showToast('Focus timer started (local)!', 'info', 2000);
    }
    saveFocusToLocalStorage();
    startFocusUI();
    if (btn) { btn.disabled = false; btn.textContent = 'STOP SESSION'; btn.classList.add('fp-stop-btn'); }
}

async function stopFocusMode() {
    if (!focusSessionId) return;
    var endTime         = new Date();
    var durationSeconds = Math.max(1, Math.floor((endTime.getTime() - focusStartTime) / 1000));
    var sid     = focusSessionId;
    var isLocal = String(sid).startsWith('local-');
    var startIso = new Date(focusStartTime).toISOString();

    addToFocusHistory({ started_at: startIso, ended_at: endTime.toISOString(), duration_seconds: durationSeconds });
    focusSessionId = null; focusStartTime = null;
    clearFocusLocalStorage();
    stopFocusUI();
    updateFocusPanelDisplay();

    showToast('Session saved: ' + formatStudyDuration(durationSeconds), 'success', 3500);

    if (!isLocal && dbClient && currentUserId) {
        try {
            await dbClient.from('upsc_focus_sessions')
                .update({ ended_at: endTime.toISOString(), duration_seconds: durationSeconds })
                .eq('id', sid).eq('user_id', currentUserId);
        } catch(e) { /* non-critical - saved locally */ }
    }
    await updateFocusTotals();
    await updateFocusLastSession();
    if (focusPanelOpen) {
        if (focusDbAvailable && dbClient && currentUserId) { loadFocusHistoryFromDB().catch(function() { renderFocusHistoryLocal(); }); }
        else renderFocusHistoryLocal();
    }
}

// -- UI -------------------------------------------------------------------
function startFocusUI() {
    var mb = document.getElementById('focus-mode-btn');
    var mw = document.getElementById('focus-mode-widget');
    if (mb) mb.classList.add('focus-active');
    if (mw) mw.classList.add('focus-widget-active');
    var label = document.getElementById('focus-status-label');
    if (label) label.textContent = 'ON';
    if (focusIntervalId) clearInterval(focusIntervalId);
    focusIntervalId = setInterval(function() {
        updateFocusTimerDisplay();
        if (focusPanelOpen) updateFocusPanelTimer();
    }, 1000);
    updateFocusTimerDisplay();
}
function stopFocusUI() {
    var mb = document.getElementById('focus-mode-btn');
    var mw = document.getElementById('focus-mode-widget');
    if (mb) mb.classList.remove('focus-active');
    if (mw) mw.classList.remove('focus-widget-active');
    var lbl = document.getElementById('focus-status-label');
    if (lbl) lbl.textContent = 'FOCUS';
    var t = document.getElementById('focus-timer-display');
    if (t) t.textContent = '00:00:00';
    if (focusIntervalId) { clearInterval(focusIntervalId); focusIntervalId = null; }
}
function updateFocusTimerDisplay() {
    if (!focusStartTime) return;
    var el = document.getElementById('focus-timer-display');
    if (el) el.textContent = formatStudyDuration(Math.floor((Date.now() - focusStartTime) / 1000));
}
function updateFocusPanelTimer() {
    if (!focusStartTime) return;
    var el = document.getElementById('fp-big-timer');
    if (el) el.textContent = formatStudyDuration(Math.floor((Date.now() - focusStartTime) / 1000));
}

// -- Panel display --------------------------------------------------------
function updateFocusPanelDisplay() {
    var panel   = document.getElementById('focus-panel');
    var btn     = document.getElementById('fp-toggle-btn');
    var status  = document.getElementById('fp-status-badge');
    var dbBadge = document.getElementById('fp-db-badge');
    var timer   = document.getElementById('fp-big-timer');

    if (focusSessionId) {
        if (panel) panel.classList.add('fp-active');
        if (btn)    { btn.textContent = 'STOP SESSION'; btn.classList.add('fp-stop-btn'); }
        if (status) { status.textContent = 'ACTIVE'; status.style.color = '#34d399'; }
        if (timer)  updateFocusPanelTimer();
    } else {
        if (panel) panel.classList.remove('fp-active');
        if (btn)    { btn.textContent = 'START SESSION'; btn.classList.remove('fp-stop-btn'); }
        if (status) { status.textContent = 'IDLE'; status.style.color = ''; }
        if (timer)  timer.textContent = '00:00:00';
    }
    if (dbBadge) {
        dbBadge.textContent = focusDbAvailable ? 'Cloud sync' : 'Local only';
        dbBadge.style.color = focusDbAvailable ? '#10b981' : '#f59e0b';
    }
}

// -- Totals (only completed sessions with duration > 0) -------------------
async function updateFocusTotals() {
    if (!dbClient || !currentUserId || !focusDbAvailable) { updateFocusTotalsLocal(); return; }
    try {
        var todayStart = new Date(); todayStart.setHours(0,0,0,0);
        var res = await dbClient.from('upsc_focus_sessions')
            .select('duration_seconds')
            .eq('user_id', currentUserId)
            .gte('started_at', todayStart.toISOString())
            .not('ended_at', 'is', null)
            .gt('duration_seconds', 0);
        var total = (res.data || []).reduce(function(s,r) { return s + (r.duration_seconds || 0); }, 0);
        displayTodayTotal(total);
    } catch(e) { updateFocusTotalsLocal(); }
}
function updateFocusTotalsLocal() {
    var todayStr = new Date().toDateString();
    var total = getFocusHistory()
        .filter(function(s) { return new Date(s.started_at).toDateString() === todayStr && (s.duration_seconds || 0) > 0; })
        .reduce(function(s,r) { return s + (r.duration_seconds || 0); }, 0);
    displayTodayTotal(total);
}
function displayTodayTotal(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    var label = h > 0 ? (h + 'h ' + m + 'm today') : m > 0 ? (m + 'm today') : sec > 0 ? (sec + 's today') : '';
    var el  = document.getElementById('focus-today-total');
    var el2 = document.getElementById('fp-stat-today');
    if (el)  { el.textContent = label; if (label) el.classList.remove('hidden'); else el.classList.add('hidden'); }
    if (el2) el2.textContent = label || '--';
}

async function updateFocusLastSession() {
    if (!dbClient || !currentUserId || !focusDbAvailable) { updateFocusLastSessionLocal(); return; }
    try {
        var res = await dbClient.from('upsc_focus_sessions')
            .select('started_at, duration_seconds')
            .eq('user_id', currentUserId)
            .not('ended_at', 'is', null)
            .gt('duration_seconds', 0)
            .order('started_at', { ascending: false })
            .limit(1);
        if (res.data && res.data.length > 0) displayLastSession(res.data[0].started_at, res.data[0].duration_seconds);
        else updateFocusLastSessionLocal();
    } catch(e) { updateFocusLastSessionLocal(); }
}
function updateFocusLastSessionLocal() {
    var h = getFocusHistory().filter(function(s) { return (s.duration_seconds || 0) > 0; });
    if (h.length > 0) displayLastSession(h[0].started_at, h[0].duration_seconds);
}
function displayLastSession(startedAt, durationSeconds) {
    var el = document.getElementById('fp-stat-last');
    if (!el) return;
    var when = formatRelativeTime(new Date(startedAt));
    el.textContent = formatStudyDuration(durationSeconds || 0) + ' - ' + when;
}

// -- History + 7-day avg --------------------------------------------------
async function loadFocusHistoryFromDB() {
    var weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6); weekStart.setHours(0,0,0,0);
    var results = await Promise.all([
        dbClient.from('upsc_focus_sessions').select('started_at,ended_at,duration_seconds')
            .eq('user_id', currentUserId).not('ended_at','is',null).gt('duration_seconds',0)
            .order('started_at',{ascending:false}).limit(10),
        dbClient.from('upsc_focus_sessions').select('duration_seconds,started_at')
            .eq('user_id', currentUserId).not('ended_at','is',null).gt('duration_seconds',0)
            .gte('started_at', weekStart.toISOString())
    ]);
    renderFocusHistory(results[0].data || []);
    var weekSec = (results[1].data || []).reduce(function(s,r) { return s + (r.duration_seconds||0); }, 0);
    // Count distinct days in range
    var days = new Set((results[1].data || []).map(function(r) { return new Date(r.started_at).toDateString(); })).size;
    var avgSec = days > 0 ? Math.floor(weekSec / days) : 0;
    var el = document.getElementById('fp-stat-week');
    if (el) el.innerHTML = formatStudyDuration(weekSec) + '<br><span style="font-size:0.55rem;color:var(--t3);">avg ' + formatStudyDuration(avgSec) + '/day</span>';
}
function renderFocusHistoryLocal() {
    var allHist = getFocusHistory().filter(function(s) { return (s.duration_seconds||0) > 0; });
    renderFocusHistory(allHist.slice(0,10));
    var weekStart = new Date(); weekStart.setDate(weekStart.getDate()-6); weekStart.setHours(0,0,0,0);
    var weekData = allHist.filter(function(s) { return new Date(s.started_at) >= weekStart; });
    var weekSec = weekData.reduce(function(s,r) { return s + (r.duration_seconds||0); }, 0);
    var days = new Set(weekData.map(function(r) { return new Date(r.started_at).toDateString(); })).size;
    var avgSec = days > 0 ? Math.floor(weekSec / days) : 0;
    var el = document.getElementById('fp-stat-week');
    if (el) el.innerHTML = formatStudyDuration(weekSec) + '<br><span style="font-size:0.55rem;color:var(--t3);">avg ' + formatStudyDuration(avgSec) + '/day</span>';
}
function renderFocusHistory(sessions) {
    var el = document.getElementById('fp-history-list');
    if (!el) return;
    if (!sessions || sessions.length === 0) {
        el.innerHTML = '<div class="fp-empty">No sessions yet -- hit START to begin!</div>';
        return;
    }
    el.innerHTML = sessions.map(function(s) {
        var d   = new Date(s.started_at);
        var dur = formatStudyDuration(s.duration_seconds || 0);
        var ago = formatRelativeTime(d);
        var dt  = d.toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
        var timeStr = d.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true });
        return '<div class="fp-hist-item">'
             + '<div class="fp-hist-left"><span class="fp-hist-date">' + dt + '</span><span class="fp-hist-time">' + timeStr + '</span></div>'
             + '<span class="fp-hist-dur">'  + dur + '</span>'
             + '<span class="fp-hist-ago">'  + ago + '</span>'
             + '</div>';
    }).join('');
}

// -- Helpers --------------------------------------------------------------
function formatStudyDuration(s) {
    var h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
}
function formatRelativeTime(date) {
    var d = Date.now() - date.getTime(), m = Math.floor(d/60000);
    if (m < 2) return 'just now';
    if (m < 60) return m + 'm ago';
    var h = Math.floor(m/60);
    return h < 24 ? h + 'h ago' : Math.floor(h/24) + 'd ago';
}
function showFocusError() {
    var el = document.getElementById('focus-timer-display');
    if (el) { el.textContent = 'ERR'; setTimeout(function() { el.textContent = '00:00:00'; }, 2000); }
}