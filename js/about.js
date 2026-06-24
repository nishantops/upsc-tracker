// =========================================================================
// ABOUT MODAL · CHAT SYSTEM · RATE LIMITING · MONTHLY FEEDBACK
// =========================================================================
'use strict';

// ── About Modal ──────────────────────────────────────────────────────────
function openAboutModal() {
    var m = document.getElementById('about-modal');
    if (m) m.classList.remove('hidden');
    switchAboutTab('features');
    _loadFeedbackStatus();
    var pm = document.getElementById('profile-menu');
    if (pm) pm.classList.add('hidden');
}
function closeAboutModal() {
    var m = document.getElementById('about-modal');
    if (m) m.classList.add('hidden');
}
function switchAboutTab(tab) {
    ['features','shortcuts','contact','feedback'].forEach(function(t) {
        var btn = document.getElementById('abt-' + t);
        var pane = document.getElementById('about-pane-' + t);
        if (btn)  btn.classList.toggle('active', t === tab);
        if (pane) pane.style.display = (t === tab) ? '' : 'none';
    });
}
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeAboutModal();
});

// ── Contact Admin Message ────────────────────────────────────────────────
async function submitContactMessage() {
    var inp = document.getElementById('contact-msg-input');
    var statusEl = document.getElementById('contact-status');
    if (!inp || !inp.value.trim()) {
        if (statusEl) { statusEl.textContent = 'Please type a message.'; statusEl.style.color = '#f87171'; }
        return;
    }
    if (statusEl) { statusEl.textContent = 'Sending…'; statusEl.style.color = 'var(--t3)'; }

    var name = 'User';
    try { if (typeof currentUserId !== 'undefined' && window._userProfile) name = window._userProfile.display_name || name; } catch(e) {}

    try {
        if (typeof dbClient === 'undefined' || !currentUserId) throw new Error('Not logged in');
        var res = await dbClient.from('upsc_messages').insert({
            user_id: currentUserId,
            display_name: name,
            content: inp.value.trim()
        });
        if (res.error) throw res.error;
        inp.value = '';
        if (statusEl) { statusEl.textContent = '✓ Message sent to admin.'; statusEl.style.color = '#10b981'; }
    } catch(e) {
        if (statusEl) { statusEl.textContent = 'Error: ' + (e.message || 'Could not send'); statusEl.style.color = '#f87171'; }
    }
}

// ── Monthly Feedback ─────────────────────────────────────────────────────
var _fbCache = null; // cache for current month's feedback

async function _loadFeedbackStatus() {
    var banner = document.getElementById('feedback-status-banner');
    var inp    = document.getElementById('feedback-input');
    var btn    = document.getElementById('feedback-submit-btn');
    var lbl    = document.getElementById('feedback-month-label');
    if (!banner) return;

    var now = new Date();
    var monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    var monthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    if (lbl) lbl.textContent = 'Feedback for: ' + monthName;

    if (typeof dbClient === 'undefined' || !currentUserId) {
        banner.textContent = 'Login required.'; return;
    }

    try {
        var res = await dbClient.from('upsc_feedback').select('*').eq('user_id', currentUserId).eq('month_key', monthKey).maybeSingle();
        if (res.data) {
            _fbCache = res.data;
            if (inp)  { inp.value = res.data.content; inp.readOnly = true; inp.style.opacity = '0.7'; }
            if (btn)  { btn.disabled = true; btn.style.opacity = '0.5'; btn.textContent = 'Submitted'; }
            banner.textContent = '✓ Feedback submitted for ' + monthName + '. Cannot edit until next month.';
            banner.style.color = '#10b981';
        } else {
            _fbCache = null;
            if (inp)  { inp.readOnly = false; inp.style.opacity = '1'; }
            if (btn)  { btn.disabled = false; btn.style.opacity = '1'; btn.textContent = 'Submit Feedback'; }
            banner.textContent = 'Share your ' + monthName + ' experience — feedback locks for 1 month after submission.';
            banner.style.color = 'var(--t3)';
        }
    } catch(e) {
        banner.textContent = 'Could not load feedback status.';
    }
}

async function submitMonthlyFeedback() {
    var inp    = document.getElementById('feedback-input');
    var status = document.getElementById('feedback-status');
    if (!inp || !inp.value.trim()) {
        if (status) { status.textContent = 'Please write your feedback.'; status.style.color = '#f87171'; }
        return;
    }
    if (status) { status.textContent = 'Submitting…'; status.style.color = 'var(--t3)'; }

    var now = new Date();
    var monthKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    var name = 'User';
    try { if (window._userProfile) name = window._userProfile.display_name || name; } catch(e) {}

    try {
        if (typeof dbClient === 'undefined' || !currentUserId) throw new Error('Not logged in');
        var res = await dbClient.from('upsc_feedback').insert({
            user_id: currentUserId,
            display_name: name,
            content: inp.value.trim(),
            month_key: monthKey
        });
        if (res.error) throw res.error;
        if (status) { status.textContent = '✓ Feedback submitted for ' + monthKey + '!'; status.style.color = '#10b981'; }
        _loadFeedbackStatus();
    } catch(e) {
        var msg = e.message || 'Error';
        if (msg.includes('unique') || msg.includes('duplicate')) msg = 'Feedback already submitted for this month.';
        if (status) { status.textContent = msg; status.style.color = '#f87171'; }
    }
}

// Store profile reference for name lookup
document.addEventListener('DOMContentLoaded', function() {
    // Expose user profile globally after load
    if (typeof getUserProfile === 'function') {
        setTimeout(async function() {
            if (typeof dbClient !== 'undefined' && typeof currentUserId !== 'undefined' && currentUserId) {
                var r = await dbClient.from('upsc_user_profiles').select('display_name').eq('user_id', currentUserId).single();
                if (r.data) window._userProfile = r.data;
            }
        }, 3000);
    }
});
