import React, { useEffect, useState } from 'react';
import {
  login,
  getUser,
  handleAuthCallback,
  onAuthChange,
  requestPasswordRecovery,
  acceptInvite,
  updateUser,
  AuthError,
  MissingIdentityError,
  type User
} from '@netlify/identity';
import { Lock, Mail, LogIn, Loader2, AlertTriangle, CheckCircle, KeyRound } from 'lucide-react';
import { OilRigLogo } from './OilRigLogo';

// Accounts are invite-only: there is no sign-up view
type View = 'login' | 'forgot' | 'set_password';

function describeError(error: unknown): string {
  if (error instanceof MissingIdentityError) {
    return 'Sign-in is not available here. Run the app with "netlify dev" or open the deployed site.';
  }
  if (error instanceof AuthError) {
    if (error.status === 401) return 'Invalid email or password.';
    if (error.status === 403) return 'Access is by invitation only. Ask an administrator for an invite.';
    if (error.status === 422) return 'Check the email address and use a password of at least 8 characters.';
    if (/confirm/i.test(error.message)) return 'Please confirm your email address first (check your inbox).';
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

interface AuthGateProps {
  children: (user: User) => React.ReactNode;
}

// Shows the login screen until a user is signed in, then renders the app
export const AuthGate: React.FC<AuthGateProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [view, setView] = useState<View>('login');
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        // Handles links from invite, confirmation and password-reset emails
        const result = await handleAuthCallback();
        if (result?.type === 'invite' && result.token) {
          setInviteToken(result.token);
          setView('set_password');
        } else if (result?.type === 'recovery') {
          setView('set_password');
        } else if (result?.type === 'confirmation') {
          setNotice('Email confirmed. Welcome!');
        }
      } catch (err) {
        setError(describeError(err));
      }
      const current = await getUser();
      if (active) {
        setUser(current);
        setChecking(false);
      }
    })();

    const unsubscribe = onAuthChange((event, u) => {
      if (event === 'logout') setUser(null);
      else if (event !== 'recovery' && u) setUser(u);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (view === 'login') {
      run(async () => setUser(await login(email.trim(), password)));
    } else if (view === 'forgot') {
      run(async () => {
        await requestPasswordRecovery(email.trim());
        setNotice('If that account exists, a password reset link has been emailed.');
        setView('login');
      });
    } else {
      run(async () => {
        const u = inviteToken ? await acceptInvite(inviteToken, password) : await updateUser({ password });
        setInviteToken(null);
        setView('login');
        setPassword('');
        setUser(u);
      });
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#e9edf2] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#003057]" />
      </div>
    );
  }

  if (user && view !== 'set_password') return <>{children(user)}</>;

  const titles: Record<View, string> = {
    login: 'Sign in to start',
    forgot: 'Reset your password',
    set_password: inviteToken ? 'Accept invite: choose a password' : 'Choose a new password'
  };
  const submitLabel: Record<View, string> = {
    login: 'Sign in',
    forgot: 'Send reset link',
    set_password: 'Save password'
  };

  return (
    <div className="min-h-screen bg-[#e9edf2] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border-4 border-black rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-[#003057] text-white px-5 py-5 border-b-4 border-black flex items-center gap-3">
          <div className="bg-white rounded p-1.5 border-2 border-black/30 shrink-0">
            <OilRigLogo className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-tight">WL Kit Finder</h1>
            <p className="text-xs text-blue-200/80">Wireline Labs · Maintenance Kit Finder</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <h2 className="font-bold text-slate-900 text-base">{titles[view]}</h2>

          {view !== 'set_password' && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">Email</span>
              <div className="mt-1 flex items-center gap-2 border-2 border-slate-300 focus-within:border-[#0066a1] rounded-lg px-3">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full py-2 text-sm outline-none bg-transparent"
                />
              </div>
            </label>
          )}

          {view !== 'forgot' && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-600">{view === 'set_password' ? 'New password' : 'Password'}</span>
              <div className="mt-1 flex items-center gap-2 border-2 border-slate-300 focus-within:border-[#0066a1] rounded-lg px-3">
                <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                <input
                  type="password"
                  required
                  minLength={view === 'login' ? undefined : 8}
                  autoComplete={view === 'login' ? 'current-password' : 'new-password'}
                  autoFocus={view === 'set_password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder={view === 'login' ? 'Your password' : 'At least 8 characters'}
                  className="w-full py-2 text-sm outline-none bg-transparent"
                />
              </div>
            </label>
          )}

          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#003057] hover:bg-[#002240] text-white text-sm font-bold rounded-lg border-2 border-black cursor-pointer shadow-sm active:scale-[0.98] disabled:opacity-60 transition"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : view === 'login' ? (
              <LogIn className="w-4 h-4" />
            ) : (
              <KeyRound className="w-4 h-4" />
            )}
            <span>{submitLabel[view]}</span>
          </button>

          <div className="flex items-center justify-between text-xs pt-1">
            {view === 'login' ? (
              <>
                <button type="button" onClick={() => { setView('forgot'); setError(null); }} className="text-[#0066a1] hover:underline cursor-pointer">
                  Forgot password?
                </button>
                <span className="text-slate-400">Invite only</span>
              </>
            ) : view !== 'set_password' ? (
              <button type="button" onClick={() => { setView('login'); setError(null); }} className="text-[#0066a1] hover:underline cursor-pointer">
                ← Back to sign in
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
};
