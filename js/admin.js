// =========================================================================
// UPSC Admin Console — admin.js
// =========================================================================

var adminClient = null;
var adminUserId = null;
var adminCurrentUser = null;  // user object for the open modal
var _allUsersCache  = [];

// ── Boot ─────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async function() {
    adminClient = window.supabase.createClient(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY);

    // Check existing session
    var sess = await adminClient.auth.getSession();
    if (sess.data && sess.data.session) {
        var userId = sess.data.session.user.id;
        var ok = await checkAdminRole(userId);
        if (ok) { adminUserId = userId; showAdminDashboard(sess.data.session.user.email); }
        else { adminLogout(); }
    }
});

// ── Auth ─────────────────────────────────────────────────────────────────
async function adminLogin() {
    var email = document.getElementById('aln-email').value.trim();
    var pw    = document.getElementById('aln-password').value;
    var errEl = document.getElementById('aln-error');
    var btn   = document.getElementById('aln-btn');
    errEl.style.display = 'none';
    if (!email || !pw) { showAdminError('Email and password required.'); return; }
    btn.textContent = 'Signing in...'; btn.disabled = true;
    try {
        var res = await adminClient.auth.signInWithPassword({ email: email, password: pw });
        if (res.error) throw res.error;
        var userId = res.data.user.id;
        var isAdm  = await checkAdminRole(userId);
        if (!isAdm) { await adminClient.auth.signOut(); throw new Error('Access denied: not an admin account.'); }
        adminUserId = userId;
        showAdminDashboard(res.data.user.email);
    } catch(e) {
        showAdminError(e.message || 'Login failed.');
        btn.textContent = 'Sign In'; btn.disabled = false;
    }
}

async function checkAdminRole(userId) {
    try {
        // 1. Check upsc_user_sessions.is_superuser (fastest, primary)
        var r = await adminClient.from('upsc_user_sessions').select('is_superuser').eq('user_id', userId).maybeSingle();
        if (r.data && r.data.is_superuser === true) return true;

        // 2. Upsert session as superuser if this is the known admin
        //    (first-time setup: run "UPDATE upsc_user_sessions SET is_superuser=true WHERE user_id='...'" in Supabase)
        // 3. Check Supabase app_metadata (set via Supabase Dashboard → Users → Edit)
        var gu = await adminClient.auth.getUser();
        if (gu.data && gu.data.user) {
            var meta = gu.data.user.app_metadata || {};
            if (meta.is_admin === true || meta.role === 'admin') return true;
        }
        return false;
    } catch(e) { console.warn('[Admin] checkAdminRole error:', e.message); return false; }
}

function showAdminError(msg) {
    var el = document.getElementById('aln-error');
    el.textContent = msg; el.style.display = 'block';
}

async function adminLogout() {
    if (adminClient) await adminClient.auth.signOut();
    document.getElementById('admin-dashboard').classList.add('hidden');
    document.getElementById('admin-login-screen').style.display = 'flex';
    adminUserId = null;
    document.getElementById('aln-btn').textContent = 'Sign In';
    document.getElementById('aln-btn').disabled = false;
}

function adminTogglePw(btn) {
    var inp = document.getElementById('aln-password');
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
    else { inp.type = 'password'; btn.textContent = '👁'; }
}

// ── Dashboard ─────────────────────────────────────────────────────────────
function showAdminDashboard(email) {
    document.getElementById('admin-login-screen').style.display = 'none';
    document.getElementById('admin-dashboard').classList.remove('hidden');
    document.getElementById('asb-admin-name').textContent = email || 'Admin';
    document.getElementById('last-refresh-ts').textContent = 'Loading...';
    adminNav('overview');
}

function adminNav(section) {
    var sections = ['overview', 'users', 'focus', 'audit', 'inbox', 'metrics'];
    sections.forEach(function(s) {
        var sec = document.getElementById('sec-' + s);
        var btn = document.getElementById('anav-' + s);
        if (sec) sec.classList.toggle('hidden', s !== section);
        if (btn) btn.classList.toggle('active', s === section);
    });
    if (section === 'overview') loadOverview();
    if (section === 'users')    loadUsersTable();
    if (section === 'focus')    loadFocusAnalytics();
    if (section === 'audit')    loadAuditLog();
    if (section === 'inbox')    loadInbox();
    if (section === 'metrics')  loadMetrics();
}

// ── Overview ─────────────────────────────────────────────────────────────
async function loadOverview() {
    try {
        var [profiles, plans, yearData] = await Promise.all([
            adminClient.from('upsc_user_profiles').select('user_id,display_name,is_locked,created_at,last_active,optional_subject'),
            adminClient.from('upsc_custom_plans').select('user_id'),
            adminClient.from('upsc_focus_year_data').select('user_id,year,data')
        ]);

        var users   = profiles.data || [];
        var allPlans = plans.data   || [];
        var focusRows = yearData.data || [];

        var now = new Date();
        var sevenDaysAgo = new Date(now - 7 * 86400000);
        var monthStart   = new Date(now.getFullYear(), now.getMonth(), 1);

        var totalHours = 0;
        focusRows.forEach(function(row) {
            var d = row.data || {};
            Object.values(d).forEach(function(v) { totalHours += (v.h || 0) + (v.m || 0) / 60; });
        });

        var active7d = users.filter(function(u) {
            return u.last_active && new Date(u.last_active) >= sevenDaysAgo;
        }).length;

        var newMonth = users.filter(function(u) {
            return u.created_at && new Date(u.created_at) >= monthStart;
        }).length;

        var locked = users.filter(function(u) { return u.is_locked; }).length;

        document.getElementById('m-total-users').textContent = users.length;
        document.getElementById('m-active-7d').textContent   = active7d;
        document.getElementById('m-total-hours').textContent = Math.round(totalHours) + 'h';
        document.getElementById('m-total-plans').textContent = allPlans.length;
        document.getElementById('m-locked').textContent      = locked;
        document.getElementById('m-new-month').textContent   = newMonth;
        document.getElementById('last-refresh-ts').textContent = 'Refreshed: ' + new Date().toLocaleTimeString();

        // Top studiers
        var hoursPerUser = {};
        focusRows.forEach(function(row) {
            var hrs = 0;
            Object.values(row.data || {}).forEach(function(v) { hrs += (v.h || 0) + (v.m || 0) / 60; });
            hoursPerUser[row.user_id] = (hoursPerUser[row.user_id] || 0) + hrs;
        });
        var sorted = Object.entries(hoursPerUser).sort(function(a,b) { return b[1]-a[1]; }).slice(0,5);
        var listEl = document.getElementById('top-studiers-list');
        if (sorted.length === 0) { listEl.innerHTML = '<div class="a-empty">No focus data yet.</div>'; return; }
        listEl.innerHTML = sorted.map(function(pair, i) {
            var uid = pair[0], hrs = Math.round(pair[1] * 10) / 10;
            var prof = users.find(function(u) { return u.user_id === uid; });
            var name = prof ? (prof.display_name || 'User') : uid.slice(0,8)+'...';
            return '<div class="atop-row">'
                + '<span class="atop-rank">' + (i+1) + '</span>'
                + '<span class="atop-name">' + escAdmin(name) + '</span>'
                + '<span class="atop-hrs">' + hrs + ' hrs</span>'
                + '</div>';
        }).join('');
    } catch(e) { console.error('[Admin] overview:', e); }
}

