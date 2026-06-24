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
    if (tab === 'contact') { _loadChatHistory(); _markAdminRepliesRead(); }
    if (tab === 'feedback') _loadFeedbackStatus();
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
    if (!_fbStarValue) {
        if (status) { status.textContent = 'Please select a star rating first.'; status.style.color = '#f87171'; }
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
            content: (inp && inp.value.trim()) || '(no message)',
            month_key: monthKey,
            rating: _fbStarValue
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


// ── Star Rating ───────────────────────────────────────────────────────────
var _fbStarValue = 0;

function setFbStar(n) {
    _fbStarValue = n;
    var labels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'];
    var stars = document.querySelectorAll('#star-picker .fb-star');
    stars.forEach(function(s, i) {
        s.textContent = i < n ? '★' : '☆';
        s.style.color  = i < n ? '#f59e0b' : 'var(--t3)';
        s.style.transform = i < n ? 'scale(1.15)' : 'scale(1)';
    });
    var lbl = document.getElementById('star-label');
    if (lbl) lbl.textContent = labels[n] || '';
}

// ── Weekly Feedback Prompt ────────────────────────────────────────────────
var _promptStarVal = 0;
var PROMPT_KEY = 'upsc_fb_prompt_';

function checkWeeklyFeedbackPrompt() {
    if (!currentUserId || typeof dbClient === 'undefined') return;
    var key   = PROMPT_KEY + currentUserId;
    var last  = parseInt(localStorage.getItem(key) || '0');
    var now   = Date.now();
    var week  = 7 * 24 * 3600 * 1000;
    if ((now - last) < week) return;   // shown within last 7 days
    // Check if already submitted this month
    var today = new Date();
    var mk    = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0');
    dbClient.from('upsc_feedback').select('id',{count:'exact',head:true}).eq('user_id',currentUserId).eq('month_key',mk).then(function(r) {
        if (r.count && r.count > 0) return; // already gave feedback this month
        setTimeout(function() { showFeedbackPrompt(); }, 5000); // show after 5s
    });
}

function showFeedbackPrompt() {
    var el = document.getElementById('feedback-prompt');
    if (!el || el.style.display !== 'none') return;
    _promptStarVal = 0;
    var stars = document.querySelectorAll('#prompt-stars .prompt-star');
    stars.forEach(function(s){ s.textContent = '☆'; s.style.color='var(--t3)'; });
    var inp = document.getElementById('prompt-feedback-text');
    if (inp) inp.value = '';
    var st = document.getElementById('prompt-feedback-status');
    if (st) st.textContent = '';
    el.style.display = 'block';
    // Slide in animation
    el.style.transform = 'translateY(20px)'; el.style.opacity = '0'; el.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
    requestAnimationFrame(function(){ el.style.transform='translateY(0)'; el.style.opacity='1'; });
}

function dismissFeedbackPrompt() {
    var el = document.getElementById('feedback-prompt');
    if (!el) return;
    el.style.transform = 'translateY(20px)'; el.style.opacity = '0';
    setTimeout(function(){ el.style.display = 'none'; }, 300);
    localStorage.setItem(PROMPT_KEY + (currentUserId||'x'), String(Date.now()));
}

function setPromptStar(n) {
    _promptStarVal = n;
    var stars = document.querySelectorAll('#prompt-stars .prompt-star');
    stars.forEach(function(s, i) {
        s.textContent = i < n ? '★' : '☆';
        s.style.color  = i < n ? '#f59e0b' : 'var(--t3)';
    });
}

async function submitPromptFeedback() {
    var st = document.getElementById('prompt-feedback-status');
    if (_promptStarVal === 0) { if (st) { st.textContent = 'Please pick a star rating first.'; st.style.color='#f87171'; } return; }
    var inp  = document.getElementById('prompt-feedback-text');
    var txt  = inp ? inp.value.trim() : '';
    var today= new Date();
    var mk   = today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');
    var name = (window._userProfile && window._userProfile.display_name)||'User';
    if (st) { st.textContent = 'Submitting…'; st.style.color='var(--t3)'; }
    try {
        var res = await dbClient.from('upsc_feedback').insert({
            user_id: currentUserId, display_name: name,
            content: txt || '(no message)', month_key: mk, rating: _promptStarVal
        });
        if (res.error && !res.error.message.includes('unique')) throw res.error;
        if (st) { st.textContent = 'Thank you! ⭐ Your feedback helps us improve.'; st.style.color='#10b981'; }
        localStorage.setItem(PROMPT_KEY+(currentUserId||'x'), String(Date.now()));
        setTimeout(dismissFeedbackPrompt, 2500);
        if (typeof trackFeedbackSent === 'function') trackFeedbackSent();
    } catch(e) {
        var msg=e.message||'Error';
        if (msg.includes('unique')||msg.includes('duplicate')) { dismissFeedbackPrompt(); return; }
        if (st) { st.textContent=msg; st.style.color='#f87171'; }
    }
}

// Expose for app to call after login
window.checkWeeklyFeedbackPrompt = checkWeeklyFeedbackPrompt;

// ── Unread message badge on Settings button ───────────────────────────────
async function refreshUnreadBadge() {
    var badge = document.getElementById('msg-unread-badge');
    if (!badge || !currentUserId || typeof dbClient === 'undefined') return;
    try {
        var r = await dbClient.from('upsc_messages')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', currentUserId)
            .eq('sender_type', 'admin')
            .eq('is_read', false);
        var count = r.count || 0;
        if (count > 0) {
            badge.textContent = count > 9 ? '9+' : String(count);
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    } catch(e) {}
}

async function _markAdminRepliesRead() {
    if (!currentUserId || typeof dbClient === 'undefined') return;
    try {
        await dbClient.from('upsc_messages')
            .update({ is_read: true })
            .eq('user_id', currentUserId)
            .eq('sender_type', 'admin')
            .eq('is_read', false);
    } catch(e) {}
    refreshUnreadBadge();
}

// Call on contact tab open
var _origSwitchAboutTab = (typeof switchAboutTab === 'function') ? null : null;
window.refreshUnreadBadge = refreshUnreadBadge;
