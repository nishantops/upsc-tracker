// =========================================================================
// UPSC Tracker - Profile Module
// =========================================================================

function openProfileEdit() {
    document.getElementById('profile-menu').classList.add('hidden');
    if (currentUserId) localStorage.removeItem('upsc_profile_' + currentUserId);
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('profile-setup-screen').style.display = 'flex';
    const name = document.getElementById('user-display-name').textContent;
    const age = document.getElementById('user-age-text').textContent;
    const attempt = document.getElementById('user-attempt-text').textContent;
    if (name && name !== 'User') document.getElementById('setup-name').value = name;
    if (age && age !== '--') document.getElementById('setup-age').value = age;
    if (attempt && attempt !== '--') document.getElementById('setup-attempt').value = attempt;
    document.getElementById('setup-submit-btn').innerHTML = '💾 Update Profile';
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
        applyProfileToUI({ display_name: 'Sanit', age: null, attempt: null });
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('profile-setup-screen').style.display = 'none';
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById("sync-status-text").innerText = "CONNECTING CLOUD...";
        syncLatestCloudState();
        updateSessionActivity();
        startSessionBadge();
        initFocusMode();
        setTimeout(function() { if (typeof initNotifications === 'function') initNotifications(); }, 2000);
        return;
    }

    // Check localStorage cache first
    const cachedProfile = localStorage.getItem('upsc_profile_' + currentUserId);
    if (cachedProfile) {
        const profile = JSON.parse(cachedProfile);
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
        return;
    }

    // No cache — check DB
    const profile = await getUserProfile();
    if (!profile) {
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('profile-setup-screen').style.display = 'flex';
        return;
    }
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
}

function applyProfileToUI(profile) {
    const name = profile.display_name || 'User';
    document.getElementById('user-display-name').textContent = name;
    const initials = name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('user-avatar').textContent = initials;
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
        } else {
            optBadge.style.display = 'none';
        }
    }
}

function handleProfileSetup() {
    const nameInput = document.getElementById('setup-name');
    const ageInput = document.getElementById('setup-age');
    const attemptInput = document.getElementById('setup-attempt');

    const name = nameInput.value.trim();
    const age = parseInt(ageInput.value);
    const attempt = parseInt(attemptInput.value);

    document.querySelectorAll('.field-error').forEach(el => el.style.display = 'none');
    document.querySelectorAll('#profile-setup-screen input').forEach(el => el.classList.remove('input-error'));

    let hasError = false;

    if (!name || name.length < 2) {
        document.getElementById('err-name').style.display = 'block';
        nameInput.classList.add('input-error');
        hasError = true;
    }
    if (!age || age < 16 || age > 45) {
        document.getElementById('err-age').style.display = 'block';
        ageInput.classList.add('input-error');
        hasError = true;
    }
    if (!attempt || attempt < 1 || attempt > 10) {
        document.getElementById('err-attempt').style.display = 'block';
        attemptInput.classList.add('input-error');
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

    saveUserProfile(name, age, attempt, optSubject, optCustom).then(() => {
        const profile = { display_name: name, age, attempt, optional_subject: optSubject, optional_subject_custom: optCustom };
        localStorage.setItem('upsc_profile_' + currentUserId, JSON.stringify(profile));
        applyProfileToUI(profile);
        document.getElementById('profile-setup-screen').style.display = 'none';
        document.getElementById('app-container').classList.remove('hidden');
        document.getElementById("sync-status-text").innerText = "CONNECTING CLOUD...";
        syncLatestCloudState();
        updateSessionActivity();
    });
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

async function saveUserProfile(name, age, attempt, optSubject, optCustom) {
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
            optional_subject: optSubject || 'none',
            optional_subject_custom: optCustom || ''
        }, { onConflict: 'user_id' });
    } catch(e) { console.error('Failed to save profile:', e); }
}

// Profile setup Enter key navigation
document.getElementById('setup-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('setup-age').focus(); });
document.getElementById('setup-age').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('setup-attempt').focus(); });
document.getElementById('setup-attempt').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleProfileSetup(); });
document.querySelectorAll('#profile-setup-screen input').forEach(input => {
    input.addEventListener('input', () => { input.classList.remove('input-error'); input.nextElementSibling.style.display = 'none'; });
});
