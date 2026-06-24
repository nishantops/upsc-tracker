// =========================================================================
// UPSC Tracker - Profile Module
// =========================================================================

// In-memory mirror of what's currently displayed on the homepage.
// Always kept in sync via applyProfileToUI(); used by openProfileModal()
// so the edit form always shows exactly what the UI shows.
var _activeProfile = {};

function openProfileEdit() {
    document.getElementById('profile-menu').classList.add('hidden');
    openProfileModal();
}

function openProfileModal() {
    var modal = document.getElementById('profile-modal-full');
    if (!modal) return;

    // Use the in-memory profile that mirrors the live homepage UI.
    // Fall back to localStorage only if _activeProfile is empty (edge case).
    var profile = Object.keys(_activeProfile).length > 0 ? Object.assign({}, _activeProfile) : {};
    if (!Object.keys(profile).length) {
        try {
            var cached = currentUserId ? localStorage.getItem('upsc_profile_' + currentUserId) : null;
            if (cached) profile = JSON.parse(cached);
        } catch(e) {}
    }

    // Fill personal fields
    document.getElementById('pm-name').value = profile.display_name || '';
    document.getElementById('pm-age').value = profile.age || '';
    document.getElementById('pm-attempt').value = profile.attempt || '';
    document.getElementById('pm-phone').value = profile.phone || '';

    // Avatar preview
    var name = profile.display_name || 'U';
    var initials = name.split(' ').map(function(w) { return w[0]; }).join('').substring(0, 2).toUpperCase();
    var avatarEl = document.getElementById('pm-avatar-preview');
    if (avatarEl) avatarEl.textContent = initials;

    // Optional subject
    var knownOpts = ['Anthropology','Geography','Public Administration','Sociology','History','Political Science & IR','Philosophy','Law'];
    var optSel = document.getElementById('pm-optional');
    var custWrap = document.getElementById('pm-optional-custom-wrap');
    var custInput = document.getElementById('pm-optional-custom');
    if (optSel) {
        if (!profile.optional_subject || profile.optional_subject === 'none') {
            optSel.value = 'none';
            if (custWrap) custWrap.style.display = 'none';
        } else if (knownOpts.indexOf(profile.optional_subject) !== -1) {
            optSel.value = profile.optional_subject;
            if (custWrap) custWrap.style.display = 'none';
        } else {
            optSel.value = 'custom';
            if (custWrap) custWrap.style.display = 'block';
            if (custInput) custInput.value = profile.optional_subject_custom || profile.optional_subject;
        }
    }

    // Email (async)
    var emailEl = document.getElementById('pm-email-display');
    if (emailEl) {
        emailEl.textContent = profile.email || '—';
        if (!profile.email) {
            try {
                dbClient.auth.getSession().then(function(r) {
                    if (r.data && r.data.session) emailEl.textContent = r.data.session.user.email || '—';
                });
            } catch(e) {}
        }
    }

    // Member since
    var sinceEl = document.getElementById('pm-since-display');
    if (sinceEl && profile.created_at) {
        sinceEl.textContent = 'Member since ' + new Date(profile.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } else if (sinceEl) {
        sinceEl.textContent = '';
    }

    // S&W section
    if (typeof renderSWInProfileModal === 'function') renderSWInProfileModal();
    var pmSWToggle = document.getElementById('pm-sw-homepage-toggle');
    if (pmSWToggle && typeof _swData !== 'undefined') pmSWToggle.checked = !!_swData.show_sw;

    // Clear validation errors
    document.querySelectorAll('.pm-err').forEach(function(e) { e.style.display = 'none'; });
    document.querySelectorAll('#profile-modal-full input, #profile-modal-full select').forEach(function(el) {
        el.classList.remove('input-error');
    });

    modal.classList.remove('hidden');
    setTimeout(function() { var n = document.getElementById('pm-name'); if (n) n.focus(); }, 50);
}

function closeProfileModal() {
    var modal = document.getElementById('profile-modal-full');
    if (modal) modal.classList.add('hidden');
}

async function saveProfileModal() {
    var nameEl    = document.getElementById('pm-name');
    var ageEl     = document.getElementById('pm-age');
    var attemptEl = document.getElementById('pm-attempt');
    var phoneEl   = document.getElementById('pm-phone');

    var name    = nameEl.value.trim();
    var age     = parseInt(ageEl.value);
    var attempt = parseInt(attemptEl.value);
    var phone   = phoneEl.value.trim();

    // Clear errors
    document.querySelectorAll('.pm-err').forEach(function(e) { e.style.display = 'none'; });
    var hasError = false;

    if (!name || name.length < 2 || !/^[A-Za-z][A-Za-z\s\.'-]{1,49}$/.test(name)) {
        document.getElementById('pm-err-name').style.display = 'block';
        nameEl.focus();
        hasError = true;
    }
    if (!age || age < 16 || age > 45) {
        document.getElementById('pm-err-age').style.display = 'block';
        hasError = true;
    }
    if (!attempt || attempt < 1 || attempt > 10) {
        document.getElementById('pm-err-attempt').style.display = 'block';
        hasError = true;
    }
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
        document.getElementById('pm-err-phone').style.display = 'block';
        hasError = true;
    }
    if (hasError) return;

    var optSel    = document.getElementById('pm-optional');
    var optSubject = optSel ? optSel.value : 'none';
    var optCustom  = '';
    if (optSubject === 'custom') {
        var custEl = document.getElementById('pm-optional-custom');
        optCustom = custEl ? custEl.value.trim() : '';
    }

    var btn = document.getElementById('pm-save-btn');
    btn.disabled = true;
    btn.textContent = '✨ Saving…';

    try {
        await saveUserProfile(name, age, attempt, optSubject, optCustom, phone);
        // Merge with existing cache to preserve features_enabled, created_at etc.
        var existingCache = {};
        try { existingCache = JSON.parse(localStorage.getItem('upsc_profile_' + currentUserId) || '{}'); } catch(e) {}
        var updatedProfile = Object.assign({}, existingCache, {
            display_name: name, age: age, attempt: attempt,
            optional_subject: optSubject, optional_subject_custom: optCustom,
            phone: phone || ''
        });
        localStorage.setItem('upsc_profile_' + currentUserId, JSON.stringify(updatedProfile));
        applyProfileToUI(updatedProfile);
        closeProfileModal();
        if (typeof showToast === 'function') showToast('Profile updated ✓', 'success');
    } catch(e) {
        if (typeof showToast === 'function') showToast('Failed to save. Please try again.', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Save Profile';
    }
}

async function showApp(knownEmail) {
    let userEmail = knownEmail || null;
    if (!userEmail) {
        try {
            const { data: { session } } = await dbClient.auth.getSession();
            if (session) userEmail = session.user.email;
        } catch(e) {}
    }

    // Superuser bypasses profile setup entirely
    if (isSuperuser(userEmail)) {
        // Load actual saved profile (not hardcoded name) so homepage + modal stay in sync
        var spFallback = { display_name: 'Sanit', age: null, attempt: null, features_enabled: SUPERUSER_FEATURES };
        var spCached = currentUserId ? localStorage.getItem('upsc_profile_' + currentUserId) : null;
        if (spCached) {
            try {
                var spParsed = JSON.parse(spCached);
                spFallback = Object.assign({}, spParsed, { features_enabled: SUPERUSER_FEATURES });
            } catch(e) {}
        }
        applyProfileToUI(spFallback);
        // Also fetch latest from DB in background and update
        getUserProfile().then(function(p) {
            if (p) {
                var merged = Object.assign({}, p, { features_enabled: SUPERUSER_FEATURES });
                if (currentUserId) localStorage.setItem('upsc_profile_' + currentUserId, JSON.stringify(merged));
                applyProfileToUI(merged);
            }
        }).catch(function() {});
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('profile-setup-screen').style.display = 'none';
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById("sync-status-text").innerText = "CONNECTING CLOUD...";
        syncLatestCloudState();
        updateSessionActivity();
        startSessionBadge();
        initFocusMode();
        setTimeout(function() { if (typeof initNotifications === 'function') initNotifications(); }, 2000);
        setTimeout(function() { if (typeof loadSWData === 'function') loadSWData(); }, 800);
        setTimeout(function() { if (typeof checkWeeklyFeedbackPrompt === 'function') checkWeeklyFeedbackPrompt(); }, 8000);
        setTimeout(function() { if (typeof refreshUnreadBadge === 'function') refreshUnreadBadge(); }, 5000);
        // Poll for new admin messages every 2 minutes
        setInterval(function() { if (typeof refreshUnreadBadge === 'function') refreshUnreadBadge(); }, 120000);
        return;
    }

    // Apply cached profile for instant UI rendering (avatar, name etc.)
    // but ALWAYS verify against DB — catches deleted/admin-removed profiles
    const cachedStr = currentUserId ? localStorage.getItem('upsc_profile_' + currentUserId) : null;
    let cachedProfile = null;
    if (cachedStr) {
        try { cachedProfile = JSON.parse(cachedStr); } catch(e) {}
        if (cachedProfile) applyProfileToUI(cachedProfile); // fast render while DB loads
    }

    // Always check DB (protects against deleted rows, locked accounts, etc.)
    const profile = await getUserProfile();
    if (!profile) {
        // Profile not in DB — clear stale cache and show profile setup
        if (currentUserId) localStorage.removeItem('upsc_profile_' + currentUserId);
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-container').classList.add('hidden');
        // Welcome new users with a first-time prompt
        var setupTitle = document.querySelector('#profile-setup-screen h2');
        var setupSub   = document.querySelector('#profile-setup-screen h2 + p, #profile-setup-screen .text-center p');
        if (setupTitle) setupTitle.textContent = 'Welcome! Set Up Your Profile';
        if (setupSub) setupSub.textContent = 'Just a few details to personalise your UPSC Command Center';
        document.getElementById('profile-setup-screen').style.display = 'flex';
        return;
    }

    // Profile confirmed in DB — check if required fields are complete
    if (!isProfileComplete(profile)) {
        localStorage.setItem('upsc_profile_' + currentUserId, JSON.stringify(profile));
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('app-container').classList.add('hidden');
        _prefillSetupScreen(profile);
        var setupTitle2 = document.querySelector('#profile-setup-screen h2');
        var setupSub2   = document.querySelector('#profile-setup-screen p');
        if (setupTitle2) setupTitle2.textContent = 'Complete Your Profile';
        if (setupSub2) setupSub2.textContent = 'Please fill in the missing fields to unlock your Command Center';
        document.getElementById('profile-setup-screen').style.display = 'flex';
        return;
    }

    // Profile confirmed in DB — refresh cache and show app
    localStorage.setItem('upsc_profile_' + currentUserId, JSON.stringify(profile));
    applyProfileToUI(profile);
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('profile-setup-screen').style.display = 'none';
    document.getElementById('app-container').classList.remove('hidden');
    document.getElementById("sync-status-text").innerText = "CONNECTING CLOUD...";
    syncLatestCloudState();
    updateSessionActivity();
    startSessionBadge();
    initFocusMode();
    setTimeout(function() { if (typeof initNotifications === 'function') initNotifications(); }, 2000);
    setTimeout(function() { if (typeof loadSWData === 'function') loadSWData(); }, 800);
    setTimeout(function() { if (typeof checkWeeklyFeedbackPrompt === 'function') checkWeeklyFeedbackPrompt(); }, 8000);
    setTimeout(function() { if (typeof refreshUnreadBadge === 'function') refreshUnreadBadge(); }, 5000);
    setInterval(function() { if (typeof refreshUnreadBadge === 'function') refreshUnreadBadge(); }, 120000);
}

function applyProfileToUI(profile) {
    // Keep in-memory mirror in sync so openProfileModal always shows current data
    _activeProfile = Object.assign({}, profile);
    const name = profile.display_name || 'User';
    document.getElementById('user-display-name').textContent = name;
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('user-avatar').textContent = initials;
    // Sync the header settings button initials too
    var hsa = document.getElementById('header-settings-avatar');
    if (hsa) hsa.textContent = initials;
    document.title = name + ' \u2022 UPSC CSE Command Center 2027';

    if (profile.age) {
        document.getElementById('user-age-text').textContent = profile.age;
        document.getElementById('user-age-badge').style.display = 'flex';
    }
    if (profile.attempt) {
        document.getElementById('user-attempt-text').textContent = profile.attempt;
        document.getElementById('user-attempt-badge').style.display = 'flex';
    }
    var optBadge = document.getElementById('user-optional-badge');
    if (optBadge) {
        var optText = profile.optional_subject_custom || profile.optional_subject || '';
        if (optText && optText !== 'none') {
            optBadge.style.display = 'flex';
            var optSpan = optBadge.querySelector('.optional-badge-chip');
            if (optSpan) optSpan.textContent = optText;
            applyOptionalSubjectLabels(optText);
        } else {
            optBadge.style.display = 'none';
        }
    }
    // Apply feature toggles from admin RBAC
    applyFeatureGates(profile.features_enabled);
}

// ── Dynamic optional subject labels ──────────────────────────────────────
function applyOptionalSubjectLabels(optText) {
    if (!optText || optText === 'none') optText = 'Optional';
    var shortName = optText.length > 14 ? optText.substring(0, 12) + '…' : optText;

    // Stage III button
    var btnStage = document.getElementById('btn-stage-anthro');
    if (btnStage) btnStage.textContent = 'Stage III: ' + shortName;

    // Panel headings
    var p1 = document.getElementById('panel-anthro-p1');
    if (p1) { var h1 = p1.querySelector('h2'); if (h1) h1.textContent = optText + ': Paper I'; }
    var p2 = document.getElementById('panel-anthro-p2');
    if (p2) { var h2 = p2.querySelector('h2'); if (h2) h2.textContent = optText + ': Paper II'; }

    // Pie chart labels
    var pieA1 = document.getElementById('pie-a1');
    if (pieA1) {
        var card1 = pieA1.closest ? pieA1.closest('.pie-card-dark') : null;
        if (card1) {
            var lbl1 = card1.querySelector('.pie-label');
            if (lbl1) { var sp1 = lbl1.querySelector('span'); lbl1.textContent = shortName + ' P1 '; if (sp1) lbl1.appendChild(sp1); }
        }
    }
    var pieA2 = document.getElementById('pie-a2');
    if (pieA2) {
        var card2 = pieA2.closest ? pieA2.closest('.pie-card-dark') : null;
        if (card2) {
            var lbl2 = card2.querySelector('.pie-label');
            if (lbl2) { var sp2 = lbl2.querySelector('span'); lbl2.textContent = shortName + ' P2 '; if (sp2) lbl2.appendChild(sp2); }
        }
    }

    // Add-topic modal dropdown
    var sel = document.getElementById('modal-select-panel');
    if (sel) {
        sel.querySelectorAll('option').forEach(function(opt) {
            if (opt.value === 'box-anthro-p1') opt.textContent = shortName + ' Paper I';
            if (opt.value === 'box-anthro-p2') opt.textContent = shortName + ' Paper II';
            if (opt.value === 'box-anthro-asn') opt.textContent = shortName + ' Assignments';
        });
    }

    // PYQ tab buttons + panel headings
    var pyqT1 = document.getElementById('pyq-tab-opt-p1');
    if (pyqT1) pyqT1.textContent = shortName + ' P1';
    var pyqT2 = document.getElementById('pyq-tab-opt-p2');
    if (pyqT2) pyqT2.textContent = shortName + ' P2';
    var pyqH1 = document.getElementById('pyq-opt-p1-heading');
    if (pyqH1) pyqH1.textContent = 'PYQ: ' + optText + ' Paper I';
    var pyqH2 = document.getElementById('pyq-opt-p2-heading');
    if (pyqH2) pyqH2.textContent = 'PYQ: ' + optText + ' Paper II';

    // If NOT Anthropology, clear pre-populated Anthro syllabus topics
    // and show a setup guide with inline Add Topic button
    if (optText && optText !== 'Anthropology' && optText !== 'Optional') {
        var b1 = document.getElementById('box-anthro-p1');
        var b2 = document.getElementById('box-anthro-p2');
        var guide = function(label, boxId) {
            return '<div style="text-align:center;padding:2rem 1.5rem;color:var(--t3);border:1px dashed var(--bdr);border-radius:1rem;margin-bottom:0.75rem;">'
                + '<div style="font-size:1.5rem;margin-bottom:0.5rem">📚</div>'
                + '<div style="font-size:0.8rem;font-weight:700;color:var(--t2);margin-bottom:0.35rem">' + label + ' — Custom Setup</div>'
                + '<div style="font-size:0.72rem;line-height:1.7;margin-bottom:1rem;">Add your ' + optText + ' ' + label + ' syllabus topics here.</div>'
                + '<button onclick="openCustomTopicModalForPanel(\'' + boxId + '\')" style="background:linear-gradient(135deg,#7c3aed,#6366f1);border:none;color:#fff;border-radius:0.6rem;padding:0.5rem 1.25rem;font-size:0.75rem;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,0.35);">➕ Add ' + label + ' Topic</button>'
                + '</div>';
        };
        if (b1) b1.innerHTML = guide('Paper I', 'box-anthro-p1');
        if (b2) b2.innerHTML = guide('Paper II', 'box-anthro-p2');

        // PYQ panels for non-Anthro: replace Anthro PYQ data with custom add interface
        var pq1 = document.getElementById('anthro-p1-topics-container');
        var pq2 = document.getElementById('anthro-p2-topics-container');
        var pyqGuide = function(label, panelId) {
            return '<div style="text-align:center;padding:2.5rem 1.5rem;color:var(--t3);border:1px dashed rgba(139,92,246,0.25);border-radius:1rem;">'
                + '<div style="font-size:1.5rem;margin-bottom:0.5rem">📝</div>'
                + '<div style="font-size:0.82rem;font-weight:700;color:var(--t2);margin-bottom:0.4rem">No pre-loaded PYQ for ' + optText + ' ' + label + '</div>'
                + '<div style="font-size:0.72rem;line-height:1.7;margin-bottom:1rem;">Add your own PYQ questions as custom topics to track practice.</div>'
                + '<button onclick="openCustomTopicModalForPanel(\'' + panelId + '\')" style="background:linear-gradient(135deg,#7c3aed,#6366f1);border:none;color:#fff;border-radius:0.6rem;padding:0.5rem 1.25rem;font-size:0.75rem;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,0.35);">➕ Add ' + optText + ' ' + label + ' PYQ</button>'
                + '</div>';
        };
        if (pq1) pq1.innerHTML = pyqGuide('Paper I', 'box-anthro-p1');
        if (pq2) pq2.innerHTML = pyqGuide('Paper II', 'box-anthro-p2');
        // Update PYQ total count to 0 for non-Anthro
        var tc1 = document.getElementById('anthro-p1-total-count');
        var tc2 = document.getElementById('anthro-p2-total-count');
        if (tc1) tc1.textContent = '0';
        if (tc2) tc2.textContent = '0';
    }
}

// Default features for new users — ai_chat OFF until admin enables it
var DEFAULT_FEATURES = { focus: true, plans: true, ai_chat: false, pyq: true, sources: true };
// Superuser always gets everything
var SUPERUSER_FEATURES = { focus: true, plans: true, ai_chat: true, pyq: true, sources: true };

function applyFeatureGates(features) {
    // Merge with defaults so missing keys behave correctly
    var f = Object.assign({}, DEFAULT_FEATURES, features || {});
    // Focus mode
    var focusWidget = document.getElementById('focus-mode-widget');
    if (focusWidget) focusWidget.style.display = f.focus === false ? 'none' : '';
    // Plans tab
    var plansTab = document.querySelector('[onclick*="plans"]');
    if (plansTab) plansTab.style.display = f.plans === false ? 'none' : '';
    // AI Chat fab
    var aiFab = document.getElementById('ai-chat-fab');
    if (aiFab) aiFab.style.display = f.ai_chat === false ? 'none' : '';
    var aiPanel = document.getElementById('ai-chat-panel');
    if (aiPanel && f.ai_chat === false) aiPanel.classList.add('hidden');
    // PYQ tab
    var pyqTab = document.querySelector('[onclick*="pyq"]');
    if (pyqTab) pyqTab.style.display = f.pyq === false ? 'none' : '';
    // Sources tab
    var srcTab = document.querySelector('[onclick*="sources"]');
    if (srcTab) srcTab.style.display = f.sources === false ? 'none' : '';
}

function handleProfileSetup() {
    const nameInput    = document.getElementById('setup-name');
    const ageInput     = document.getElementById('setup-age');
    const attemptInput = document.getElementById('setup-attempt');
    const phoneInput   = document.getElementById('setup-phone');

    const name    = nameInput.value.trim();
    const age     = parseInt(ageInput.value);
    const attempt = parseInt(attemptInput.value);
    const phone   = phoneInput ? phoneInput.value.trim() : '';

    document.querySelectorAll('.field-error').forEach(el => el.style.display = 'none');
    document.querySelectorAll('#profile-setup-screen input').forEach(el => el.classList.remove('input-error'));

    let hasError = false;

    // Name: 2-50 chars, letters/spaces only
    if (!name || name.length < 2 || !/^[A-Za-z][A-Za-z\s\.'-]{1,49}$/.test(name)) {
        document.getElementById('err-name').style.display = 'block';
        document.getElementById('err-name').textContent = 'Enter a valid full name (letters, spaces, . \' - only; min 2 chars)';
        nameInput.classList.add('input-error');
        hasError = true;
    }
    // Age: 16-45
    if (!age || age < 16 || age > 45) {
        document.getElementById('err-age').style.display = 'block';
        ageInput.classList.add('input-error');
        hasError = true;
    }
    // Attempt: 1-10
    if (!attempt || attempt < 1 || attempt > 10) {
        document.getElementById('err-attempt').style.display = 'block';
        attemptInput.classList.add('input-error');
        hasError = true;
    }
    // Phone: optional, but if provided must be valid 10-digit Indian mobile (starts with 6-9)
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
        document.getElementById('err-phone').style.display = 'block';
        if (phoneInput) phoneInput.classList.add('input-error');
        hasError = true;
    }

    if (hasError) return;

    var optEl     = document.getElementById('setup-optional');
    var optCustEl = document.getElementById('setup-optional-custom');
    var optSubject = optEl ? optEl.value : 'none';
    var optCustom  = (optSubject === 'custom' && optCustEl) ? optCustEl.value.trim() : '';

    const btn = document.getElementById('setup-submit-btn');
    btn.style.opacity = '0.6';
    btn.textContent = '✨ Setting up...';

    saveUserProfile(name, age, attempt, optSubject, optCustom, phone).then(() => {
        const profile = { display_name: name, age, attempt, optional_subject: optSubject, optional_subject_custom: optCustom, phone: phone || '' };
        localStorage.setItem('upsc_profile_' + currentUserId, JSON.stringify(profile));
        applyProfileToUI(profile);
        document.getElementById('profile-setup-screen').style.display = 'none';
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById("sync-status-text").innerText = "CONNECTING CLOUD...";
        syncLatestCloudState();
        updateSessionActivity();
        startSessionBadge();
        initFocusMode();
        setTimeout(function() { if (typeof initNotifications === 'function') initNotifications(); }, 2000);
        setTimeout(function() { if (typeof loadSWData === 'function') loadSWData(); }, 800);
    });
}

function isProfileComplete(p) {
    if (!p) return false;
    var name = (p.display_name || '').trim();
    var age  = parseInt(p.age);
    var att  = parseInt(p.attempt);
    return name.length >= 2 && age >= 16 && age <= 45 && att >= 1 && att <= 10;
}

function _prefillSetupScreen(p) {
    if (!p) return;
    var n = document.getElementById('setup-name');
    var a = document.getElementById('setup-age');
    var t = document.getElementById('setup-attempt');
    var ph = document.getElementById('setup-phone');
    if (n && p.display_name) n.value = p.display_name;
    if (a && p.age)          a.value = p.age;
    if (t && p.attempt)      t.value = p.attempt;
    if (ph && p.phone)       ph.value = p.phone;
    var knownOpts = ['Anthropology','Geography','Public Administration','Sociology','History','Political Science & IR','Philosophy','Law'];
    var optSel = document.getElementById('setup-optional');
    if (optSel && p.optional_subject && p.optional_subject !== 'none') {
        if (knownOpts.indexOf(p.optional_subject) !== -1) {
            optSel.value = p.optional_subject;
        } else {
            optSel.value = 'custom';
            var cw = document.getElementById('setup-optional-custom-wrap');
            var ci = document.getElementById('setup-optional-custom');
            if (cw) cw.style.display = 'block';
            if (ci) ci.value = p.optional_subject_custom || p.optional_subject;
        }
    }
}

async function getUserProfile() {
    if (!dbClient || !currentUserId) return null;
    try {
        const { data, error } = await dbClient.from('upsc_user_profiles').select('*').eq('user_id', currentUserId).maybeSingle();
        if (error) return null;
        if (data && data.display_name) return data;
    } catch(e) {}
    return null;
}

async function saveUserProfile(name, age, attempt, optSubject, optCustom, phone) {
    if (!dbClient || !currentUserId) return;
    try {
        const { data: { session } } = await dbClient.auth.getSession();
        const email = session?.user?.email || null;
        await dbClient.from('upsc_user_profiles').upsert({
            user_id: currentUserId,
            display_name: name,
            age: age,
            attempt: attempt,
            email: email,
            phone: phone || null,
            optional_subject: optSubject || 'none',
            optional_subject_custom: optCustom || ''
        }, { onConflict: 'user_id' });
    } catch(e) { console.error('Failed to save profile:', e); }
}

// Profile setup Enter key navigation
document.getElementById('setup-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('setup-age').focus(); });
document.getElementById('setup-age').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('setup-attempt').focus(); });
document.getElementById('setup-attempt').addEventListener('keydown', (e) => { if (e.key === 'Enter') { var ph = document.getElementById('setup-phone'); ph ? ph.focus() : handleProfileSetup(); } });
document.getElementById('setup-phone') && document.getElementById('setup-phone').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleProfileSetup(); });
document.querySelectorAll('#profile-setup-screen input').forEach(input => {
    input.addEventListener('input', () => {
        input.classList.remove('input-error');
        if (input.nextElementSibling && input.nextElementSibling.classList.contains('field-error')) {
            input.nextElementSibling.style.display = 'none';
        }
    });
});

// Profile modal Enter key navigation
document.getElementById('pm-name').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('pm-age').focus(); });
document.getElementById('pm-age').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('pm-attempt').focus(); });
document.getElementById('pm-attempt').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('pm-phone').focus(); });
document.getElementById('pm-phone').addEventListener('keydown', function(e) { if (e.key === 'Enter') saveProfileModal(); });
