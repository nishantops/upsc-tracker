// =========================================================================
// UPSC Tracker - Notifications Module (notifications.js v2)
// =========================================================================

var _notifPrefs     = null;
var _notifAlerts    = [];
var _notifTimer     = null;
var _notifPanelOpen = false;

// ── Defaults ──────────────────────────────────────────────────────────────
function getDefaultNotifPrefs() {
    return {
        enabled:              true,
        notify_plan_start:    true,  notify_start_days:    1,
        notify_plan_end:      true,  notify_end_days:      2,
        notify_overdue:       true,
        notify_prelims_cd:    false, prelims_cd_days:      30,
        notify_mains_cd:      false, mains_cd_days:        30,
        notify_low_abs:       false, low_abs_pct:          15,
        notify_streak:        false, streak_break_days:    1,
        daily_reminder:       false, daily_time:           '09:00',
        evening_reminder:     false, evening_time:         '21:00',
        custom_reminder:      false, custom_text:          '', custom_reminder_time: '14:00',
        browser_push:         false,
        snooze_default_hours: 24
    };
}

// ── Snooze helpers ─────────────────────────────────────────────────────────
function _snoozeKey(alert) { return 'ns_' + alert.type + '_' + (alert.planTitle || alert.alertId || ''); }

function snoozeAlert(alert, hours) {
    var key = _snoozeKey(alert);
    var expiry = Date.now() + (hours * 3600000);
    try {
        var snoozed = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}');
        snoozed[key] = expiry;
        localStorage.setItem('upsc_snoozed', JSON.stringify(snoozed));
    } catch(e) {}
    _notifAlerts = _notifAlerts.filter(function(a) { return _snoozeKey(a) !== key; });
    updateNotifBell(_notifAlerts);
    renderNotifPanel();
    var label = hours >= 168 ? '1 week' : hours >= 72 ? '3 days' : hours >= 24 ? '1 day' : hours + ' hours';
    if (typeof showToast === 'function') showToast('Snoozed for ' + label, 'info');
}

function dismissAlert(alert) {
    snoozeAlert(alert, 8);
}

function dismissAllNotifs() {
    var hours = (_notifPrefs && _notifPrefs.snooze_default_hours) ? _notifPrefs.snooze_default_hours : 24;
    _notifAlerts.forEach(function(a) {
        var key = _snoozeKey(a);
        var expiry = Date.now() + (hours * 3600000);
        try {
            var snoozed = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}');
            snoozed[key] = expiry;
            localStorage.setItem('upsc_snoozed', JSON.stringify(snoozed));
        } catch(e) {}
    });
    _notifAlerts = [];
    updateNotifBell([]);
    renderNotifPanel();
    if (typeof showToast === 'function') showToast('All alerts dismissed', 'success');
}

function _isSnoozed(alert) {
    var key = _snoozeKey(alert);
    try {
        var snoozed = JSON.parse(localStorage.getItem('upsc_snoozed') || '{}');
        if (snoozed[key] && snoozed[key] > Date.now()) return true;
        if (snoozed[key]) { delete snoozed[key]; localStorage.setItem('upsc_snoozed', JSON.stringify(snoozed)); }
    } catch(e) {}
    return false;
}

// ── Init & Load ────────────────────────────────────────────────────────────
async function initNotifications() {
    await loadNotifPrefs();
    checkPlanNotifications();
    if (_notifTimer) clearInterval(_notifTimer);
    _notifTimer = setInterval(checkPlanNotifications, 20 * 60 * 1000);
}

async function loadNotifPrefs() {
    _notifPrefs = getDefaultNotifPrefs();
    if (typeof dbClient === 'undefined' || typeof currentUserId === 'undefined' || !currentUserId) return;
    try {
        var res = await dbClient.from('upsc_notification_prefs')
            .select('*').eq('user_id', currentUserId).maybeSingle();
        if (!res.error && res.data) _notifPrefs = Object.assign(getDefaultNotifPrefs(), res.data);
    } catch(e) {
        try { _notifPrefs = JSON.parse(localStorage.getItem('upsc_notif_prefs') || 'null') || getDefaultNotifPrefs(); } catch(e2) {}
    }
}

