import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useProfile } from '../hooks/useProfile';
import { ProfileModal } from './ProfileModal';
import { ENV } from '../lib/env';

export function Layout() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { profile, initials } = useProfile();
  const [elapsed, setElapsed] = useState('just started');
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';

  // Session badge timer
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const secs = Math.floor((Date.now() - start) / 1000);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      setElapsed(h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m` : 'just started');
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="header-avatar">{initials}</div>
          <div>
            <h1 className="header-title">{ENV.APP_NAME}</h1>
            <p className="header-tagline">{ENV.APP_TAGLINE}</p>
          </div>
        </div>

        <div className="header-right">
          <span className="session-badge">Session: {elapsed}</span>

          <button className="theme-btn" onClick={toggle} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <div className="profile-menu-wrap" onClick={(e) => e.stopPropagation()}>
            <button
              className="header-settings-btn"
              onClick={() => setMenuOpen((o) => !o)}
            >
              {initials}
            </button>
            {menuOpen && (
              <div className="profile-dropdown">
                <p className="dropdown-email">{user?.email}</p>
                <p className="dropdown-name">{displayName}</p>
                {profile?.age && (
                  <p className="dropdown-meta">Age {profile.age} · Attempt {profile.attempt}</p>
                )}
                <div className="dropdown-divider" />
                <button
                  className="dropdown-item"
                  onClick={() => {
                    setMenuOpen(false);
                    setProfileModalOpen(true);
                  }}
                >
                  ✏️ Edit Profile
                </button>
                <button className="dropdown-item dropdown-logout" onClick={() => signOut()}>
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content — placeholder for Phase 3+ */}
      <main className="app-main">
        <div className="welcome-card">
          <h2>Welcome, {displayName} 👋</h2>
          <p>
            Phase 2 complete — Profile system with setup wizard, edit modal, and
            feature gates.
          </p>
          <div className="profile-badges">
            {profile?.age && <span className="info-badge">🎂 Age {profile.age}</span>}
            {profile?.attempt && <span className="info-badge">📝 Attempt {profile.attempt}</span>}
            {profile?.optional_subject && profile.optional_subject !== 'none' && (
              <span className="info-badge">
                📚 {profile.optional_subject_custom || profile.optional_subject}
              </span>
            )}
          </div>
          <p className="status-info">
            ✓ Supabase connected · ✓ Session tracked · ✓ Auto-logout ·
            ✓ Profile synced
          </p>
        </div>
      </main>

      {/* Profile edit modal */}
      <ProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </div>
  );
}
