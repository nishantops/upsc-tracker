import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ENV } from '../lib/env';

export function Layout() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [elapsed, setElapsed] = useState('just started');
  const [menuOpen, setMenuOpen] = useState(false);

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
          <div className="header-avatar">{ENV.HEADER_AVATAR}</div>
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
              ⚙
            </button>
            {menuOpen && (
              <div className="profile-dropdown">
                <p className="dropdown-email">{user?.email}</p>
                <button className="dropdown-item" onClick={() => signOut()}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content — placeholder for Phase 3+ */}
      <main className="app-main">
        <div className="welcome-card">
          <h2>Welcome, {user?.email?.split('@')[0] || 'User'} 👋</h2>
          <p>
            React migration Phase 1 complete. Auth is working with automatic JWT
            refresh — no more stale sessions.
          </p>
          <p className="status-info">
            ✓ Supabase connected &middot; ✓ Session tracked &middot; ✓ Auto-logout
            after 15 min idle
          </p>
        </div>
      </main>
    </div>
  );
}