// ── Core alert checker ─────────────────────────────────────────────────────
function checkPlanNotifications() {
    if (!_notifPrefs || !_notifPrefs.enabled) { updateNotifBell([]); return; }
    var today = new Date(); today.setHours(0,0,0,0);
    var alerts = [];

    // 1 — Plan date alerts
    document.querySelectorAll('[id^="plan_card_wrapper_"]').forEach(function(card) {
        var planId    = card.id.replace('plan_card_wrapper_','');
        var titleEl   = card.querySelector('h3');
        var planTitle = titleEl ? titleEl.textContent.trim() : planId;
        var badges    = card.querySelectorAll('.plan-date-badge');
        var startDate = null, endDate = null;
        badges.forEach(function(b) {
            var txt = b.textContent;
            if (txt.includes('\uD83D\uDCC5')) startDate = parsePlanBadgeDate(txt);
            if (txt.includes('\uD83C\uDFC1')) endDate   = parsePlanBadgeDate(txt);
        });
        if (_notifPrefs.notify_overdue && endDate) {
            var diff = Math.floor((today - endDate) / 86400000);
            if (diff > 0) {
                alerts.push({ type: 'overdue', planTitle: planTitle, alertId: 'overdue_' + planId,
                    msg: 'Overdue by ' + diff + ' day' + (diff > 1 ? 's' : '') });
                return;
            }
        }
        if (_notifPrefs.notify_plan_end && endDate) {
            var daysToEnd = Math.floor((endDate - today) / 86400000);
            if (daysToEnd >= 0 && daysToEnd <= (_notifPrefs.notify_end_days || 2)) {
                alerts.push({ type: 'warning', planTitle: planTitle, alertId: 'end_' + planId,
                    msg: daysToEnd === 0 ? 'Ends today!' : 'Ends in ' + daysToEnd + ' day' + (daysToEnd > 1 ? 's' : '') });
            }
        }
        if (_notifPrefs.notify_plan_start && startDate) {
            var daysToStart = Math.floor((startDate - today) / 86400000);
            if (daysToStart >= 0 && daysToStart <= (_notifPrefs.notify_start_days || 1)) {
                alerts.push({ type: 'info', planTitle: planTitle, alertId: 'start_' + planId,
                    msg: daysToStart === 0 ? 'Starts today!' : 'Starts in ' + daysToStart + ' day' + (daysToStart > 1 ? 's' : '') });
            }
        }
    });

    // 2 — Exam countdown alerts
    if (_notifPrefs.notify_prelims_cd) {
        var pEl = document.getElementById('prelims-days-live') || document.getElementById('prelims-countdown-live');
        var pDays = pEl ? parseInt(pEl.textContent) : NaN;
        if (!isNaN(pDays) && pDays >= 0 && pDays <= (_notifPrefs.prelims_cd_days || 30)) {
            alerts.push({ type: 'exam', planTitle: 'Prelims Exam', alertId: 'prelims_cd',
                msg: pDays === 0 ? 'Prelims is TODAY! 🔥' : 'Only ' + pDays + ' days to Prelims — ramp up revision!' });
        }
    }
    if (_notifPrefs.notify_mains_cd) {
        var mEl = document.getElementById('mains-days-live') || document.getElementById('mains-countdown-live');
        var mDays = mEl ? parseInt(mEl.textContent) : NaN;
        if (!isNaN(mDays) && mDays >= 0 && mDays <= (_notifPrefs.mains_cd_days || 30)) {
            alerts.push({ type: 'exam', planTitle: 'Mains Exam', alertId: 'mains_cd',
                msg: mDays === 0 ? 'Mains is TODAY! 🔥' : 'Only ' + mDays + ' days to Mains — lock down weak areas!' });
        }
    }

    // 3 — Low absorption alert
    if (_notifPrefs.notify_low_abs) {
        var absEl = document.getElementById('global-absorption-pct') || document.getElementById('global-pct-text');
        var absPct = absEl ? parseFloat(absEl.textContent) : NaN;
        if (!isNaN(absPct) && absPct < (_notifPrefs.low_abs_pct || 15)) {
            alerts.push({ type: 'warning', planTitle: 'Overall Progress', alertId: 'low_abs',
                msg: 'Absorption at ' + absPct.toFixed(1) + '% — below your ' + (_notifPrefs.low_abs_pct || 15) + '% target!' });
        }
    }

    // 4 — Study streak reminder
    if (_notifPrefs.notify_streak) {
        try {
            var lastFocus = localStorage.getItem('upsc_last_focus_ts');
            if (lastFocus) {
                var hoursSince = (Date.now() - parseInt(lastFocus)) / 3600000;
                var threshold = (_notifPrefs.streak_break_days || 1) * 24;
                if (hoursSince >= threshold) {
                    var dStr = hoursSince >= 48 ? Math.floor(hoursSince/24) + ' days' : Math.round(hoursSince) + 'h';
                    alerts.push({ type: 'streak', planTitle: 'Study Streak', alertId: 'streak',
                        msg: 'No focus session for ' + dStr + '. Keep the momentum going!' });
                }
            }
        } catch(e) {}
    }

    // 5 — Custom reminder (fires once per day around the set time)
    if (_notifPrefs.custom_reminder && _notifPrefs.custom_text) {
        var now = new Date();
        var rParts = (_notifPrefs.custom_reminder_time || '14:00').split(':');
        var rH = parseInt(rParts[0] || 14), rM = parseInt(rParts[1] || 0);
        var minsDiff = (now.getHours() - rH) * 60 + (now.getMinutes() - rM);
        if (minsDiff >= 0 && minsDiff < 60) {
            alerts.push({ type: 'reminder', planTitle: 'Custom Reminder', alertId: 'custom_reminder',
                msg: _notifPrefs.custom_text });
        }
    }

    // 6 — Daily morning reminder
    if (_notifPrefs.daily_reminder && _notifPrefs.daily_time) {
        var nowD = new Date();
        var dParts = (_notifPrefs.daily_time || '09:00').split(':');
        var dH = parseInt(dParts[0] || 9), dM = parseInt(dParts[1] || 0);
        var minsDiff2 = (nowD.getHours() - dH) * 60 + (nowD.getMinutes() - dM);
        if (minsDiff2 >= 0 && minsDiff2 < 60) {
            alerts.push({ type: 'info', planTitle: 'Daily Study Reminder', alertId: 'daily_reminder',
                msg: 'Good morning! Time to study. Consistency beats intensity every day.' });
        }
    }

    // 7 — Evening review reminder
    if (_notifPrefs.evening_reminder && _notifPrefs.evening_time) {
        var nowE = new Date();
        var eParts = (_notifPrefs.evening_time || '21:00').split(':');
        var eH = parseInt(eParts[0] || 21), eM = parseInt(eParts[1] || 0);
        var minsDiff3 = (nowE.getHours() - eH) * 60 + (nowE.getMinutes() - eM);
        if (minsDiff3 >= 0 && minsDiff3 < 60) {
            alerts.push({ type: 'info', planTitle: 'Evening Review', alertId: 'evening_reminder',
                msg: 'Evening check-in: review today\'s notes and plan tomorrow\'s targets!' });
        }
    }

    // Filter out snoozed alerts
    alerts = alerts.filter(function(a) { return !_isSnoozed(a); });

    _notifAlerts = alerts;
    updateNotifBell(alerts);

    if (_notifPrefs.browser_push && alerts.length > 0) {
        alerts.forEach(function(a) { sendBrowserNotification('UPSC Tracker — ' + a.planTitle, a.msg); });
    }
}