// ── Users table ───────────────────────────────────────────────────────────
async function loadUsersTable() {
    document.getElementById('users-tbody').innerHTML = '<tr><td colspan="9" class="a-empty">Loading...</td></tr>';
    try {
        var [profiles, plans, yearData] = await Promise.all([
            adminClient.from('upsc_user_profiles').select('*').order('created_at', { ascending: false }),
            adminClient.from('upsc_custom_plans').select('user_id'),
            adminClient.from('upsc_focus_year_data').select('user_id,data')
        ]);
        _allUsersCache = profiles.data || [];
        var allPlans   = plans.data    || [];
        var focusRows  = yearData.data || [];

        var planCounts = {};
        allPlans.forEach(function(p) { planCounts[p.user_id] = (planCounts[p.user_id] || 0) + 1; });

        var hoursPerUser = {};
        focusRows.forEach(function(row) {
            var hrs = 0;
            Object.values(row.data || {}).forEach(function(v) { hrs += (v.h || 0) + (v.m || 0) / 60; });
            hoursPerUser[row.user_id] = (hoursPerUser[row.user_id] || 0) + hrs;
        });

        renderUsersTable(_allUsersCache, planCounts, hoursPerUser);
    } catch(e) {
        document.getElementById('users-tbody').innerHTML = '<tr><td colspan="9" class="a-empty">Error: ' + e.message + '</td></tr>';
    }
}

function renderUsersTable(users, planCounts, hoursPerUser) {
    planCounts   = planCounts   || {};
    hoursPerUser = hoursPerUser || {};
    var tbody = document.getElementById('users-tbody');
    if (!users.length) { tbody.innerHTML = '<tr><td colspan="9" class="a-empty">No users found.</td></tr>'; return; }
    tbody.innerHTML = users.map(function(u) {
        var initials = (u.display_name || 'U').slice(0,2).toUpperCase();
        var hrs = Math.round((hoursPerUser[u.user_id] || 0) * 10) / 10;
        var plans = planCounts[u.user_id] || 0;
        var locked = u.is_locked;
        var statusBadge = locked
            ? '<span class="a-badge a-badge-red">Locked</span>'
            : '<span class="a-badge a-badge-green">Active</span>';
        if (u.is_admin) statusBadge += '<span class="a-badge a-badge-purple">Admin</span>';
        var joined = u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) : '—';
        var lastActive = u.last_active ? agoString(new Date(u.last_active)) : '—';
        var optional = u.optional_subject_custom || u.optional_subject || '—';
        return '<tr data-uid="' + u.user_id + '">'
            + '<td><div class="a-user-cell"><div class="a-avatar">' + escAdmin(initials) + '</div><div class="a-user-name">' + escAdmin(u.display_name || 'Unnamed') + '</div></div></td>'
            + '<td class="a-muted">' + escAdmin(u.email || '—') + '</td>'
            + '<td class="a-muted">' + joined + '</td>'
            + '<td class="a-muted">' + lastActive + '</td>'
            + '<td><strong>' + hrs + 'h</strong></td>'
            + '<td>' + plans + '</td>'
            + '<td class="a-muted" style="font-size:0.68rem;">' + escAdmin(optional !== 'none' ? optional : '—') + '</td>'
            + '<td>' + statusBadge + '</td>'
            + '<td><button class="a-btn-sm" onclick="openUserModal(\'' + u.user_id + '\')">View</button> <button class="a-btn-sm" onclick="adminOpenUserSettings(\'' + u.user_id + '\',\'' + escAdmin(u.display_name||'User').replace(/'/g,"\\'") + '\')" style="margin-left:3px;">⚙</button></td>'
            + '</tr>';
    }).join('');
}

function filterUsersTable() {
    var q = (document.getElementById('user-search').value || '').toLowerCase();
    var rows = document.querySelectorAll('#users-tbody tr');
    rows.forEach(function(tr) {
        var txt = tr.textContent.toLowerCase();
        tr.style.display = txt.includes(q) ? '' : 'none';
    });
}

// ── User Modal ─────────────────────────────────────────────────────────────
async function openUserModal(userId) {
    adminCurrentUser = _allUsersCache.find(function(u) { return u.user_id === userId; });
    if (!adminCurrentUser) return;
    var u = adminCurrentUser;
    var initials = (u.display_name || 'U').slice(0,2).toUpperCase();
    document.getElementById('um-avatar').textContent   = initials;
    document.getElementById('um-name').textContent     = u.display_name || 'Unnamed';
    document.getElementById('um-email').textContent    = u.email || '—';
    document.getElementById('um-age').textContent      = u.age || '—';
    document.getElementById('um-attempt').textContent  = u.attempt || '—';
    document.getElementById('um-optional').textContent = u.optional_subject_custom || u.optional_subject || '—';
    document.getElementById('um-joined').textContent   = u.created_at ? new Date(u.created_at).toLocaleDateString('en-IN') : '—';
    document.getElementById('um-last-active').textContent = u.last_active ? new Date(u.last_active).toLocaleDateString('en-IN') : '—';

    // Study hours
    try {
        var yr = await adminClient.from('upsc_focus_year_data').select('data').eq('user_id', userId);
        var hrs = 0;
        (yr.data || []).forEach(function(row) {
            Object.values(row.data || {}).forEach(function(v) { hrs += (v.h || 0) + (v.m || 0) / 60; });
        });
        document.getElementById('um-study-hrs').textContent = Math.round(hrs * 10) / 10 + ' hrs';
    } catch(e) { document.getElementById('um-study-hrs').textContent = '—'; }

    // Feature toggles — ai_chat OFF by default for all users
    var feats = u.features_enabled || { focus: true, plans: true, ai_chat: false, pyq: true, sources: true };
    var featLabels = { focus: '⏱ Focus', plans: '📅 Plans', ai_chat: '🤖 AI Chat', pyq: '📖 PYQ', sources: '📚 Sources' };
    var featHtml = Object.entries(featLabels).map(function(pair) {
        var key = pair[0], label = pair[1];
        var enabled = feats[key] !== false;
        return '<div class="um-feat-row">'
            + '<span class="um-feat-label">' + label + '</span>'
            + '<label class="ns-toggle"><input type="checkbox" id="um-feat-' + key + '" '
            + (enabled ? 'checked' : '') + ' onchange="adminSaveFeature(\'' + key + '\',this.checked)">'
            + '<span class="ns-slider"></span></label></div>';
    }).join('');
    document.getElementById('um-features').innerHTML = featHtml;

    // Lock status
    var lockBtn  = document.getElementById('um-lock-btn');
    var lockStat = document.getElementById('um-lock-status');
    if (u.is_locked) {
        lockStat.innerHTML = '<span style="color:#f87171;">Locked' + (u.locked_reason ? ': ' + escAdmin(u.locked_reason) : '') + '</span>';
        lockBtn.textContent = 'Unlock';
        lockBtn.className   = 'a-btn-success';
    } else {
        lockStat.textContent = 'User is currently active';
        lockBtn.textContent  = 'Lock';
        lockBtn.className    = 'a-btn-danger';
    }

    // Plans
    try {
        var plRes = await adminClient.from('upsc_custom_plans').select('plan_title,plan_type,plan_category,start_date,end_date').eq('user_id', userId).order('start_date', { ascending: false });
        var plData = plRes.data || [];
        document.getElementById('um-plan-count').textContent = plData.length;
        document.getElementById('um-plans-list').innerHTML = plData.length === 0
            ? '<div class="a-empty" style="padding:0.5rem 0;">No plans yet.</div>'
            : plData.map(function(p) {
                return '<div class="um-plan-row"><strong>' + escAdmin(p.plan_title) + '</strong>'
                    + ' <span class="a-badge a-badge-gray">' + escAdmin(p.plan_type || '') + '</span>'
                    + ' <span class="a-badge a-badge-indigo">' + escAdmin(p.plan_category || 'common') + '</span>'
                    + (p.start_date ? ' <span class="a-muted" style="font-size:0.65rem;">' + p.start_date + '</span>' : '')
                    + '</div>';
            }).join('');
    } catch(e) {}

    document.getElementById('user-modal').classList.remove('hidden');
}

