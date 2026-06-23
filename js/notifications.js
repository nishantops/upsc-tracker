// =========================================================================
// UPSC Tracker - Notifications Module (notifications.js)
// =========================================================================

var _notifPrefs   = null;
var _notifAlerts  = [];
var _notifTimer   = null;
var _notifPanelOpen = false;

function getDefaultNotifPrefs() {
    return {
        enabled: true,
        notify_plan_start: true, notify_start_days: 1,
        notify_plan_end:   true, notify_end_days:   2,
        notify_overdue:    true,
        browser_push:      false,
        daily_reminder:    false, daily_time: '09:00'
    };
}

async function initNotifications() {
    await loadNotifPrefs();
    checkPlanNotifications();
    if (_notifTimer) clearInterval(_notifTimer);
    _notifTimer = setInterval(checkPlanNotifications, 30 * 60 * 1000);
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

function checkPlanNotifications() {
    if (!_notifPrefs || !_notifPrefs.enabled) { updateNotifBell([]); return; }
    var today = new Date(); today.setHours(0,0,0,0);
    var alerts = [];

    document.querySelectorAll('[id^="plan_card_wrapper_"]').forEach(function(card) {
        var planId = card.id.replace('plan_card_wrapper_','');
        var titleEl = card.querySelector('h3');
        var planTitle = titleEl ? titleEl.textContent.trim() : planId;
        var badges = card.querySelectorAll('.plan-date-badge');
        var startDate = null, endDate = null;
        badges.forEach(function(b) {
            var txt = b.textContent;
            if (txt.includes('\uD83D\uDCC5')) startDate = parsePlanBadgeDate(txt);
            if (txt.includes('\uD83C\uDFC1')) endDate   = parsePlanBadgeDate(txt);
        });

        if (_notifPrefs.notify_overdue && endDate) {
            var diff = Math.floor((today - endDate) / 86400000);
            if (diff > 0) {
                alerts.push({ type: 'overdue', planTitle: planTitle, msg: 'Overdue by ' + diff + ' day' + (diff > 1 ? 's' : '') });
                return;
            }
        }
        if (_notifPrefs.notify_plan_end && endDate) {
            var daysToEnd = Math.floor((endDate - today) / 86400000);
            if (daysToEnd >= 0 && daysToEnd <= _notifPrefs.notify_end_days) {
                alerts.push({ type: 'warning', planTitle: planTitle, msg: daysToEnd === 0 ? 'Ends today!' : 'Ends in ' + daysToEnd + ' day' + (daysToEnd > 1 ? 's' : '') });
            }
        }
        if (_notifPrefs.notify_plan_start && startDate) {
            var daysToStart = Math.floor((startDate - today) / 86400000);
            if (daysToStart >= 0 && daysToStart <= _notifPrefs.notify_start_days) {
                alerts.push({ type: 'info', planTitle: planTitle, msg: daysToStart === 0 ? 'Starts today!' : 'Starts in ' + daysToStart + ' day' + (daysToStart > 1 ? 's' : '') });
            }
        }
    });

    _notifAlerts = alerts;
    updateNotifBell(alerts);

    if (_notifPrefs.browser_push && alerts.length > 0) {
        alerts.forEach(function(a) { sendBrowserNotification('UPSC Tracker - ' + a.planTitle, a.msg); });
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

function updateNotifBell(alerts) {
    var bell = document.getElementById('notif-bell');
    if (!bell) return;
    var badge = bell.querySelector('.notif-count');
    if (alerts.length > 0) {
        if (!badge) { badge = document.createElement('span'); badge.className = 'notif-count'; bell.appendChild(badge); }
        badge.textContent = alerts.length > 9 ? '9+' : alerts.length;
        badge.style.display = 'flex';
    } else {
        if (badge) badge.style.display = 'none';
    }
}

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

function renderNotifPanel() {
    var list = document.getElementById('notif-list');
    if (!list) return;
    if (_notifAlerts.length === 0) {
        list.innerHTML = '<div class="notif-empty">No active alerts</div>';
        return;
    }
    list.innerHTML = _notifAlerts.map(function(a) {
        var icon = a.type === 'overdue' ? '&#128680;' : a.type === 'warning' ? '&#9888;&#65039;' : '&#8505;&#65039;';
        return '<div class="notif-item notif-' + a.type + '">'
            + '<span class="notif-icon">' + icon + '</span>'
            + '<div class="notif-msg"><div style="font-weight:700;font-size:0.78rem;">' + a.planTitle + '</div>'
            + '<div style="font-size:0.71rem;opacity:0.8;">' + a.msg + '</div></div></div>';
    }).join('');
}

function openNotifSettings() {
    var modal = document.getElementById('notif-settings-modal');
    if (!modal) return;
    var p = _notifPrefs || getDefaultNotifPrefs();
    var f = function(id) { return document.getElementById(id); };
    if (f('ns-enabled'))       f('ns-enabled').checked       = !!p.enabled;
    if (f('ns-plan-start'))    f('ns-plan-start').checked    = !!p.notify_plan_start;
    if (f('ns-start-days'))    f('ns-start-days').value      = p.notify_start_days || 1;
    if (f('ns-plan-end'))      f('ns-plan-end').checked      = !!p.notify_plan_end;
    if (f('ns-end-days'))      f('ns-end-days').value        = p.notify_end_days || 2;
    if (f('ns-overdue'))       f('ns-overdue').checked       = !!p.notify_overdue;
    if (f('ns-browser-push'))  f('ns-browser-push').checked  = !!p.browser_push;
    if (f('ns-daily'))         f('ns-daily').checked         = !!p.daily_reminder;
    if (f('ns-daily-time'))    f('ns-daily-time').value      = p.daily_time || '09:00';
    modal.classList.remove('hidden');
}

function closeNotifSettings() {
    var modal = document.getElementById('notif-settings-modal');
    if (modal) modal.classList.add('hidden');
}

async function saveNotifSettings() {
    var f = function(id) { var el = document.getElementById(id); return el ? el : { checked: false, value: '' }; };
    var prefs = {
        user_id: currentUserId,
        enabled:            f('ns-enabled').checked,
        notify_plan_start:  f('ns-plan-start').checked,
        notify_start_days:  parseInt(f('ns-start-days').value) || 1,
        notify_plan_end:    f('ns-plan-end').checked,
        notify_end_days:    parseInt(f('ns-end-days').value) || 2,
        notify_overdue:     f('ns-overdue').checked,
        browser_push:       f('ns-browser-push').checked,
        daily_reminder:     f('ns-daily').checked,
        daily_time:         f('ns-daily-time').value || '09:00'
    };
    if (prefs.browser_push) requestBrowserPush();
    _notifPrefs = prefs;
    try { localStorage.setItem('upsc_notif_prefs', JSON.stringify(prefs)); } catch(e) {}
    if (typeof dbClient !== 'undefined' && currentUserId) {
        try {
            await dbClient.from('upsc_notification_prefs')
                .upsert(prefs, { onConflict: 'user_id' });
        } catch(e) { console.warn('[Notif] save:', e.message); }
    }
    closeNotifSettings();
    checkPlanNotifications();
    if (typeof showToast === 'function') showToast('Notification settings saved', 'success');
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