function parsePlanBadgeDate(badgeText) {
    try {
        var clean = badgeText.replace(/[\uD800-\uDFFF]/g,'').replace(/[^\w\s,]/g,' ').trim();
        var d = new Date(clean);
        if (!isNaN(d.getTime())) { d.setHours(0,0,0,0); return d; }
        var months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
        var parts = clean.trim().split(/\s+/);
        if (parts.length >= 3) {
            var day = parseInt(parts[0]), mon = months[parts[1].toLowerCase().slice(0,3)], yr = parseInt(parts[2]);
            if (!isNaN(day) && mon !== undefined && !isNaN(yr)) {
                var nd = new Date(yr, mon, day); nd.setHours(0,0,0,0); return nd;
            }
        }
    } catch(e) {}
    return null;
}

// ── Bell badge ─────────────────────────────────────────────────────────────
function updateNotifBell(alerts) {
    var bell = document.getElementById('notif-bell');
    if (!bell) return;
    var badge = bell.querySelector('.notif-count');
    if (alerts.length > 0) {
        if (!badge) { badge = document.createElement('span'); badge.className = 'notif-count'; bell.appendChild(badge); }
        badge.textContent = alerts.length > 9 ? '9+' : alerts.length;
        badge.style.display = 'flex';
        bell.style.color = '#f87171';
    } else {
        if (badge) badge.style.display = 'none';
        bell.style.color = '#a5b4fc';
    }
}