function closeUserModal() {
    document.getElementById('user-modal').classList.add('hidden');
    adminCurrentUser = null;
}

async function adminToggleLock() {
    if (!adminCurrentUser) return;
    var u       = adminCurrentUser;
    var toLock  = !u.is_locked;
    var reason  = toLock ? (document.getElementById('um-lock-reason').value.trim() || null) : null;
    var payload = { is_locked: toLock, locked_at: toLock ? new Date().toISOString() : null, locked_reason: reason };
    try {
        await adminClient.from('upsc_user_profiles').update(payload).eq('user_id', u.user_id);
        await adminAuditLog(toLock ? 'lock_user' : 'unlock_user', u.user_id, { reason: reason });
        // Refresh cache entry
        var idx = _allUsersCache.findIndex(function(x) { return x.user_id === u.user_id; });
        if (idx >= 0) { _allUsersCache[idx] = Object.assign({}, _allUsersCache[idx], payload, { locked_reason: reason }); adminCurrentUser = _allUsersCache[idx]; }
        // Update button
        var lockBtn  = document.getElementById('um-lock-btn');
        var lockStat = document.getElementById('um-lock-status');
        if (toLock) {
            lockStat.innerHTML = '<span style="color:#f87171;">Locked' + (reason ? ': ' + escAdmin(reason) : '') + '</span>';
            lockBtn.textContent = 'Unlock'; lockBtn.className = 'a-btn-success';
        } else {
            lockStat.textContent = 'User is currently active';
            lockBtn.textContent = 'Lock'; lockBtn.className = 'a-btn-danger';
        }
        showAdminToast(toLock ? 'User locked' : 'User unlocked', toLock ? 'warning' : 'success');
    } catch(e) { showAdminToast('Error: ' + e.message, 'error'); }
}

async function adminSaveFeature(key, value) {
    if (!adminCurrentUser) return;
    var u    = adminCurrentUser;
    var feats = Object.assign({}, u.features_enabled || { focus: true, plans: true, ai_chat: false, pyq: true, sources: true });
    feats[key] = value;
    try {
        await adminClient.from('upsc_user_profiles').update({ features_enabled: feats }).eq('user_id', u.user_id);
        await adminAuditLog('toggle_feature', u.user_id, { feature: key, value: value });
        var idx = _allUsersCache.findIndex(function(x) { return x.user_id === u.user_id; });
        if (idx >= 0) _allUsersCache[idx].features_enabled = feats;
        if (adminCurrentUser.user_id === u.user_id) adminCurrentUser.features_enabled = feats;
        showAdminToast('Feature updated', 'success');
    } catch(e) { showAdminToast('Error: ' + e.message, 'error'); }
}

// ── Focus Analytics ───────────────────────────────────────────────────────
async function loadFocusAnalytics() {
    try {
        var res = await adminClient.from('upsc_focus_year_data').select('user_id,year,data');
        var rows = res.data || [];
        var today     = new Date(); today.setHours(0,0,0,0);
        var todayStr  = today.toISOString().slice(0,10);
        var weekStart = new Date(today - 6 * 86400000);
        var monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        var totToday = 0, totWeek = 0, totMonth = 0, userDays = {}, userHrs = {};

        rows.forEach(function(row) {
            var uid = row.user_id;
            Object.entries(row.data || {}).forEach(function(pair) {
                var dateStr = pair[0], v = pair[1];
                var d = new Date(dateStr); d.setHours(0,0,0,0);
                var hrs = (v.h || 0) + (v.m || 0) / 60;
                if (dateStr === todayStr) totToday += hrs;
                if (d >= weekStart)  totWeek  += hrs;
                if (d >= monthStart) totMonth += hrs;
                userDays[uid] = (userDays[uid] || new Set()).add(dateStr);
                userHrs[uid]  = (userHrs[uid]  || 0) + hrs;
            });
        });

        var totalDaysAll = Object.values(userDays).reduce(function(s, set) { return s + set.size; }, 0);
        var avgDaily = (Object.keys(userHrs).length > 0 && totalDaysAll > 0)
            ? (Object.values(userHrs).reduce(function(a,b){return a+b;},0) / totalDaysAll) : 0;

        document.getElementById('fa-today').textContent = Math.round(totToday * 10) / 10 + 'h';
        document.getElementById('fa-week').textContent  = Math.round(totWeek  * 10) / 10 + 'h';
        document.getElementById('fa-month').textContent = Math.round(totMonth * 10) / 10 + 'h';
        document.getElementById('fa-avg-daily').textContent = Math.round(avgDaily * 10) / 10 + 'h';

        // Per-user grid
        var profs = _allUsersCache.length ? _allUsersCache : (await adminClient.from('upsc_user_profiles').select('user_id,display_name')).data || [];
        var gridEl = document.getElementById('focus-user-grid');
        var sorted = Object.entries(userHrs).sort(function(a,b){return b[1]-a[1];});
        gridEl.innerHTML = sorted.map(function(pair) {
            var uid = pair[0], hrs = Math.round(pair[1]*10)/10;
            var prof = profs.find(function(p){return p.user_id===uid;});
            var name = prof ? (prof.display_name || 'User') : uid.slice(0,8)+'...';
            var days = userDays[uid] ? userDays[uid].size : 0;
            var avg  = days > 0 ? Math.round(hrs / days * 10) / 10 : 0;
            return '<div class="fug-card">'
                + '<div class="fug-name">' + escAdmin(name) + '</div>'
                + '<div class="fug-hrs">' + hrs + 'h total</div>'
                + '<div class="fug-meta">' + days + ' study days · ' + avg + 'h avg/day</div>'
                + '</div>';
        }).join('') || '<div class="a-empty">No focus data yet.</div>';
    } catch(e) { console.error('[Admin] focus analytics:', e); }
}

