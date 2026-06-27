import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocus, formatDuration, formatDurationShort } from '../../hooks/useFocus';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useToast } from '../common/Toast';

export function FocusWidget() {
  const { active, elapsed, history, todayTotal, weekTotal, start, stop } = useFocus();
  const { showToast } = useToast();
  const [panelOpen, setPanelOpen] = useState(false);
  useScrollLock(active || panelOpen);

  const handleToggle = async () => {
    if (active) {
      const dur = await stop();
      if (dur) showToast(`Session saved: ${formatDuration(dur)}`, 'success');
      setPanelOpen(false);
    } else {
      await start();
      showToast('Focus mode started!', 'info');
      setPanelOpen(false);
    }
  };

  const lastSession = history[0];
  const lastDur = lastSession ? formatDurationShort(lastSession.duration_seconds ?? 0) : '—';

  return (
    <>
      {/* Compact widget in header */}
      <div
        id="focus-mode-widget"
        className={`flex items-center gap-2 rounded-xl px-3 py-1.5 cursor-pointer${active ? ' focus-widget-active' : ''}`}
        style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}
        onClick={() => setPanelOpen((o) => !o)}
        title="Focus Mode — click to open study tracker panel"
      >
        <button
          id="focus-mode-btn"
          type="button"
          className={`flex items-center gap-1.5${active ? ' focus-active' : ''}`}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--t3)' }}
        >
          <span className="focus-dot" />
          <span id="focus-status-label" className="text-[10px] font-black uppercase tracking-widest">
            {active ? 'STUDYING' : 'FOCUS'}
          </span>
        </button>
        <span
          id="focus-timer-display"
          className="px-2 py-0.5 rounded-md text-[10px] font-mono"
          style={{ minWidth: '5.5ch', textAlign: 'center', background: 'var(--card)', color: 'var(--t3)', border: '1px solid var(--bdr)' }}
        >
          {formatDuration(active ? elapsed : 0)}
        </span>
        {todayTotal > 0 && (
          <span id="focus-today-total" className="text-[9px] font-bold" style={{ color: 'var(--t4)' }}>
            Today: {formatDurationShort(todayTotal)}
          </span>
        )}
      </div>

      {/* FULL-SCREEN FOCUS LOCK OVERLAY — when focus is active */}
      {active && createPortal(
        <div className="focus-lock-overlay">
          <div className="focus-lock-content">
            <div className="focus-lock-badge">STUDYING</div>
            <div className="focus-lock-timer">{formatDuration(elapsed)}</div>
            <div className="focus-lock-stats">
              <span>Today: {todayTotal > 0 ? formatDurationShort(todayTotal + elapsed) : formatDuration(elapsed)}</span>
              <span>•</span>
              <span>Week: {formatDurationShort(weekTotal + elapsed)}</span>
            </div>
            <button className="focus-lock-stop" onClick={handleToggle}>
              ■ STOP SESSION
            </button>
            <p className="focus-lock-hint">Stay focused. Close distractions. You got this.</p>
          </div>
        </div>
      , document.body)}

      {/* Focus Panel dropdown — only when NOT in active focus (for starting/viewing history) */}
      {panelOpen && !active && createPortal(
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 499 }}
            onClick={() => setPanelOpen(false)}
          />
          <div id="focus-panel" style={{ display: 'block' }} onClick={(e) => e.stopPropagation()}>
          {/* Header row */}
          <div className="fp-status-row" style={{ marginBottom: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1rem' }}>🎯</span>
              <span style={{ fontWeight: 800, fontSize: '0.8rem', color: 'var(--t1)' }}>Focus Mode</span>
              <span className="fp-db-badge">Live</span>
            </div>
            <button className="fp-close-btn" onClick={() => setPanelOpen(false)}>✕</button>
          </div>

          {/* Status badge */}
          <div style={{ marginBottom: '0.6rem' }}>
            <span className="fp-status-badge">IDLE</span>
          </div>

          {/* Big timer */}
          <div className="fp-big-timer">00:00:00</div>

          {/* Start button */}
          <button className="fp-start-btn" onClick={handleToggle}>
            START SESSION
          </button>

          {/* Stats grid */}
          <div className="fp-stat-grid">
            <div className="fp-stat">
              <div className="fp-stat-label">Today</div>
              <div className="fp-stat-value">{todayTotal > 0 ? formatDurationShort(todayTotal) : '—'}</div>
            </div>
            <div className="fp-stat">
              <div className="fp-stat-label">Last session</div>
              <div className="fp-stat-value">{lastDur}</div>
            </div>
            <div className="fp-stat">
              <div className="fp-stat-label">7-day total</div>
              <div className="fp-stat-value">{weekTotal > 0 ? formatDurationShort(weekTotal) : '—'}</div>
            </div>
          </div>

          <div className="fp-divider" />

          {/* Recent Sessions */}
          <div className="fp-section-title">Recent Sessions</div>
          <div>
            {history.length === 0 ? (
              <div className="fp-empty">No sessions yet</div>
            ) : (
              history.slice(0, 10).map((s) => {
                const d = new Date(s.started_at);
                const ago = Math.floor((Date.now() - d.getTime()) / 3600000);
                const agoStr = ago < 1 ? 'just now' : ago < 24 ? `${ago}h ago` : `${Math.floor(ago / 24)}d ago`;
                return (
                  <div key={s.id} className="fp-hist-item">
                    <span className="fp-hist-date">
                      {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                    <span className="fp-hist-dur">
                      {formatDurationShort(s.duration_seconds ?? 0)}
                    </span>
                    <span className="fp-hist-ago">{agoStr}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
        </>
      , document.body)}
    </>
  );
}