// ── Panel toggle ───────────────────────────────────────────────────────────
function toggleNotifPanel() {
    var panel = document.getElementById('notif-panel');
    if (!panel) return;
    _notifPanelOpen = !_notifPanelOpen;
    if (_notifPanelOpen) {
        renderNotifPanel();
        panel.classList.remove('hidden');
        setTimeout(function() { document.addEventListener('click', notifOutsideClose, { once: true }); }, 50);
    } else {
        panel.classList.add('hidden');
    }
}

function notifOutsideClose(e) {
    var panel = document.getElementById('notif-panel');
    var bell  = document.getElementById('notif-bell');
    if (panel && !panel.contains(e.target) && bell && !bell.contains(e.target)) {
        panel.classList.add('hidden');
        _notifPanelOpen = false;
    } else if (_notifPanelOpen) {
        setTimeout(function() { document.addEventListener('click', notifOutsideClose, { once: true }); }, 50);
    }
}

// ── Panel render ───────────────────────────────────────────────────────────
function renderNotifPanel() {
    var list = document.getElementById('notif-list');
    if (!list) return;
    if (_notifAlerts.length === 0) {
        list.innerHTML = '<div class="notif-empty">✓ All clear — no active alerts</div>';
        return;
    }
    var snoozeHours = (_notifPrefs && _notifPrefs.snooze_default_hours) ? _notifPrefs.snooze_default_hours : 24;
    var snoozeLabel = snoozeHours >= 168 ? '1w' : snoozeHours >= 72 ? '3d' : snoozeHours >= 24 ? '1d' : snoozeHours + 'h';
    list.innerHTML = _notifAlerts.map(function(a, idx) {
        var iconMap = { overdue: '🚨', warning: '⚠️', info: 'ℹ️', exam: '🎯', streak: '🔥', reminder: '⏰' };
        var icon = iconMap[a.type] || '🔔';
        return '<div class="notif-item notif-' + a.type + '">'
            + '<span class="notif-icon">' + icon + '</span>'
            + '<div class="notif-msg" style="flex:1;">'
            +   '<div style="font-weight:700;font-size:0.78rem;">' + escHtml(a.planTitle) + '</div>'
            +   '<div style="font-size:0.71rem;opacity:0.85;margin-top:0.1rem;">' + escHtml(a.msg) + '</div>'
            + '</div>'
            + '<div class="notif-actions">'
            +   '<button class="notif-snooze-btn" onclick="snoozeAlert(_notifAlerts[' + idx + '],' + snoozeHours + ')" title="Snooze">💤 ' + snoozeLabel + '</button>'
            +   '<button class="notif-dismiss-btn" onclick="dismissAlert(_notifAlerts[' + idx + '])" title="Dismiss">✕</button>'
            + '</div>'
            + '</div>';
    }).join('');
}

function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── Settings ───────────────────────────────────────────────────────────────
function openNotifSettings() {
    var modal = document.getElementById('notif-settings-modal');
    if (!modal) return;
    var p = _notifPrefs || getDefaultNotifPrefs();
    var set = function(id, val) {
        var el = document.getElementById(id);
        if (!el) return;
        if (typeof val === 'boolean') el.checked = val; else el.value = val;
    };
    set('ns-enabled',           !!p.enabled);
    set('ns-plan-start',        !!p.notify_plan_start);
    set('ns-start-days',        p.notify_start_days || 1);
    set('ns-plan-end',          !!p.notify_plan_end);
    set('ns-end-days',          p.notify_end_days || 2);
    set('ns-overdue',           !!p.notify_overdue);
    set('ns-prelims-countdown', !!p.notify_prelims_cd);
    set('ns-prelims-days',      p.prelims_cd_days || 30);
    set('ns-mains-countdown',   !!p.notify_mains_cd);
    set('ns-mains-days',        p.mains_cd_days || 30);
    set('ns-low-absorption',    !!p.notify_low_abs);
    set('ns-absorption-pct',    p.low_abs_pct || 15);
    set('ns-streak',            !!p.notify_streak);
    set('ns-streak-days',       p.streak_break_days || 1);
    set('ns-daily',             !!p.daily_reminder);
    set('ns-daily-time',        p.daily_time || '09:00');
    set('ns-evening',           !!p.evening_reminder);
    set('ns-evening-time',      p.evening_time || '21:00');
    set('ns-custom-reminder',   !!p.custom_reminder);
    set('ns-custom-text',       p.custom_text || '');
    set('ns-custom-time',       p.custom_reminder_time || '14:00');
    set('ns-browser-push',      !!p.browser_push);
    set('ns-snooze-default',    p.snooze_default_hours || 24);
    var wrap = document.getElementById('ns-custom-wrap');
    if (wrap) wrap.style.display = p.custom_reminder ? 'flex' : 'none';
    var crTog = document.getElementById('ns-custom-reminder');
    if (crTog) crTog.onchange = function() {
        var w = document.getElementById('ns-custom-wrap');
        if (w) w.style.display = this.checked ? 'flex' : 'none';
    };

    // Master toggle wires up enable/disable of all other controls
    _applyMasterToggle(!!p.enabled);
    var masterEl = document.getElementById('ns-enabled');
    if (masterEl) masterEl.onchange = function() { _applyMasterToggle(this.checked); };

    modal.classList.remove('hidden');
}