// ── Audit Log ─────────────────────────────────────────────────────────────
async function loadAuditLog() {
    document.getElementById('audit-tbody').innerHTML = '<tr><td colspan="4" class="a-empty">Loading...</td></tr>';
    try {
        var res = await adminClient.from('upsc_admin_audit_log').select('*').order('performed_at', { ascending: false }).limit(100);
        var logs = res.data || [];
        if (!logs.length) { document.getElementById('audit-tbody').innerHTML = '<tr><td colspan="4" class="a-empty">No audit entries yet.</td></tr>'; return; }
        var profs = _allUsersCache.length ? _allUsersCache : [];
        document.getElementById('audit-tbody').innerHTML = logs.map(function(l) {
            var target = profs.find(function(p){return p.user_id===l.target_user_id;});
            var targetName = target ? (target.display_name || target.email || l.target_user_id) : (l.target_user_id ? l.target_user_id.slice(0,8)+'...' : '—');
            var ts = l.performed_at ? new Date(l.performed_at).toLocaleString('en-IN') : '—';
            var action = l.action || '—';
            var details = l.details ? JSON.stringify(l.details) : '—';
            var actionClass = action.includes('lock') ? 'a-badge-red' : action.includes('unlock') ? 'a-badge-green' : 'a-badge-indigo';
            return '<tr><td class="a-muted" style="font-size:0.68rem;white-space:nowrap;">' + ts + '</td>'
                + '<td><span class="a-badge ' + actionClass + '">' + escAdmin(action) + '</span></td>'
                + '<td>' + escAdmin(targetName) + '</td>'
                + '<td class="a-muted" style="font-size:0.65rem;">' + escAdmin(details) + '</td></tr>';
        }).join('');
    } catch(e) { document.getElementById('audit-tbody').innerHTML = '<tr><td colspan="4" class="a-empty">Error: ' + e.message + '</td></tr>'; }
}

async function adminAuditLog(action, targetUserId, details) {
    try {
        await adminClient.from('upsc_admin_audit_log').insert({
            admin_user_id:  adminUserId,
            action:         action,
            target_user_id: targetUserId,
            details:        details || {},
            performed_at:   new Date().toISOString()
        });
    } catch(e) { console.warn('[Admin] audit write:', e.message); }
}

// ── Helpers ───────────────────────────────────────────────────────────────
function escAdmin(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function agoString(date) {
    var diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60)     return 'just now';
    if (diff < 3600)   return Math.floor(diff/60) + 'm ago';
    if (diff < 86400)  return Math.floor(diff/3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff/86400) + 'd ago';
    return date.toLocaleDateString('en-IN', {day:'2-digit',month:'short'});
}

var _adminToastTimer = null;
function showAdminToast(msg, type) {
    var el = document.getElementById('admin-toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'admin-toast';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = 'admin-toast admin-toast-' + (type || 'info');
    el.style.display = 'block';
    if (_adminToastTimer) clearTimeout(_adminToastTimer);
    _adminToastTimer = setTimeout(function() { el.style.display = 'none'; }, 3000);
}

// ── Inbox: Messages & Monthly Feedback ───────────────────────────────────

// Repository pattern: cached inbox data with TTL
var _inboxCache = { msgs: null, feedback: null, ts: 0 };
var _inboxActiveUser = null; // currently open conversation
var INBOX_TTL = 60000;

async function loadInbox() {
    var el = document.getElementById('inbox-content');
    if (!el) el = document.getElementById('sec-inbox');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--t3);font-family:var(--mono);font-size:0.72rem;padding:1rem;">Loading inbox…</div>';

    var now = Date.now();
    if (_inboxCache.ts && (now - _inboxCache.ts) < INBOX_TTL && _inboxCache.msgs) {
        if (_inboxActiveUser) _renderConversation(_inboxActiveUser);
        else _renderUserList(_inboxCache.msgs, _inboxCache.feedback);
        return;
    }

    try {
        var [msgsRes, fbRes] = await Promise.all([
            adminClient.from('upsc_messages').select('*').order('created_at', { ascending: true }),
            adminClient.from('upsc_feedback').select('*').order('created_at', { ascending: false })
        ]);
        _inboxCache = { msgs: msgsRes.data || [], feedback: fbRes.data || [], ts: Date.now() };
        if (_inboxActiveUser) _renderConversation(_inboxActiveUser);
        else _renderUserList(_inboxCache.msgs, _inboxCache.feedback);
    } catch(e) {
        if (el) el.innerHTML = '<div style="color:#f87171;font-family:var(--mono);font-size:0.72rem;padding:1rem;">Error: ' + (e.message||'Could not load') + '</div>';
    }
}

