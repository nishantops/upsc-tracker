import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

export function AuthGate() {
  const { signIn, signUp, signInWithGoogle, error, loading, confirmationSent, clearError } =
    useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent, mode: 'login' | 'signup') => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    if (mode === 'login') await signIn(email.trim(), password);
    else await signUp(email.trim(), password);
  };

  return (
    <div id="auth-screen">
      <div className="auth-card">
        <div className="text-center mb-6">
          <div
            className="h-16 w-16 mx-auto rounded-2xl bg-gradient-to-tr from-violet-600 via-fuchsia-500 to-orange-400 flex items-center justify-center font-black text-white text-2xl tracking-tighter shadow-xl shadow-violet-500/30 mb-4"
            style={{ animation: 'cardSlideUp 0.4s ease-out' }}
          >
            SAN
          </div>
          <h2
            style={{
              fontFamily: "'Cabinet Grotesk',sans-serif",
              fontSize: '1.5rem',
              fontWeight: 900,
              background: 'linear-gradient(135deg,#4f46e5,#7c3aed,#db2777)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            UPSC Command Center
          </h2>
          <p
            style={{
              fontSize: '0.7rem',
              color: '#64748b',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginTop: '0.25rem',
            }}
          >
            by SAN Labs &nbsp;&middot;&nbsp; Sign in to continue
          </p>
        </div>

        {/* Google Sign In */}
        <button
          onClick={signInWithGoogle}
          className="auth-social-btn"
          style={{ marginBottom: '0.75rem' }}
          disabled={loading}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        <div className="auth-divider">
          <span
            style={{
              fontSize: '0.65rem',
              color: '#94a3b8',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            or use email
          </span>
        </div>

        {/* Email/Password Section */}
        <form
          id="auth-email-section"
          onSubmit={(e) => handleSubmit(e, 'login')}
          onChange={clearError}
        >
          <div>
            <label
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#475569',
              }}
            >
              Email
            </label>
            <input
              type="email"
              placeholder="your@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <label
              style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#475569',
              }}
            >
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingRight: '2.8rem' }}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                title="Show/hide password"
                style={{
                  position: 'absolute',
                  right: '0.7rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  color: '#94a3b8',
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '0.8rem',
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6,#a855f7)',
                color: 'white',
                border: 'none',
                borderRadius: '0.75rem',
                fontSize: '0.75rem',
                fontWeight: 800,
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                boxShadow: '0 4px 15px -3px rgba(139,92,246,0.5)',
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Signing In\u2026' : 'Sign In'}
            </button>
          </div>
          <p
            style={{
              fontSize: '0.6rem',
              color: '#94a3b8',
              textAlign: 'center',
              marginTop: '0.75rem',
            }}
          >
            Sign In for existing users. New accounts via Google only.
          </p>
        </form>

        {error && (
          <div id="auth-error" style={{ display: 'block' }}>
            {error}
          </div>
        )}

        {confirmationSent && (
          <p style={{ color: '#10b981', fontSize: '0.75rem', marginTop: '0.75rem', fontWeight: 700, textAlign: 'center' }}>
            ✓ Account created! Check your email to confirm, then sign in.
          </p>
        )}
      </div>
    </div>
  );
}