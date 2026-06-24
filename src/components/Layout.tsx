import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useProfile } from '../hooks/useProfile';
import { ProfileModal } from './ProfileModal';
import { Countdown } from './Countdown';
import { SyllabusView } from './syllabus/SyllabusView';
import { PlansGrid } from './plans/PlansGrid';
import { SourcesView } from './sources/SourcesView';
import { PYQBrowser } from './pyq/PYQBrowser';
import { FocusWidget } from './focus/FocusWidget';
import { TestSeriesView } from './testseries/TestSeriesView';
import { ENV } from '../lib/env';
import {
  DEFAULT_NAV,
  type NavState,
  type RootTab,
  type MarathonTab,
  type PlannerTab,
  type StageTab,
} from '../lib/navigation';

export function Layout() {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const { profile, initials, features } = useProfile();
  const [elapsed, setElapsed] = useState('just started');
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [nav, setNav] = useState<NavState>(DEFAULT_NAV);

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'User';

  const setRoot = (root: RootTab) => setNav((n) => ({ ...n, root }));
  const setMarathon = (marathon: MarathonTab) => setNav((n) => ({ ...n, marathon }));
  const setPlanner = (planner: PlannerTab) => setNav((n) => ({ ...n, planner }));
  const setStage = (stage: StageTab) => setNav((n) => ({ ...n, stage }));

  // Session badge
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
      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-left">
          <div className="header-avatar">{initials}</div>
          <div>
            <h1 className="header-title">{ENV.APP_NAME}</h1>
            <p className="header-tagline">{ENV.APP_TAGLINE}</p>
          </div>
        </div>

        <Countdown />

        <div className="header-right">
          <FocusWidget />
          <span className="session-badge">Session: {elapsed}</span>
          <button className="theme-btn" onClick={toggle} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div className="profile-menu-wrap" onClick={(e) => e.stopPropagation()}>
            <button className="header-settings-btn" onClick={() => setMenuOpen((o) => !o)}>
              {initials}
            </button>
            {menuOpen && (
              <div className="profile-dropdown">
                <p className="dropdown-email">{user?.email}</p>
                <p className="dropdown-name">{displayName}</p>
                {profile?.age && (
                  <p className="dropdown-meta">
                    Age {profile.age} · Attempt {profile.attempt}
                  </p>
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

      {/* ── Root Tabs: Marathon / Planner ────────────────────────── */}
      <nav className="root-tabs">
        <TabBtn active={nav.root === 'marathon'} onClick={() => setRoot('marathon')} variant="root">
          Marathon
        </TabBtn>
        {features.plans !== false && (
          <TabBtn active={nav.root === 'planner'} onClick={() => setRoot('planner')} variant="root">
            Planner
          </TabBtn>
        )}
      </nav>

      {/* ── Marathon View ────────────────────────────────────────── */}
      {nav.root === 'marathon' && (
        <>
          <nav className="sub-tabs">
            <TabBtn active={nav.marathon === 'syllabus'} onClick={() => setMarathon('syllabus')} variant="sub">
              Syllabus
            </TabBtn>
            <TabBtn active={nav.marathon === 'ca'} onClick={() => setMarathon('ca')} variant="sub">
              Current Affairs
            </TabBtn>
            {features.pyq !== false && (
              <TabBtn active={nav.marathon === 'pyq'} onClick={() => setMarathon('pyq')} variant="sub">
                PYQ
              </TabBtn>
            )}
            <TabBtn active={nav.marathon === 'testseries'} onClick={() => setMarathon('testseries')} variant="sub">
              Test Series
            </TabBtn>
          </nav>

          {/* Stage tabs (Syllabus view) */}
          {nav.marathon === 'syllabus' && (
            <>
              <nav className="stage-tabs">
                <TabBtn active={nav.stage === 'prelims'} onClick={() => setStage('prelims')} variant="stage">
                  Stage I: Prelims
                </TabBtn>
                <TabBtn active={nav.stage === 'mains'} onClick={() => setStage('mains')} variant="stage">
                  Stage II: Mains
                </TabBtn>
                <TabBtn active={nav.stage === 'anthro'} onClick={() => setStage('anthro')} variant="stage">
                  Stage III: {profile?.optional_subject && profile.optional_subject !== 'none'
                    ? (profile.optional_subject_custom || profile.optional_subject).substring(0, 14)
                    : 'Optional'}
                </TabBtn>
              </nav>

              <main className="app-main">
                <SyllabusView stage={nav.stage} />
              </main>
            </>
          )}

          {nav.marathon === 'ca' && (
            <main className="app-main">
              <SyllabusView stage="prelims" />
            </main>
          )}

          {nav.marathon === 'pyq' && (
            <main className="app-main">
              <PYQBrowser />
            </main>
          )}

          {nav.marathon === 'testseries' && (
            <main className="app-main">
              <TestSeriesView />
            </main>
          )}
        </>
      )}

      {/* ── Planner View ─────────────────────────────────────────── */}
      {nav.root === 'planner' && (
        <>
          <nav className="sub-tabs">
            <TabBtn active={nav.planner === 'master'} onClick={() => setPlanner('master')} variant="sub">
              Master Plan
            </TabBtn>
            <TabBtn active={nav.planner === 'plans'} onClick={() => setPlanner('plans')} variant="sub">
              My Plans
            </TabBtn>
            {features.sources !== false && (
              <TabBtn active={nav.planner === 'sources'} onClick={() => setPlanner('sources')} variant="sub">
                Sources
              </TabBtn>
            )}
          </nav>

          <main className="app-main">
            {nav.planner === 'master' && <Placeholder label="Master Plan (Gantt + Pie + Calendar)" phase={8} />}
            {nav.planner === 'plans' && <PlansGrid />}
            {nav.planner === 'sources' && <SourcesView />}
          </main>
        </>
      )}

      {/* Profile modal */}
      <ProfileModal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} />
    </div>
  );
}

// ── Tab button component ─────────────────────────────────────────────────────
function TabBtn({
  active,
  onClick,
  variant,
  children,
}: {
  active: boolean;
  onClick: () => void;
  variant: 'root' | 'sub' | 'stage';
  children: React.ReactNode;
}) {
  const base = `tab-btn tab-${variant}`;
  return (
    <button className={`${base} ${active ? 'tab-active' : ''}`} onClick={onClick}>
      {children}
    </button>
  );
}

// ── Placeholder for unbuilt phases ───────────────────────────────────────────
function Placeholder({ label, phase }: { label: string; phase: number }) {
  return (
    <div className="welcome-card">
      <h2>{label}</h2>
      <p>Coming in Phase {phase}.</p>
      <p className="status-info">Navigation is wired. Content will be added incrementally.</p>
    </div>
  );
}
