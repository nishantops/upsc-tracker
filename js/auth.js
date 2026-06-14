// =========================================================================
// UPSC Tracker - Authentication Module
// =========================================================================

function ensureClient() {
    if (!dbClient && window.supabase) { dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); }
    return dbClient;
}

function isSuperuser(email) {
    return email && (email.toLowerCase() === SUPERUSER_EMAIL || email.toLowerCase() === SUPERUSER_ALIAS);
}

function resolveEmail(input) {
    if (input.toLowerCase() === SUPERUSER_ALIAS) return SUPERUSER_EMAIL;
    return input;
}

async function handleLogin() {
    let email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errEl = document.getElementById('auth-error');
    const btn = document.getElementById('auth-login-btn');

    if (!email || !password) { errEl.style.display = 'block'; errEl.textContent = 'Email and password required.'; return; }

    email = resolveEmail(email);
    btn.style.opacity = '0.5'; btn.textContent = 'SIGNING IN...';
    errEl.style.display = 'none';

    try {
        if (!ensureClient()) throw new Error('Supabase script blocked');
        const { data, error } = await dbClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUserId = data.user.id;
        await recordSession(data.user.email);
        showApp(data.user.email);
    } catch(e) {
        btn.style.opacity = '1'; btn.textContent = 'SIGN IN';
        errEl.style.display = 'block';
        errEl.textContent = e.message || 'Authentication failed.';
    }
}

async function handleSignup() {
    let email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errEl = document.getElementById('auth-error');
    const btn = document.getElementById('auth-signup-btn');

    if (!email || !password) { errEl.style.display = 'block'; errEl.textContent = 'Email and password required.'; return; }
    if (password.length < 6) { errEl.style.display = 'block'; errEl.textContent = 'Password must be at least 6 characters.'; return; }

    email = resolveEmail(email);
    btn.style.opacity = '0.5'; btn.textContent = 'CREATING...';
    errEl.style.display = 'none';

    try {
        if (!ensureClient()) throw new Error('Supabase script blocked');
        const { data, error } = await dbClient.auth.signUp({ email, password });
        if (error) throw error;
        if (data.user && data.session) {
            currentUserId = data.user.id;
            await recordSession(data.user.email);
            showApp(data.user.email);
        } else {
            btn.style.opacity = '1'; btn.textContent = 'SIGN UP';
            errEl.style.display = 'block';
            errEl.style.color = '#059669';
            errEl.textContent = '✓ Account created! Check your email to confirm, then sign in.';
        }
    } catch(e) {
        btn.style.opacity = '1'; btn.textContent = 'SIGN UP';
        errEl.style.display = 'block';
        errEl.style.color = '#e11d48';
        errEl.textContent = e.message || 'Signup failed.';
    }
}

async function handleGoogleLogin() {
    const errEl = document.getElementById('auth-error');
    errEl.style.display = 'none';
    try {
        if (!ensureClient()) throw new Error('Supabase script blocked');
        const { error } = await dbClient.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + '/upsc-tracker/' }
        });
        if (error) throw error;
    } catch(e) {
        errEl.style.display = 'block';
        errEl.textContent = e.message || 'Google sign-in failed.';
    }
}

async function handleLogout(force) {
    if (!force && !confirm('Are you sure you want to logout? Your progress is auto-saved.')) return;
    if (dbClient) { await dbClient.auth.signOut(); }
    dbClient = null;
    currentUserId = null;
    document.getElementById('app-container').classList.add('hidden');
    document.getElementById('auth-screen').style.display = 'flex';
    document.getElementById('auth-password').value = '';
    document.getElementById('profile-menu').classList.add('hidden');
}

function toggleProfileMenu() {
    document.getElementById('profile-menu').classList.toggle('hidden');
}

// Close profile menu when clicking outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('profile-menu');
    const avatar = document.getElementById('user-avatar');
    if (menu && !menu.contains(e.target) && !avatar.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

// ===== SESSION TRACKING =====
async function recordSession(userEmail) {
    if (!dbClient || !currentUserId) return;
    try {
        await dbClient.from('upsc_user_sessions').upsert({
            user_id: currentUserId,
            email: userEmail,
            is_superuser: isSuperuser(userEmail),
            login_at: new Date().toISOString(),
            last_active: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch(e) { /* non-critical */ }
}

async function updateSessionActivity() {
    if (!dbClient || !currentUserId) return;
    try {
        const { data: { session } } = await dbClient.auth.getSession();
        if (!session) return;
        await dbClient.from('upsc_user_sessions').upsert({
            user_id: currentUserId,
            email: session.user.email,
            is_superuser: isSuperuser(session.user.email),
            last_active: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch(e) { /* non-critical */ }
}

async function checkAutoLogout() {
    if (!dbClient || !currentUserId) return;
    try {
        const { data: { session } } = await dbClient.auth.getSession();
        if (!session) return;
        if (isSuperuser(session.user.email)) return;
        const { data } = await dbClient.from('upsc_user_sessions').select('last_active').eq('user_id', currentUserId).single();
        if (data && data.last_active) {
            if (Date.now() - new Date(data.last_active).getTime() > AUTO_LOGOUT_MS) {
                handleLogout(true);
            }
        }
    } catch(e) { /* non-critical */ }
}

// Update activity every 5 minutes, check auto-logout every minute
setInterval(updateSessionActivity, 5 * 60 * 1000);
setInterval(checkAutoLogout, 60 * 1000);

// Allow Enter key to submit login
document.getElementById('auth-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
document.getElementById('auth-email').addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('auth-password').focus(); });

// ===== DOMContentLoaded — Main Entry Point =====
document.addEventListener('DOMContentLoaded', async () => {
    if (!window.supabase) {
        document.getElementById('auth-error').style.display = 'block';
        document.getElementById('auth-error').textContent = 'Supabase script blocked. Check network.';
        return;
    }
    dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: { session } } = await dbClient.auth.getSession();
    if (session) {
        currentUserId = session.user.id;
        await recordSession(session.user.email || session.user.phone);
        showApp(session.user.email);
        // Lazy auto-logout check (non-blocking)
        if (!isSuperuser(session.user.email)) {
            dbClient.from('upsc_user_sessions').select('last_active').eq('user_id', session.user.id).single().then(({ data }) => {
                if (data && data.last_active && Date.now() - new Date(data.last_active).getTime() > AUTO_LOGOUT_MS) {
                    handleLogout(true);
                }
            });
        }
    }
});