/* ── User List View ── */
function _renderUserList(msgs, feedback) {
    var el = document.getElementById('inbox-content');
    if (!el) return;

    function fmtDate(d) { return d ? new Date(d).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : ''; }

    // Build user map from ROOT messages only
    var userMap = {};
    msgs.forEach(function(m) {
        if (m.thread_id) return; // skip replies
        if (!userMap[m.user_id]) userMap[m.user_id] = { uid: m.user_id, name: m.display_name||'User', msgs:[], last:null };
        userMap[m.user_id].msgs.push(m);
        userMap[m.user_id].last = m.created_at;
    });
    // Count unread admin replies per user (admin msgs not yet read)
    var unreadMap = {};
    msgs.forEach(function(m) {
        if (m.sender_type === 'admin' && !m.is_read) {
            unreadMap[m.user_id] = (unreadMap[m.user_id]||0)+1;
        }
    });

    var users = Object.values(userMap).sort(function(a,b){ return new Date(b.last)-new Date(a.last); });

    var refreshBtn = '<button onclick="_inboxCache.ts=0;_inboxActiveUser=null;loadInbox()" style="float:right;background:var(--surf);border:1px solid var(--bdr);color:var(--t2);border-radius:0.4rem;padding:0.2rem 0.65rem;font-size:0.6rem;font-family:var(--mono);cursor:pointer;">⟳ Refresh</button>';

    var html = '<div style="padding:0.75rem 0;">' + refreshBtn + '<div style="clear:both;margin-bottom:0.75rem;"></div>';

    // Section: Users with messages
    html += '<h3 style="font-size:0.75rem;font-weight:800;color:var(--t1);margin-bottom:0.65rem;font-family:var(--mono);">💬 Conversations (' + users.length + ' users)</h3>';
    if (!users.length) {
        html += '<p style="color:var(--t3);font-size:0.7rem;font-family:var(--mono);padding:0.5rem 0;">No messages yet.</p>';
    } else {
        users.forEach(function(u) {
            var lastMsg = u.msgs[u.msgs.length-1];
            var unread = unreadMap[u.uid] || 0;
            var initials = u.name.split(' ').map(function(w){return w[0]||'';}).join('').substr(0,2).toUpperCase();
            html += '<div onclick="adminOpenConversation(\''+u.uid+'\')" style="display:flex;align-items:center;gap:0.75rem;padding:0.65rem 0.85rem;border:1px solid var(--bdr);border-radius:0.7rem;margin-bottom:0.5rem;cursor:pointer;background:var(--surf);transition:background 0.15s;" onmouseover="this.style.background=\'var(--card)\'" onmouseout="this.style.background=\'var(--surf)\'">';
            html += '<div style="width:2.2rem;height:2.2rem;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:900;color:#fff;flex-shrink:0;">'+initials+'</div>';
            html += '<div style="flex:1;min-width:0;">';
            html += '<div style="font-size:0.72rem;font-weight:700;color:var(--t1);font-family:var(--mono);">'+_adminEsc(u.name)+'</div>';
            html += '<div style="font-size:0.62rem;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+_adminEsc((lastMsg.content||'').substr(0,60))+'</div>';
            html += '</div>';
            html += '<div style="text-align:right;flex-shrink:0;">';
            html += '<div style="font-size:0.58rem;color:var(--t4);font-family:var(--mono);">'+fmtDate(lastMsg.created_at)+'</div>';
            html += '<div style="font-size:0.62rem;color:var(--t3);font-family:var(--mono);margin-top:0.15rem;">'+u.msgs.length+' msg(s)</div>';
            html += '</div>';
            html += '</div>';
        });
    }

    // Section: Feedback
    html += '<h3 style="font-size:0.75rem;font-weight:800;color:var(--t1);margin:1rem 0 0.65rem;font-family:var(--mono);">📝 Monthly Feedback (' + feedback.length + ')</h3>';
    if (!feedback.length) {
        html += '<p style="color:var(--t3);font-size:0.7rem;font-family:var(--mono);">No feedback submitted yet.</p>';
    } else {
        var byMonth = {};
        feedback.forEach(function(f){ if(!byMonth[f.month_key])byMonth[f.month_key]=[];byMonth[f.month_key].push(f); });
        Object.keys(byMonth).sort().reverse().forEach(function(mk) {
            html += '<div style="border:1px solid var(--bdr);border-radius:0.65rem;margin-bottom:0.5rem;overflow:hidden;">';
            html += '<div style="background:var(--surf);padding:0.45rem 0.8rem;font-size:0.7rem;font-weight:700;color:var(--accent-l);font-family:var(--mono);">📅 '+mk+' ('+byMonth[mk].length+' submissions)</div>';
            byMonth[mk].forEach(function(f){
                var stars = f.rating ? '⭐'.repeat(f.rating) : '';
                html += '<div style="padding:0.5rem 0.8rem;border-top:1px solid var(--bdr);">';
                html += '<div style="display:flex;justify-content:space-between;margin-bottom:0.2rem;">';
                html += '<span style="font-size:0.68rem;font-weight:700;color:var(--t1);font-family:var(--mono);">👤 '+_adminEsc(f.display_name||'User')+'</span>';
                html += '<span style="font-size:0.65rem;">'+stars+'</span></div>';
                html += '<div style="font-size:0.7rem;color:var(--t2);">'+_adminEsc(f.content)+'</div></div>';
            });
            html += '</div>';
        });
    }
    html += '</div>';
    el.innerHTML = html;
}

/* ── Conversation View ── */
function adminOpenConversation(uid) {
    _inboxActiveUser = uid;
    _renderConversation(uid);
}

function _renderConversation(uid) {
    var el = document.getElementById('inbox-content');
    if (!el) return;
    var allMsgs = _inboxCache.msgs || [];

    // Get all root messages for this user
    var roots = allMsgs.filter(function(m){ return m.user_id===uid && !m.thread_id; });
    // Get all replies
    var replies = allMsgs.filter(function(m){ return m.user_id===uid && m.thread_id; });
    // Build thread tree
    var threads = {};
    roots.forEach(function(m){ threads[m.id] = { root: m, replies: [] }; });
    replies.forEach(function(r){ if(threads[r.thread_id]) threads[r.thread_id].replies.push(r); });

    var userName = roots.length ? (roots[0].display_name||'User') : uid.substr(0,8)+'…';

    function fmtDate(d) { return d ? new Date(d).toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : ''; }
    function bubble(m, isReply) {
        var isAdmin = m.sender_type==='admin';
        var align = isAdmin ? 'flex-end' : 'flex-start';
        var bg = isAdmin ? 'rgba(99,102,241,0.18)' : 'var(--surf)';
        var bc = isAdmin ? 'rgba(99,102,241,0.4)' : 'var(--bdr)';
        var label = isAdmin ? '🛡 Admin' : '👤 '+_adminEsc(m.display_name||'User');
        return '<div style="display:flex;justify-content:'+align+';margin-bottom:0.45rem;'+(isReply?'padding-left:1rem;':'')+'"><div style="max-width:80%;background:'+bg+';border:1px solid '+bc+';border-radius:0.65rem;padding:0.45rem 0.7rem;">'
            +'<div style="font-size:0.58rem;font-weight:700;color:'+(isAdmin?'#818cf8':'var(--t3)')+';font-family:var(--mono);margin-bottom:0.15rem;">'+label+' &nbsp;·&nbsp; '+fmtDate(m.created_at)+'</div>'
            +'<div style="font-size:0.72rem;color:var(--t1);white-space:pre-wrap;line-height:1.5;">'+_adminEsc(m.content)+'</div>'
            +'</div></div>';
    }

    var chatHtml = '';
    Object.values(threads).sort(function(a,b){ return new Date(a.root.created_at)-new Date(b.root.created_at); }).forEach(function(t){
        chatHtml += bubble(t.root, false);
        t.replies.sort(function(a,b){ return new Date(a.created_at)-new Date(b.created_at); }).forEach(function(r){ chatHtml += bubble(r, true); });
    });
    if (!chatHtml) chatHtml = '<p style="color:var(--t3);font-size:0.65rem;text-align:center;padding:1rem;">No messages yet.</p>';

    // Reply input
    var replyHtml = '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">'
        +'<textarea id="conv-reply-text" rows="2" placeholder="Type reply…" style="flex:1;background:var(--inp);border:1px solid var(--bdr);border-radius:0.45rem;padding:0.4rem 0.6rem;font-size:0.72rem;color:var(--t1);font-family:var(--mono);resize:none;box-sizing:border-box;"></textarea>'
        +'<button onclick="adminSendConvReply(\''+uid+'\')" style="background:#6366f1;border:none;color:#fff;border-radius:0.45rem;padding:0.4rem 0.85rem;font-size:0.68rem;font-weight:700;cursor:pointer;flex-shrink:0;">Send ↑</button>'
        +'</div>'
        +'<div id="conv-reply-status" style="font-size:0.6rem;color:var(--t3);font-family:var(--mono);min-height:0.8rem;margin-top:0.2rem;"></div>';

    el.innerHTML = '<div style="padding:0.75rem 0;">'
        +'<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;">'
        +'<button onclick="_inboxActiveUser=null;loadInbox()" style="background:var(--surf);border:1px solid var(--bdr);color:var(--t2);border-radius:0.4rem;padding:0.2rem 0.65rem;font-size:0.65rem;font-family:var(--mono);cursor:pointer;">← Back</button>'
        +'<span style="font-size:0.78rem;font-weight:800;color:var(--t1);font-family:var(--mono);">💬 '+_adminEsc(userName)+'</span>'
        +'</div>'
        +'<div id="conv-bubbles" style="max-height:55vh;overflow-y:auto;border:1px solid var(--bdr);border-radius:0.65rem;padding:0.65rem;background:var(--bg);margin-bottom:0.5rem;scrollbar-width:thin;">'+chatHtml+'</div>'
        + replyHtml
        +'</div>';
    var bd = document.getElementById('conv-bubbles');
    if (bd) bd.scrollTop = bd.scrollHeight;
}

