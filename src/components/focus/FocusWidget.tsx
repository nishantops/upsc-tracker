import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useFocus, formatDuration, formatDurationShort } from '../../hooks/useFocus';
import { useScrollLock } from '../../hooks/useScrollLock';
import { useToast } from '../common/Toast';

export function FocusWidget() {
  const {
    active, paused, elapsed, dailyHistory, todayTotal, weekTotal,
    start, stop, pause, resume, clearHistory,
  } = useFocus();
  const { showToast } = useToast();
  const [panelOpen, setPanelOpen] = useState(false);
  const [distractionCount, setDistractionCount] = useState(0);
  const [clock, setClock] = useState(() => new Date());
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  useScrollLock(active || panelOpen);

  // Live clock for focus overlay
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, [active]);

  // ── Fullscreen + Wake Lock + Visibility tracking ─────────────────────
  useEffect(() => {
    if (!active) {
      // Cleanup on stop
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
      setDistractionCount(0);
      return;
    }

    // Request fullscreen
    const requestFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch { /* user denied or not supported */ }
    };
    requestFullscreen();

    // Request wake lock (prevent screen sleep)
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch { /* not supported or denied */ }
    };
    requestWakeLock();

    // Visibility change — detect tab/app switches
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setDistractionCount((c) => c + 1);
      } else if (document.visibilityState === 'visible') {
        // Re-acquire wake lock (released on visibility hidden)
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Warn before closing tab
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onBeforeUnload);
      if (wakeLockRef.current) { wakeLockRef.current.release(); wakeLockRef.current = null; }
    };
  }, [active]);

  const handleStart = async () => {
    await start();
    showToast('Focus mode started!', 'info');
    setPanelOpen(false);
  };

  const handleStop = async () => {
    // Exit fullscreen before stopping
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    const dur = await stop();
    if (dur) showToast(`Session saved: ${formatDuration(dur)}`, 'success');
  };

  const handlePause = async () => {
    await pause();
    showToast('Session paused', 'info');
  };

  const handleResume = async () => {
    await resume();
    showToast('Session resumed', 'info');
  };

  const handleClear = async () => {
    await clearHistory();
    showToast('History cleared', 'success');
  };

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
            {active ? (paused ? 'PAUSED' : 'STUDYING') : 'FOCUS'}
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
        <div
          className="focus-lock-overlay"
          onWheel={(e) => e.preventDefault()}
          onTouchMove={(e) => e.preventDefault()}
          onScroll={(e) => e.preventDefault()}
        >
          <div className="focus-lock-content">
            <div className="focus-lock-clock">
              <span className="focus-lock-time">
                {clock.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
              </span>
              <span className="focus-lock-date">
                {clock.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            </div>
            <div className="focus-lock-badge">{paused ? 'PAUSED' : 'STUDYING'}</div>
            <div className={`focus-lock-timer${paused ? ' focus-lock-paused' : ''}`}>
              {formatDuration(elapsed)}
            </div>
            <div className="focus-lock-stats">
              <span>Today: {formatDurationShort(todayTotal + elapsed)}</span>
              <span>•</span>
              <span>Week: {formatDurationShort(weekTotal + elapsed)}</span>
            </div>
            {distractionCount > 0 && (
              <div className="focus-lock-distraction">
                ⚠️ {distractionCount} distraction{distractionCount > 1 ? 's' : ''} detected
              </div>
            )}
            <div className="focus-lock-actions">
              {paused ? (
                <button className="focus-lock-resume" onClick={handleResume}>
                  ▶ RESUME
                </button>
              ) : (
                <button className="focus-lock-pause" onClick={handlePause}>
                  ❚❚ PAUSE
                </button>
              )}
              <button className="focus-lock-stop" onClick={handleStop}>
                ■ STOP
              </button>
            </div>
            <p className="focus-lock-hint">
              {paused
                ? 'Take a break. Resume when ready.'
                : 'Fullscreen locked. Stay focused. You got this.'}
            </p>
          </div>
        </div>
      , document.body)}

      {/* Focus Panel dropdown — only when NOT in active focus */}
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
            <button className="fp-start-btn" onClick={handleStart}>
              START SESSION
            </button>

            {/* Stats grid */}
            <div className="fp-stat-grid">
              <div className="fp-stat">
                <div className="fp-stat-label">Today</div>
                <div className="fp-stat-value">{todayTotal > 0 ? formatDurationShort(todayTotal) : '—'}</div>
              </div>
              <div className="fp-stat">
                <div className="fp-stat-label">7-day total</div>
                <div className="fp-stat-value">{weekTotal > 0 ? formatDurationShort(weekTotal) : '—'}</div>
              </div>
              <div className="fp-stat">
                <div className="fp-stat-label">Days tracked</div>
                <div className="fp-stat-value">{dailyHistory.length}</div>
              </div>
            </div>

            <div className="fp-divider" />

            {/* Daily History */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
              <span className="fp-section-title" style={{ margin: 0 }}>Daily History</span>
              {dailyHistory.length > 0 && (
                <button
                  className="fp-clear-btn"
                  onClick={handleClear}
                  title="Clear all history"
                >
                  Clear All
                </button>
              )}
            </div>
            <div>
              {dailyHistory.length === 0 ? (
                <div className="fp-empty">No sessions yet</div>
              ) : (
                dailyHistory.slice(0, 14).map((d) => {
                  const date = new Date(d.focus_date + 'T00:00:00');
                  const isToday = d.focus_date === new Date().toISOString().slice(0, 10);
                  return (
                    <div key={d.focus_date} className="fp-hist-item">
                      <span className="fp-hist-date">
                        {isToday ? 'Today' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })}
                      </span>
                      <span className="fp-hist-dur">
                        {formatDurationShort(d.total_seconds)}
                      </span>
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
