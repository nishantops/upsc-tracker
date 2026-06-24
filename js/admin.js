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
        var r = await adminClient.from('upsc_user_sessions').select('is_superuser').eq('user_id', userId).maybeSingle();
        return r.data && r.data.is_superuser === true;
    } catch(e) { return false; }
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
    var sections = ['overview', 'users', 'focus', 'audit', 'inbox'];
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
            + '<td><button class="a-btn-sm" onclick="openUserModal(\'' + u.user_id + '\')">View</button></td>'
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
var INBOX_TTL = 60000; // 1 min cache

async function loadInbox() {
    var el = document.getElementById('inbox-content');
    if (!el) el = document.getElementById('sec-inbox');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--t3);font-family:var(--mono);font-size:0.72rem;padding:1rem;">Loading inbox…</div>';

    var now = Date.now();
    if (_inboxCache.ts && (now - _inboxCache.ts) < INBOX_TTL && _inboxCache.msgs) {
        _renderInbox(_inboxCache.msgs, _inboxCache.feedback);
        return;
    }

    try {
        var [msgsRes, fbRes] = await Promise.all([
            adminClient.from('upsc_messages').select('*').order('created_at', { ascending: false }),
            adminClient.from('upsc_feedback').select('*').order('created_at', { ascending: false })
        ]);
        var msgs = msgsRes.data || [];
        var feedback = fbRes.data || [];
        _inboxCache = { msgs, feedback, ts: Date.now() };
        _renderInbox(msgs, feedback);
    } catch(e) {
        if (el) el.innerHTML = '<div style="color:#f87171;font-family:var(--mono);font-size:0.72rem;padding:1rem;">Error: ' + (e.message||'Could not load') + '</div>';
    }
}

function _renderInbox(msgs, feedback) {
    var el = document.getElementById('inbox-content');
    if (!el) el = document.getElementById('sec-inbox');
    if (!el) return;

    // Group messages by user
    var byUser = {};
    msgs.forEach(function(m) {
        if (!byUser[m.user_id]) byUser[m.user_id] = { name: m.display_name||'User', msgs: [] };
        byUser[m.user_id].msgs.push(m);
    });

    // Group feedback by month
    var byMonth = {};
    feedback.forEach(function(f) {
        if (!byMonth[f.month_key]) byMonth[f.month_key] = [];
        byMonth[f.month_key].push(f);
    });

    function fmtDate(d) { return d ? new Date(d).toLocaleString('en-IN', { dateStyle:'medium', timeStyle:'short' }) : ''; }

    // Messages section
    var msgHtml = '<div style="margin-bottom:1.5rem;">';
    msgHtml += '<h3 style="font-size:0.8rem;font-weight:800;color:var(--t1);margin-bottom:0.75rem;font-family:var(--mono);">💬 User Messages (' + msgs.length + ')</h3>';

    if (!msgs.length) {
        msgHtml += '<p style="color:var(--t3);font-size:0.7rem;font-family:var(--mono);">No messages yet.</p>';
    } else {
        // User-wise accordion
        Object.keys(byUser).forEach(function(uid) {
            var u = byUser[uid];
            msgHtml += '<div style="border:1px solid var(--bdr);border-radius:0.7rem;margin-bottom:0.6rem;overflow:hidden;">';
            msgHtml += '<div style="background:var(--surf);padding:0.5rem 0.85rem;display:flex;align-items:center;justify-content:space-between;">';
            msgHtml += '<span style="font-size:0.72rem;font-weight:700;color:var(--t1);font-family:var(--mono);">👤 ' + _adminEsc(u.name) + '</span>';
            msgHtml += '<span style="font-size:0.62rem;color:var(--t3);font-family:var(--mono);">' + u.msgs.length + ' message(s)</span></div>';
            u.msgs.forEach(function(m) {
                msgHtml += '<div style="padding:0.6rem 0.85rem;border-top:1px solid var(--bdr);">';
                msgHtml += '<div style="font-size:0.62rem;color:var(--t3);font-family:var(--mono);margin-bottom:0.25rem;">' + fmtDate(m.created_at) + '</div>';
                msgHtml += '<div style="font-size:0.72rem;color:var(--t2);white-space:pre-wrap;line-height:1.5;">' + _adminEsc(m.content) + '</div>';
                msgHtml += '</div>';
            });
            msgHtml += '</div>';
        });
    }
    msgHtml += '</div>';

    // Feedback section — month-wise, then user-wise within
    var fbHtml = '<div>';
    fbHtml += '<h3 style="font-size:0.8rem;font-weight:800;color:var(--t1);margin-bottom:0.75rem;font-family:var(--mono);">📝 Monthly Feedback (' + feedback.length + ')</h3>';

    if (!feedback.length) {
        fbHtml += '<p style="color:var(--t3);font-size:0.7rem;font-family:var(--mono);">No feedback submitted yet.</p>';
    } else {
        var sortedMonths = Object.keys(byMonth).sort().reverse();
        sortedMonths.forEach(function(mkey) {
            var entries = byMonth[mkey];
            fbHtml += '<div style="border:1px solid var(--bdr);border-radius:0.7rem;margin-bottom:0.6rem;overflow:hidden;">';
            fbHtml += '<div style="background:var(--surf);padding:0.5rem 0.85rem;display:flex;align-items:center;justify-content:space-between;">';
            fbHtml += '<span style="font-size:0.72rem;font-weight:700;color:var(--accent-l);font-family:var(--mono);">📅 ' + mkey + '</span>';
            fbHtml += '<span style="font-size:0.62rem;color:var(--t3);font-family:var(--mono);">' + entries.length + ' submission(s)</span></div>';
            entries.forEach(function(f) {
                fbHtml += '<div style="padding:0.6rem 0.85rem;border-top:1px solid var(--bdr);">';
                fbHtml += '<div style="display:flex;justify-content:space-between;margin-bottom:0.2rem;">';
                fbHtml += '<span style="font-size:0.68rem;font-weight:700;color:var(--t1);font-family:var(--mono);">👤 ' + _adminEsc(f.display_name||'User') + '</span>';
                fbHtml += '<span style="font-size:0.6rem;color:var(--t3);font-family:var(--mono);">' + fmtDate(f.created_at) + '</span></div>';
                fbHtml += '<div style="font-size:0.72rem;color:var(--t2);white-space:pre-wrap;line-height:1.5;">' + _adminEsc(f.content) + '</div>';
                fbHtml += '</div>';
            });
            fbHtml += '</div>';
        });
    }
    fbHtml += '</div>';

    var refreshBtn = '<button onclick="_inboxCache.ts=0;loadInbox()" style="float:right;background:var(--surf);border:1px solid var(--bdr);color:var(--t2);border-radius:0.4rem;padding:0.25rem 0.75rem;font-size:0.62rem;font-family:var(--mono);cursor:pointer;margin-bottom:0.75rem;">⟳ Refresh</button>';

    el.innerHTML = '<div style="padding:1rem 0;">' + refreshBtn + '<div style="clear:both;"></div>' + msgHtml + fbHtml + '</div>';
}

function _adminEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