/* ── Reply from conversation view ── */
async function adminSendConvReply(uid) {
    var ta = document.getElementById('conv-reply-text');
    var st = document.getElementById('conv-reply-status');
    var txt = ta && ta.value.trim();
    if (!txt) return;
    if (st) { st.textContent='Sending…'; st.style.color='var(--t3)'; }

    // Find the latest root message from this user to reply to
    var allMsgs = _inboxCache.msgs || [];
    var userRoots = allMsgs.filter(function(m){ return m.user_id===uid && !m.thread_id && m.sender_type==='user'; });
    if (!userRoots.length) { if(st){st.textContent='No message to reply to.';st.style.color='#f87171';} return; }
    var targetId = userRoots[userRoots.length-1].id; // reply to latest

    try {
        var res = await adminClient.from('upsc_messages').insert({
            user_id:     uid,
            display_name:'Admin',
            content:     txt,
            sender_type: 'admin',
            thread_id:   targetId,
            is_read:     false
        });
        if (res.error) throw res.error;
        if (ta) ta.value = '';
        if (st) { st.textContent='✓ Sent'; st.style.color='#10b981'; setTimeout(function(){if(st)st.textContent='';},2000); }
        _inboxCache.ts = 0; // invalidate
        await loadInbox();
    } catch(e) {
        if (st) { st.textContent = e.message||'Error'; st.style.color='#f87171'; }
    }
}

function _adminEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _adminEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Admin Chat Reply ──────────────────────────────────────────────────────
var _adminReplyTarget = null;

function adminOpenReply(msgId, userName) {
    _adminReplyTarget = msgId;
    var modal = document.getElementById('admin-reply-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'admin-reply-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:1rem;';
        modal.innerHTML = '<div style="background:var(--bg2,#1e1b4b);border:1px solid var(--bdr,#4f46e5);border-radius:1rem;padding:1.25rem;width:min(480px,95vw);"><h3 style="font-size:0.85rem;font-weight:800;color:#f0eeff;margin-bottom:0.75rem;">Reply to <span id="reply-user-name"></span></h3><textarea id="admin-reply-text" rows="4" placeholder="Type your reply..." style="width:100%;background:#0f0c2e;border:1px solid #4f46e5;border-radius:0.5rem;padding:0.6rem;font-size:0.75rem;color:#f0eeff;font-family:monospace;resize:vertical;outline:none;box-sizing:border-box;"></textarea><div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.65rem;"><button onclick="document.getElementById(\'admin-reply-modal\').remove();_adminReplyTarget=null;" style="background:none;border:1px solid #4f46e5;color:#a08ed8;border-radius:0.4rem;padding:0.35rem 0.75rem;font-size:0.65rem;cursor:pointer;">Cancel</button><button onclick="adminSendReply()" style="background:#6366f1;border:none;color:#fff;border-radius:0.4rem;padding:0.35rem 0.9rem;font-size:0.65rem;font-weight:700;cursor:pointer;">Send Reply</button></div></div>';
        document.body.appendChild(modal);
    }
    modal.style.display = 'flex';
    var nameEl = document.getElementById('reply-user-name');
    if (nameEl) nameEl.textContent = userName;
    var ta = document.getElementById('admin-reply-text');
    if (ta) { ta.value = ''; ta.focus(); }
}

async function adminSendReply() {
    var ta = document.getElementById('admin-reply-text');
    var txt = ta && ta.value.trim();
    if (!txt) return;
    try {
        // Get user_id of the target message
        var msgR = await adminClient.from('upsc_messages').select('user_id,display_name').eq('id', _adminReplyTarget).single();
        if (msgR.error) throw msgR.error;
        var res = await adminClient.from('upsc_messages').insert({
            user_id:     msgR.data.user_id,
            display_name:'Admin',
            content:     txt,
            sender_type: 'admin',
            thread_id:   _adminReplyTarget
        });
        if (res.error) throw res.error;
        document.getElementById('admin-reply-modal').remove();
        _adminReplyTarget = null;
        _inboxCache.ts = 0;
        loadInbox();
        adminToast('Reply sent!');
    } catch(e) { adminToast('Error: ' + (e.message||'failed'), 'error'); }
}

// ── User Settings (feature flags + daily limit) ───────────────────────────
var _userSettingsCache = {};