// Visually enables/disables all sub-settings based on master toggle
function _applyMasterToggle(enabled) {
    var body = document.getElementById('ns-settings-body');
    if (!body) return;
    var controls = body.querySelectorAll('input, select, button');
    controls.forEach(function(el) {
        if (el.id === 'ns-enabled') return; // never disable master itself
        el.disabled = !enabled;
    });
    body.style.opacity  = enabled ? '1' : '0.45';
    body.style.pointerEvents = enabled ? '' : 'none';
    // Re-enable the master toggle row so it stays clickable
    var masterEl = document.getElementById('ns-enabled');
    if (masterEl) { masterEl.disabled = false; masterEl.closest && masterEl.closest('.ns-row') && (masterEl.closest('.ns-row').style.pointerEvents = ''); }
    if (masterEl) masterEl.parentElement.style.pointerEvents = '';
}

function closeNotifSettings() {
    var modal = document.getElementById('notif-settings-modal');
    if (modal) modal.classList.add('hidden');
}

async function saveNotifSettings() {
    var g = function(id) { return document.getElementById(id) || { checked: false, value: '' }; };
    var masterEnabled = g('ns-enabled').checked;
    // Re-enable all controls temporarily to read their true values before saving
    var body = document.getElementById('ns-settings-body');
    if (body && !masterEnabled) {
        body.querySelectorAll('input,select').forEach(function(el){ el.disabled = false; });
    }
    var prefs = {
        user_id:              typeof currentUserId !== 'undefined' ? currentUserId : null,
        enabled:              masterEnabled,
        notify_plan_start:    g('ns-plan-start').checked,
        notify_start_days:    parseInt(g('ns-start-days').value) || 1,
        notify_plan_end:      g('ns-plan-end').checked,
        notify_end_days:      parseInt(g('ns-end-days').value) || 2,
        notify_overdue:       g('ns-overdue').checked,
        notify_prelims_cd:    g('ns-prelims-countdown').checked,
        prelims_cd_days:      parseInt(g('ns-prelims-days').value) || 30,
        notify_mains_cd:      g('ns-mains-countdown').checked,
        mains_cd_days:        parseInt(g('ns-mains-days').value) || 30,
        notify_low_abs:       g('ns-low-absorption').checked,
        low_abs_pct:          parseInt(g('ns-absorption-pct').value) || 15,
        notify_streak:        g('ns-streak').checked,
        streak_break_days:    parseInt(g('ns-streak-days').value) || 1,
        daily_reminder:       g('ns-daily').checked,
        daily_time:           g('ns-daily-time').value || '09:00',
        evening_reminder:     g('ns-evening').checked,
        evening_time:         g('ns-evening-time').value || '21:00',
        custom_reminder:      g('ns-custom-reminder').checked,
        custom_text:          g('ns-custom-text').value || '',
        custom_reminder_time: g('ns-custom-time').value || '14:00',
        browser_push:         g('ns-browser-push').checked,
        snooze_default_hours: parseInt(g('ns-snooze-default').value) || 24
    };
    if (prefs.browser_push) requestBrowserPush();
    _notifPrefs = prefs;
    try { localStorage.setItem('upsc_notif_prefs', JSON.stringify(prefs)); } catch(e) {}
    if (typeof dbClient !== 'undefined' && prefs.user_id) {
        try { await dbClient.from('upsc_notification_prefs').upsert(prefs, { onConflict: 'user_id' }); }
        catch(e) { console.warn('[Notif] save:', e.message); }
    }
    closeNotifSettings();
    checkPlanNotifications();
    if (typeof showToast === 'function') showToast('Notification settings saved ✓', 'success');
}

function requestBrowserPush() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function sendBrowserNotification(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(title, { body: body, icon: '/favicon.ico' }); } catch(e) {}
    }
}


