import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import aseuroLogo from '../assets/aseuro-logo.png';
import { getApiUrl } from '../api/apiClient';

const criteria = 'Password should contain minimum 8 characters with alphabets, numbers and special characters.';
const lockoutStorageKey = 'pms_login_lock_until';

const validPassword = (value) =>
  value.length >= 8 && /[a-zA-Z]/.test(value) && /\d/.test(value) && /[^a-zA-Z\d]/.test(value);

const timeLeft = (until) => {
  if (!until) return '';
  const seconds = Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export default function Login() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetMode, setResetMode] = useState(false);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [lockedUntil, setLockedUntil] = useState(() => {
    const savedLock = localStorage.getItem(lockoutStorageKey);
    return savedLock && new Date(savedLock).getTime() > Date.now() ? savedLock : null;
  });
  const [, setTick] = useState(0);
  const locked = !!lockedUntil && new Date(lockedUntil).getTime() > Date.now();

  const applyLock = (until) => {
    setLockedUntil(until);
    if (until) localStorage.setItem(lockoutStorageKey, until);
    else localStorage.removeItem(lockoutStorageKey);
  };

  useEffect(() => {
    if (user?.role === 'HR') {
      navigate('/hr/dashboard', { replace: true });
    } else if (user?.role === 'MANAGER') {
      navigate('/manager/dashboard', { replace: true });
    } else if (user?.role === 'EMPLOYEE') {
      navigate('/employee/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!lockedUntil) return;
    const interval = window.setInterval(() => {
      setTick(Date.now());
      if (new Date(lockedUntil).getTime() <= Date.now()) {
        applyLock(null);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [lockedUntil]);

  const inform = (type, message) => setNotice({ type, message });

  const passwordField = (value, update, placeholder, autoComplete) => (
    <div className="styled-input-wrap">
      <span className="input-prefix-icon">🔒</span>
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => update(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
      <button type="button" className="password-toggle-btn" onClick={() => setVisible(!visible)}>
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );

  const loginSubmit = async (event) => {
    event.preventDefault();
    setNotice(null);
    if (locked) return;

    if (!email.trim()) return inform('error', 'Email is not found.');
    setLoading(true);

    try {
      const response = await fetch(getApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), identifier: email.trim(), password }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (data?.lockedUntil) applyLock(data.lockedUntil);
        throw new Error(data?.message || 'Login failed.');
      }

      applyLock(null);
      if (data?.token) {
        localStorage.setItem('pms_token', data.token);
        localStorage.setItem('pms_access_token', data.token);
      }
      signIn(data);

      const role = data.role || data.user?.role;
      if (role === 'HR') navigate('/hr/dashboard');
      else if (role === 'MANAGER') navigate('/manager/dashboard');
      else if (role === 'EMPLOYEE') navigate('/employee/dashboard');
      else navigate('/hr/dashboard');
    } catch (error) {
      inform('error', error instanceof Error ? error.message : 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setNotice(null);

    if (!email.trim()) return inform('error', 'Email is not found.');
    if (!validPassword(newPassword)) return inform('error', criteria);
    if (newPassword !== confirmPassword) return inform('error', 'New password and confirm password must match.');

    setLoading(true);
    try {
      const response = await fetch(getApiUrl('/api/auth/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), newPassword }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) throw new Error(data?.message || 'Unable to change password.');

      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      inform('success', 'Password changed successfully. You can now sign in with your new password.');
      window.setTimeout(() => setResetMode(false), 1400);
    } catch (error) {
      inform('error', error instanceof Error ? error.message : 'Unable to change password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <div className="dot-grid-matrix" aria-hidden="true">
        {Array.from({ length: 16 }).map((_, i) => (
          <span key={i} className="dot" />
        ))}
      </div>

      <div className="login-layout-container">
        <section className="left-hero-section">
          <div className="brand-header">
            <span className="logo-glow">
              <img src={aseuroLogo} alt="Aseuro Logo" className="aseuro-logo-img" />
            </span>
            <span className="brand-title">aseuro</span>
          </div>

          <div className="hero-headings">
            <h1>
              Performance
              <br />
              Management
              <br />
              <span className="simplified-green">Simplified</span>
            </h1>
            <div className="green-accent-line" />
            <p className="hero-subtext">
              A centralized platform to manage goals, reviews, feedback and drive continuous growth.
            </p>
          </div>

          <div className="feature-cards-column">
            <div className="feature-card">
              <div className="icon-badge">◎</div>
              <div className="feature-text-group">
                <h4>Set Goals</h4>
                <p>Define clear goals and align with your vision.</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="icon-badge">▥</div>
              <div className="feature-text-group">
                <h4>Track Progress</h4>
                <p>Monitor performance and measure what matters.</p>
              </div>
            </div>

            <div className="feature-card">
              <div className="icon-badge">♧</div>
              <div className="feature-text-group">
                <h4>Drive Growth</h4>
                <p>Provide feedback and grow together continuously.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="right-card-section">
          <div className="login-card-box">
            <div className="card-brand-header">
              <span className="logo-glow small">
                <img src={aseuroLogo} alt="Aseuro Logo" className="card-logo-img" />
              </span>
              <span className="card-brand-text">aseuro</span>
            </div>

            <h2 className="card-title">{resetMode ? 'Reset Password' : 'Welcome Back!'}</h2>
            <p className="card-subtitle">
              {resetMode ? 'Create a secure new password for your account' : 'Sign in to access your account'}
            </p>

            <form className="auth-form-body" onSubmit={resetMode ? resetPassword : loginSubmit}>
              <div className="styled-input-wrap">
                <span className="input-prefix-icon">✉</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email address"
                  autoComplete="email"
                  required
                />
              </div>

              {resetMode ? (
                <>
                  {passwordField(newPassword, setNewPassword, 'Create a new password', 'new-password')}
                  {passwordField(confirmPassword, setConfirmPassword, 'Confirm new password', 'new-password')}
                </>
              ) : (
                passwordField(password, setPassword, 'Enter your password', 'current-password')
              )}

              {!resetMode && (
                <button
                  type="button"
                  className="forgot-password-link"
                  onClick={() => {
                    setNotice(null);
                    setResetMode(true);
                  }}
                >
                  Forgot password?
                </button>
              )}

              <button
                type="submit"
                className="green-login-btn"
                disabled={loading || (!resetMode && locked)}
              >
                <span className="btn-text">{loading ? 'Please wait...' : resetMode ? 'Save Password' : 'Login'}</span>
                <span className="btn-arrow">&rarr;</span>
              </button>

              {resetMode && (
                <button
                  type="button"
                  className="back-to-login-link"
                  onClick={() => {
                    setNotice(null);
                    setResetMode(false);
                  }}
                >
                  &larr; Back to login
                </button>
              )}

              {notice && (
                <div className={`auth-toast ${notice.type}`} role="alert">
                  <span>{notice.type === 'success' ? '✓' : '!'}</span>
                  {notice.message}
                </div>
              )}
            </form>
          </div>
        </section>
      </div>

      <div className="bottom-wave-decor" aria-hidden="true">
        <svg viewBox="0 0 1440 180" fill="none" preserveAspectRatio="none">
          <path d="M0 80C240 160 480 20 720 70C960 120 1200 40 1440 90V180H0V80Z" fill="url(#wave-gradient)" />
          <defs>
            <linearGradient id="wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#39bd2a" />
              <stop offset="100%" stopColor="#168837" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {locked && (
        <div className="lockout-modal-backdrop" role="alertdialog" aria-modal="true" aria-label="Login temporarily locked">
          <div className="lockout-modal">
            <div className="lockout-modal-icon">!</div>
            <h3>Unauthorized access</h3>
            <p>Please try again after some time.</p>
            <div className="lockout-timer">
              <span>Login available in</span>
              <strong>{timeLeft(lockedUntil)}</strong>
            </div>
            <small>For your security, this account is temporarily locked after five unsuccessful attempts.</small>
          </div>
        </div>
      )}
    </div>
  );
}