async function adminOpenUserSettings(userId, displayName) {
    var settings = { daily_msg_limit: 3, features: { plans:true,tracker:true,pyq:true,ca:true,focus:true,ai:true }, notes: '' };
    try {
        var r = await adminClient.from('upsc_user_settings').select('*').eq('user_id', userId).maybeSingle();
        if (r.data) settings = Object.assign(settings, r.data);
    } catch(e) {}
    _userSettingsCache[userId] = settings;

    var feats = settings.features || {};
    var featHtml = ['plans','tracker','pyq','ca','focus','ai'].map(function(f) {
        var on = feats[f] !== false;
        return '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.7rem;color:#d4c8f8;cursor:pointer;">'
            + '<input type="checkbox" id="uf-'+f+'" '+(on?'checked':'')+'> '
            + f.charAt(0).toUpperCase()+f.slice(1)+'</label>';
    }).join('');

    var modal = document.getElementById('user-settings-modal') || document.createElement('div');
    modal.id = 'user-settings-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.innerHTML = '<div style="background:var(--bg2,#1e1b4b);border:1px solid var(--bdr,#4f46e5);border-radius:1rem;padding:1.25rem;width:min(420px,95vw);">'
        + '<h3 style="font-size:0.85rem;font-weight:800;color:#f0eeff;margin-bottom:0.75rem;">⚙ Settings: <span style="color:#818cf8">'+_adminEsc(displayName)+'</span></h3>'
        + '<label style="font-size:0.65rem;color:#a08ed8;font-family:monospace;display:block;margin-bottom:0.3rem;">Daily Message Limit</label>'
        + '<input id="us-msg-limit" type="number" min="0" max="100" value="'+settings.daily_msg_limit+'" style="width:100%;background:#0f0c2e;border:1px solid #4f46e5;border-radius:0.4rem;padding:0.4rem 0.6rem;font-size:0.78rem;color:#f0eeff;margin-bottom:0.75rem;box-sizing:border-box;">'
        + '<div style="font-size:0.65rem;color:#a08ed8;font-family:monospace;margin-bottom:0.4rem;">Feature Flags</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;margin-bottom:0.75rem;">'+featHtml+'</div>'
        + '<label style="font-size:0.65rem;color:#a08ed8;font-family:monospace;display:block;margin-bottom:0.3rem;">Admin Notes (internal)</label>'
        + '<textarea id="us-notes" rows="2" style="width:100%;background:#0f0c2e;border:1px solid #4f46e5;border-radius:0.4rem;padding:0.4rem 0.6rem;font-size:0.72rem;color:#f0eeff;resize:none;box-sizing:border-box;margin-bottom:0.75rem;">'+_adminEsc(settings.notes||'')+'</textarea>'
        + '<div style="display:flex;gap:0.5rem;justify-content:flex-end;">'
        + '<button onclick="document.getElementById(\'user-settings-modal\').remove()" style="background:none;border:1px solid #4f46e5;color:#a08ed8;border-radius:0.4rem;padding:0.35rem 0.75rem;font-size:0.65rem;cursor:pointer;">Cancel</button>'
        + '<button onclick="adminSaveUserSettings(\''+userId+'\')" style="background:#6366f1;border:none;color:#fff;border-radius:0.4rem;padding:0.35rem 0.9rem;font-size:0.65rem;font-weight:700;cursor:pointer;">Save</button>'
        + '</div></div>';
    if (!document.getElementById('user-settings-modal')) document.body.appendChild(modal);
    else modal.style.display = 'flex';
}

async function adminSaveUserSettings(userId) {
    var limit = parseInt(document.getElementById('us-msg-limit').value) || 3;
    var features = {};
    ['plans','tracker','pyq','ca','focus','ai'].forEach(function(f) {
        var el = document.getElementById('uf-' + f);
        features[f] = el ? el.checked : true;
    });
    var notes = (document.getElementById('us-notes') || {}).value || '';
    try {
        var payload = { user_id: userId, daily_msg_limit: limit, features: features, notes: notes, updated_at: new Date().toISOString() };
        var res = await adminClient.from('upsc_user_settings').upsert(payload, { onConflict: 'user_id' });
        if (res.error) throw res.error;
        document.getElementById('user-settings-modal').remove();
        adminToast('Settings saved');
    } catch(e) { adminToast('Error: '+(e.message||'failed'), 'error'); }
}

// ── App Metrics Dashboard ─────────────────────────────────────────────────
var _metricsCache = null;
var METRICS_TTL   = 120000; // 2 min

async function loadMetrics() {
    var el = document.getElementById('metrics-content');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--t3);font-family:var(--mono);font-size:0.72rem;padding:1rem;">Loading metrics…</div>';

    var now = Date.now();
    if (_metricsCache && (now - _metricsCache.ts) < METRICS_TTL) {
        _renderMetrics(_metricsCache.data);
        return;
    }

    var since7d = new Date(now - 7 * 86400000).toISOString();
    var since30d = new Date(now - 30 * 86400000).toISOString();
    var today = new Date().toISOString().slice(0,10);

    try {
        var [recent, daily, byType, userCount, msgsToday] = await Promise.all([
            adminClient.from('upsc_app_metrics').select('event_type,created_at,user_id').gte('created_at', since7d).order('created_at', { ascending: false }),
            adminClient.from('upsc_app_metrics').select('created_at,user_id').gte('created_at', since30d),
            adminClient.from('upsc_app_metrics').select('event_type').gte('created_at', since7d),
            adminClient.from('upsc_user_profiles').select('user_id', { count: 'exact', head: true }),
            adminClient.from('upsc_messages').select('id', { count: 'exact', head: true }).gte('created_at', today + 'T00:00:00Z').eq('sender_type','user')
        ]);

        var data = {
            events:     recent.data  || [],
            allRecent:  daily.data   || [],
            byType:     byType.data  || [],
            totalUsers: userCount.count || 0,
            msgsToday:  msgsToday.count || 0
        };
        _metricsCache = { data: data, ts: Date.now() };
        _renderMetrics(data);
    } catch(e) {
        el.innerHTML = '<div style="color:#f87171;font-family:var(--mono);font-size:0.72rem;padding:1rem;">Error: '+(e.message||'')+'</div>';
    }
}

