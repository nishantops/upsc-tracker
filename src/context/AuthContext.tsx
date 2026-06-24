import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ENV } from '../lib/env';

// ── Types ────────────────────────────────────────────────────────────────────
interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  confirmationSent: boolean;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: (force?: boolean) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ── Helpers ──────────────────────────────────────────────────────────────────
function resolveEmail(input: string): string {
  return input.toLowerCase() === ENV.SUPERUSER_ALIAS ? ENV.SUPERUSER_EMAIL : input;
}

function isSuperuser(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return lower === ENV.SUPERUSER_EMAIL || lower === ENV.SUPERUSER_ALIAS;
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
    confirmationSent: false,
  });

  const lastActivityRef = useRef(Date.now());
  const sessionStartRef = useRef<number | null>(null);

  // ── Record session in DB ───────────────────────────────────────────────────
  const recordSession = useCallback(async (userId: string, email: string) => {
    try {
      await supabase.from('upsc_user_sessions').upsert(
        {
          user_id: userId,
          email,
          is_superuser: isSuperuser(email),
          login_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );
    } catch {
      /* non-critical */
    }
  }, []);

  // ── Lock / admin check ─────────────────────────────────────────────────────
  const checkLock = useCallback(
    async (userId: string): Promise<{ locked: boolean; reason?: string; isAdmin?: boolean }> => {
      try {
        const { data } = await supabase
          .from('upsc_user_profiles')
          .select('is_locked,locked_reason,is_admin')
          .eq('user_id', userId)
          .maybeSingle();
        if (data?.is_locked) return { locked: true, reason: data.locked_reason };
        if (data?.is_admin) return { locked: false, isAdmin: true };
      } catch {
        /* proceed */
      }
      return { locked: false };
    },
    [],
  );

  // ── handleAuthUser — shared post-auth flow ─────────────────────────────────
  const handleAuthUser = useCallback(
    async (user: User) => {
      if (!isSuperuser(user.email)) {
        const lock = await checkLock(user.id);
        if (lock.locked) {
          await supabase.auth.signOut();
          setState((s) => ({
            ...s,
            user: null,
            session: null,
            loading: false,
            error: '🔒 Account locked' + (lock.reason ? ': ' + lock.reason : '. Contact admin.'),
          }));
          return;
        }
        if (lock.isAdmin) {
          window.location.href = 'admin.html';
          return;
        }
      }
      await recordSession(user.id, user.email || '');
      sessionStartRef.current = Date.now();
    },
    [checkLock, recordSession],
  );

  // ── Sign in ────────────────────────────────────────────────────────────────
  const signIn = useCallback(
    async (email: string, password: string) => {
      setState((s) => ({ ...s, error: null, loading: true, confirmationSent: false }));
      try {
        const resolved = resolveEmail(email);
        const { data, error } = await supabase.auth.signInWithPassword({
          email: resolved,
          password,
        });
        if (error) throw error;
        await handleAuthUser(data.user);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Authentication failed.';
        setState((s) => ({ ...s, error: msg, loading: false }));
      }
    },
    [handleAuthUser],
  );

  // ── Sign up ────────────────────────────────────────────────────────────────
  const signUp = useCallback(
    async (email: string, password: string) => {
      setState((s) => ({ ...s, error: null, loading: true, confirmationSent: false }));
      try {
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        const resolved = resolveEmail(email);
        const { data, error } = await supabase.auth.signUp({ email: resolved, password });
        if (error) throw error;

        if (data.user && data.session) {
          await handleAuthUser(data.user);
        } else {
          setState((s) => ({ ...s, loading: false, confirmationSent: true }));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Signup failed.';
        setState((s) => ({ ...s, error: msg, loading: false }));
      }
    },
    [handleAuthUser],
  );

  // ── Google OAuth ───────────────────────────────────────────────────────────
  const signInWithGoogle = useCallback(async () => {
    setState((s) => ({ ...s, error: null }));
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + '/' },
      });
      if (error) throw error;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Google sign-in failed.';
      setState((s) => ({ ...s, error: msg }));
    }
  }, []);

  // ── Sign out ───────────────────────────────────────────────────────────────
  const signOut = useCallback(async (force = false) => {
    if (!force && !confirm('Are you sure you want to logout? Your progress is auto-saved.')) return;
    sessionStartRef.current = null;
    await supabase.auth.signOut();
  }, []);

  // ── Clear error ────────────────────────────────────────────────────────────
  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null, confirmationSent: false }));
  }, []);

  // ── Auth state listener (THE key fix — keeps JWT fresh automatically) ──────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await handleAuthUser(session.user);
      }
      setState((s) => ({
        ...s,
        user: session?.user ?? null,
        session,
        loading: false,
      }));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((s) => ({
        ...s,
        user: session?.user ?? null,
        session,
        loading: false,
      }));
    });

    return () => subscription.unsubscribe();
  }, [handleAuthUser]);

  // ── Activity-based auto-logout ─────────────────────────────────────────────
  useEffect(() => {
    if (!state.user) return;

    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach((ev) => document.addEventListener(ev, onActivity, { passive: true, capture: true }));

    const interval = setInterval(async () => {
      const idle = Date.now() - lastActivityRef.current;
      if (idle > ENV.AUTO_LOGOUT_MS) {
        signOut(true);
        return;
      }
      // User was active — update DB
      if (isSuperuser(state.user?.email)) return;
      try {
        const now = new Date().toISOString();
        await supabase.from('upsc_user_sessions').upsert(
          {
            user_id: state.user!.id,
            email: state.user!.email,
            is_superuser: false,
            last_active: now,
          },
          { onConflict: 'user_id' },
        );
      } catch {
        /* non-critical */
      }
    }, 2 * 60 * 1000);

    return () => {
      events.forEach((ev) =>
        document.removeEventListener(ev, onActivity, { capture: true } as EventListenerOptions),
      );
      clearInterval(interval);
    };
  }, [state.user, signOut]);

  return (
    <AuthContext.Provider
      value={{ ...state, signIn, signUp, signInWithGoogle, signOut, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
