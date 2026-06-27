import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface DailyFocus {
  focus_date: string;
  total_seconds: number;
}

// Keep old interface for backward compat (tests etc)
export interface FocusSession {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
}

export function useFocus() {
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dailyHistory, setDailyHistory] = useState<DailyFocus[]>([]);
  const [todayTotal, setTodayTotal] = useState(0);
  const [weekTotal, setWeekTotal] = useState(0);
  const sessionRef = useRef<{ id: string; start: number; accumulated: number } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getTodayIST = () => {
    const d = new Date();
    const ist = new Date(d.getTime() + (5.5 * 60 * 60 * 1000));
    return ist.toISOString().slice(0, 10);
  };

  // ── Helper: upsert seconds into daily total ────────────────────────────
  const addToDailyTotal = useCallback(async (userId: string, seconds: number) => {
    if (seconds <= 0) return;
    const date = getTodayIST();
    try {
      const { data: existing } = await supabase
        .from('upsc_focus_daily')
        .select('total_seconds')
        .eq('user_id', userId)
        .eq('focus_date', date)
        .single();

      if (existing) {
        await supabase
          .from('upsc_focus_daily')
          .update({ total_seconds: existing.total_seconds + seconds, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('focus_date', date);
      } else {
        await supabase
          .from('upsc_focus_daily')
          .insert({ user_id: userId, focus_date: date, total_seconds: seconds });
      }
    } catch { /* non-critical */ }
  }, []);

  // ── Load daily history + resume active session ───────────────────────────
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      // 1. Check for active session to RESUME
      try {
        const { data: openSessions } = await supabase
          .from('upsc_focus_sessions')
          .select('id, started_at, accumulated_seconds')
          .eq('user_id', user.id)
          .is('ended_at', null)
          .order('started_at', { ascending: false });

        if (openSessions && openSessions.length > 0) {
          const now = Date.now();
          const resumable = openSessions.find((s) => {
            const age = Math.floor((now - new Date(s.started_at).getTime()) / 1000);
            return age >= 0 && age < 86_400;
          });

          if (resumable) {
            const startTs = new Date(resumable.started_at).getTime();
            const accumulated = resumable.accumulated_seconds ?? 0;
            sessionRef.current = { id: resumable.id, start: startTs, accumulated };
            setActive(true);
            setPaused(false);
            setElapsed(accumulated + Math.floor((now - startTs) / 1000));
            try { localStorage.setItem('upsc_focus_active', '1'); } catch { /* ignore */ }
            intervalRef.current = setInterval(() => {
              if (sessionRef.current) {
                const curr = Math.floor((Date.now() - sessionRef.current.start) / 1000);
                setElapsed(sessionRef.current.accumulated + curr);
              }
            }, 1000);

            // Close other orphans — save their time to daily
            const others = openSessions.filter((s) => s.id !== resumable.id);
            if (others.length > 0) {
              await Promise.all(others.map((s) => {
                const dur = (s.accumulated_seconds ?? 0) + Math.floor((now - new Date(s.started_at).getTime()) / 1000);
                return addToDailyTotal(user.id, dur).then(() =>
                  supabase.from('upsc_focus_sessions').delete().eq('id', s.id)
                );
              }));
            }
          } else {
            // All stale (> 24h) — save and delete
            const now2 = Date.now();
            await Promise.all(openSessions.map((s) => {
              const dur = (s.accumulated_seconds ?? 0) + Math.floor((now2 - new Date(s.started_at).getTime()) / 1000);
              if (dur > 5) {
                return addToDailyTotal(user.id, dur).then(() =>
                  supabase.from('upsc_focus_sessions').delete().eq('id', s.id)
                );
              }
              return supabase.from('upsc_focus_sessions').delete().eq('id', s.id);
            }));
          }
        }
      } catch { /* non-critical */ }

      // 2. Load daily history (last 30 days)
      const { data: daily } = await supabase
        .from('upsc_focus_daily')
        .select('focus_date, total_seconds')
        .eq('user_id', user.id)
        .order('focus_date', { ascending: false })
        .limit(30);

      const days = (daily ?? []) as DailyFocus[];
      setDailyHistory(days);

      // Compute totals
      const today = getTodayIST();
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
      let td = 0, wd = 0;
      days.forEach((d) => {
        if (d.focus_date === today) td += d.total_seconds;
        if (d.focus_date >= weekAgo) wd += d.total_seconds;
      });
      setTodayTotal(td);
      setWeekTotal(wd);
    };
    load();
  }, [user, addToDailyTotal]);

  // ── Start ──────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (!user || active) return;
    const now = new Date();
    let sessionId = `local-${Date.now()}`;
    try {
      const { data, error } = await supabase
        .from('upsc_focus_sessions')
        .insert({ user_id: user.id, started_at: now.toISOString(), accumulated_seconds: 0 })
        .select()
        .single();
      if (!error && data) sessionId = data.id;
    } catch { /* use local */ }

    sessionRef.current = { id: sessionId, start: now.getTime(), accumulated: 0 };
    setActive(true);
    setPaused(false);
    setElapsed(0);
    try { localStorage.setItem('upsc_focus_active', '1'); } catch { /* ignore */ }
    try {
      await supabase.from('upsc_user_sessions').upsert(
        { user_id: user.id, focus_active: true },
        { onConflict: 'user_id' },
      );
    } catch { /* non-critical */ }
    intervalRef.current = setInterval(() => {
      if (sessionRef.current) {
        const curr = Math.floor((Date.now() - sessionRef.current.start) / 1000);
        setElapsed(sessionRef.current.accumulated + curr);
      }
    }, 1000);
  }, [user, active]);

  // ── Pause ──────────────────────────────────────────────────────────────
  const pause = useCallback(async () => {
    if (!user || !sessionRef.current || paused) return;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

    const { id, start, accumulated } = sessionRef.current;
    const segmentDur = Math.floor((Date.now() - start) / 1000);
    const newAccumulated = accumulated + segmentDur;

    // Save accumulated to DB so it persists across refresh
    if (!id.startsWith('local-')) {
      try {
        await supabase
          .from('upsc_focus_sessions')
          .update({ accumulated_seconds: newAccumulated, started_at: new Date().toISOString() })
          .eq('id', id);
      } catch { /* non-critical */ }
    }

    sessionRef.current = { id, start: Date.now(), accumulated: newAccumulated };
    setPaused(true);
    setElapsed(newAccumulated);
  }, [user, paused]);

  // ── Resume (from pause) ────────────────────────────────────────────────
  const resume = useCallback(async () => {
    if (!user || !sessionRef.current || !paused) return;

    const { id, accumulated } = sessionRef.current;
    const now = Date.now();
    sessionRef.current = { id, start: now, accumulated };

    if (!id.startsWith('local-')) {
      try {
        await supabase
          .from('upsc_focus_sessions')
          .update({ started_at: new Date(now).toISOString() })
          .eq('id', id);
      } catch { /* non-critical */ }
    }

    setPaused(false);
    intervalRef.current = setInterval(() => {
      if (sessionRef.current) {
        const curr = Math.floor((Date.now() - sessionRef.current.start) / 1000);
        setElapsed(sessionRef.current.accumulated + curr);
      }
    }, 1000);
  }, [user, paused]);

  // ── Stop ───────────────────────────────────────────────────────────────
  const stop = useCallback(async () => {
    if (!user || !sessionRef.current) return;
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }

    const { id, start, accumulated } = sessionRef.current;
    const segmentDur = paused ? 0 : Math.floor((Date.now() - start) / 1000);
    const totalDur = accumulated + segmentDur;

    // Add to daily total in DB
    await addToDailyTotal(user.id, totalDur);

    // Delete the active session row (only daily totals persist)
    if (!id.startsWith('local-')) {
      try { await supabase.from('upsc_focus_sessions').delete().eq('id', id); } catch { /* */ }
    }

    // Update local state
    const today = getTodayIST();
    setDailyHistory((prev) => {
      const existing = prev.find((d) => d.focus_date === today);
      if (existing) {
        return prev.map((d) => d.focus_date === today
          ? { ...d, total_seconds: d.total_seconds + totalDur }
          : d);
      }
      return [{ focus_date: today, total_seconds: totalDur }, ...prev];
    });
    setTodayTotal((t) => t + totalDur);
    setWeekTotal((t) => t + totalDur);

    sessionRef.current = null;
    setActive(false);
    setPaused(false);
    setElapsed(0);
    try { localStorage.removeItem('upsc_focus_active'); } catch { /* ignore */ }
    try {
      await supabase.from('upsc_user_sessions').upsert(
        { user_id: user.id, focus_active: false },
        { onConflict: 'user_id' },
      );
    } catch { /* non-critical */ }
    try { localStorage.setItem('upsc_last_focus_ts', String(Date.now())); } catch { /* ignore */ }

    return totalDur;
  }, [user, paused, addToDailyTotal]);

  // ── Clear all history ──────────────────────────────────────────────────
  const clearHistory = useCallback(async () => {
    if (!user) return;
    try {
      await supabase.from('upsc_focus_daily').delete().eq('user_id', user.id);
    } catch { /* non-critical */ }
    setDailyHistory([]);
    setTodayTotal(0);
    setWeekTotal(0);
  }, [user]);

  // Auto-stop on logout
  useEffect(() => {
    const handleLogout = () => { if (sessionRef.current) stop(); };
    window.addEventListener('upsc-logout', handleLogout);
    return () => window.removeEventListener('upsc-logout', handleLogout);
  }, [stop]);

  // Cleanup interval on unmount (session stays in DB for resume)
  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  return { active, paused, elapsed, dailyHistory, todayTotal, weekTotal, start, stop, pause, resume, clearHistory };
}

export function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatDurationShort(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