function _renderMetrics(data) {
    var el = document.getElementById('metrics-content');
    if (!el) return;

    var today = new Date().toISOString().slice(0,10);
    var todayEvents  = data.events.filter(function(e) { return e.created_at && e.created_at.startsWith(today); });
    var dau7 = new Set(data.events.map(function(e){return e.user_id;})).size;
    var totalEvents7d = data.events.length;

    // Count by type
    var typeCounts = {};
    data.byType.forEach(function(e){typeCounts[e.event_type]=(typeCounts[e.event_type]||0)+1;});

    // Daily breakdown for last 14 days
    var dailyMap = {};
    data.allRecent.forEach(function(e){
        var d = e.created_at && e.created_at.slice(0,10);
        if (d) { if (!dailyMap[d]) dailyMap[d] = new Set(); dailyMap[d].add(e.user_id); }
    });
    var last14 = [];
    for (var i=13;i>=0;i--){
        var d = new Date(Date.now()-i*86400000).toISOString().slice(0,10);
        last14.push({ date: d, dau: dailyMap[d] ? dailyMap[d].size : 0 });
    }

    // Top cards
    var cards = [
        { label:'Total Users',   value: data.totalUsers, icon:'👥', color:'#818cf8' },
        { label:'7-Day Active',  value: dau7,            icon:'📊', color:'#34d399' },
        { label:'Events (7d)',   value: totalEvents7d,   icon:'⚡', color:'#f59e0b' },
        { label:'Msgs Today',    value: data.msgsToday,  icon:'💬', color:'#f472b6' }
    ];
    var cardsHtml = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.75rem;margin-bottom:1.25rem;">'
        + cards.map(function(c){
            return '<div style="background:var(--surf);border:1px solid var(--bdr);border-radius:0.75rem;padding:0.85rem 1rem;">'
                +'<div style="font-size:0.6rem;font-weight:700;color:var(--t3);font-family:var(--mono);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.3rem;">'+c.icon+' '+c.label+'</div>'
                +'<div style="font-size:1.6rem;font-weight:900;color:'+c.color+';font-family:var(--mono);">'+c.value+'</div>'
                +'</div>';
        }).join('') + '</div>';

    // DAU line chart (SVG)
    var maxDau = Math.max.apply(null, last14.map(function(d){return d.dau;})) || 1;
    var svgW = 420, svgH = 100, pad = 20;
    var pts = last14.map(function(d, i) {
        var x = pad + i * (svgW - 2*pad) / 13;
        var y = svgH - pad - d.dau / maxDau * (svgH - 2*pad);
        return x + ',' + y;
    }).join(' ');
    var dauSvg = '<svg width="100%" height="'+svgH+'" viewBox="0 0 '+svgW+' '+svgH+'" preserveAspectRatio="none" style="display:block;">'
        + '<polyline fill="none" stroke="#818cf8" stroke-width="2" points="'+pts+'"/>'
        + last14.map(function(d,i){
            var x=pad+i*(svgW-2*pad)/13, y=svgH-pad-d.dau/maxDau*(svgH-2*pad);
            return '<circle cx="'+x+'" cy="'+y+'" r="3" fill="#818cf8"/>'
                +'<text x="'+x+'" y="'+(svgH-2)+'" text-anchor="middle" font-size="7" fill="var(--t4)">'+d.date.slice(5)+'</text>';
        }).join('')
        + '</svg>';

    // Event type bar chart
    var typeEntries = Object.entries(typeCounts).sort(function(a,b){return b[1]-a[1];}).slice(0,8);
    var maxType = typeEntries.length ? typeEntries[0][1] : 1;
    var evtColors = ['#818cf8','#34d399','#f59e0b','#f472b6','#60a5fa','#a78bfa','#fb7185','#fbbf24'];
    var barSvgW=360, barSvgH=100, barPad=8, barW=Math.floor((barSvgW-2*barPad)/Math.max(typeEntries.length,1))-4;
    var barSvg = '<svg width="100%" height="'+barSvgH+'" viewBox="0 0 '+barSvgW+' '+barSvgH+'" style="display:block;">'
        + typeEntries.map(function(e,i){
            var h=Math.max(4,Math.round(e[1]/maxType*(barSvgH-30)));
            var x=barPad+i*(barW+4);
            var y=barSvgH-20-h;
            var lbl=e[0].replace('_',' ').substr(0,6);
            return '<rect x="'+x+'" y="'+y+'" width="'+barW+'" height="'+h+'" rx="2" fill="'+evtColors[i%8]+'"/>'
                +'<text x="'+(x+barW/2)+'" y="'+(barSvgH-8)+'" text-anchor="middle" font-size="6.5" fill="var(--t3)">'+lbl+'</text>'
                +'<text x="'+(x+barW/2)+'" y="'+(y-3)+'" text-anchor="middle" font-size="7" fill="var(--t2)">'+e[1]+'</text>';
        }).join('')
        + '</svg>';

    var refreshBtn = '<button onclick="_metricsCache=null;loadMetrics()" style="float:right;background:var(--surf);border:1px solid var(--bdr);color:var(--t2);border-radius:0.4rem;padding:0.25rem 0.75rem;font-size:0.62rem;font-family:var(--mono);cursor:pointer;margin-bottom:0.5rem;">⟳ Refresh</button>';

    el.innerHTML = '<div style="padding:1rem 0;">' + refreshBtn + '<div style="clear:both;"></div>'
        + cardsHtml
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">'
        +   '<div style="background:var(--surf);border:1px solid var(--bdr);border-radius:0.75rem;padding:0.85rem;">'
        +     '<div style="font-size:0.65rem;font-weight:800;color:var(--t1);font-family:var(--mono);margin-bottom:0.5rem;text-transform:uppercase;">Daily Active Users (30d)</div>'
        +     dauSvg
        +   '</div>'
        +   '<div style="background:var(--surf);border:1px solid var(--bdr);border-radius:0.75rem;padding:0.85rem;">'
        +     '<div style="font-size:0.65rem;font-weight:800;color:var(--t1);font-family:var(--mono);margin-bottom:0.5rem;text-transform:uppercase;">Top Events (7d)</div>'
        +     barSvg
        +   '</div>'
        + '</div>'
        + '<div style="margin-top:1rem;background:var(--surf);border:1px solid var(--bdr);border-radius:0.75rem;padding:0.85rem;">'
        +   '<div style="font-size:0.65rem;font-weight:800;color:var(--t1);font-family:var(--mono);margin-bottom:0.5rem;text-transform:uppercase;">Recent Events</div>'
        +   '<table style="width:100%;border-collapse:collapse;font-size:0.65rem;font-family:var(--mono);">'
        +   '<thead><tr><th style="text-align:left;color:var(--t3);padding:0.25rem 0.4rem;border-bottom:1px solid var(--bdr);">Event</th><th style="text-align:left;color:var(--t3);padding:0.25rem 0.4rem;border-bottom:1px solid var(--bdr);">Time</th><th style="text-align:left;color:var(--t3);padding:0.25rem 0.4rem;border-bottom:1px solid var(--bdr);">User</th></tr></thead>'
        +   '<tbody>' + data.events.slice(0,15).map(function(e){
                var t=new Date(e.created_at).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
                return '<tr><td style="padding:0.2rem 0.4rem;color:var(--accent-l);">'+_adminEsc(e.event_type)+'</td>'
                    +'<td style="padding:0.2rem 0.4rem;color:var(--t3);">'+t+'</td>'
                    +'<td style="padding:0.2rem 0.4rem;color:var(--t2);">'+(e.user_id||'').substr(0,8)+'…</td></tr>';
            }).join('') + '</tbody></table>'
        + '</div></div>';
}
