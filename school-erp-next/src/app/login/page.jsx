'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, User, Lock, Eye, EyeOff, GraduationCap, Building2 } from 'lucide-react';
import API, { getDeviceId } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useNav } from '@/lib/NavContext';
import { showSuccess, showError } from '@/lib/alert';
import { runValidation, required } from '@/lib/validate';

export default function LoginPage() {
  const router = useRouter();
  const { user, login, ready } = useAuth();
  const { firstRoute, loaded: navLoaded } = useNav();

  // Demo credentials pre-filled so a portfolio visitor can sign in with one click.
  const [form, setForm] = useState({ username: 'Admin', password: '123', unitId: '' });
  const [units, setUnits] = useState([]);
  const [errors, setErrors] = useState({});
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  // Once logged in AND the nav is loaded, land on the user's first allowed module
  // (top of their ordered nav — a teacher with only Students goes to /students).
  useEffect(() => {
    if (ready && user && navLoaded) {
      router.replace(firstRoute || '/dashboard');
    }
  }, [ready, user, navLoaded, firstRoute, router]);

  // Load the list of units for the login unit-picker (public endpoint).
  useEffect(() => {
    API.get('/auth/units')
      .then((res) => setUnits(res.data || []))
      .catch(() => setUnits([]));
  }, []);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const errs = runValidation(form, {
      unitId: [required('Please select a unit')],
      username: [required('User ID is required')],
      password: [required('Password is required')],
    });
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/auth/login', {
        username: form.username,
        password: form.password,
        unitId: Number(form.unitId),
        deviceId: getDeviceId(),
      });
      login(res.data);
      showSuccess('Login Successful!');
      // Redirect is handled by the effect above once permissions load, so the
      // user always lands on a module they can actually access.
    } catch (err) {
      showError(err.response?.data?.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-hero">
      {/* Full-screen school background + gradient wash */}
      <div className="auth-hero-bg" />
      <div className="auth-hero-wash" />

      {/* Centered glass login card */}
      <div className="auth-center">
        <div className="glass-card">
          <div className="glass-logo">
            <div className="glass-logo-icon"><GraduationCap size={30} /></div>
            <div className="glass-logo-title">School ERP</div>
            <div className="glass-logo-sub">Management System</div>
          </div>

          <div className="glass-welcome">
            <div className="glass-welcome-title">Welcome back 👋</div>
            <div className="glass-welcome-sub">Sign in with your account to continue</div>
          </div>

          <form onSubmit={handleLogin} noValidate>
            <div className="form-group">
              <label className="glass-label">Unit / Branch</label>
              <div className="input-icon-wrap">
                <Building2 size={17} className="input-lead-icon" />
                <select
                  className={`glass-input has-lead ${errors.unitId ? 'input-error' : ''}`}
                  value={form.unitId}
                  onChange={(e) => set('unitId', e.target.value)}
                >
                  <option value="">Select your unit</option>
                  {units.map((u) => (
                    <option key={u.unitId} value={u.unitId}>{u.unitName}</option>
                  ))}
                </select>
              </div>
              {errors.unitId && <span className="field-error">{errors.unitId}</span>}
            </div>

            <div className="form-group">
              <label className="glass-label">User ID</label>
              <div className="input-icon-wrap">
                <User size={17} className="input-lead-icon" />
                <input
                  type="text"
                  className={`glass-input has-lead ${errors.username ? 'input-error' : ''}`}
                  placeholder="Enter your user id"
                  value={form.username}
                  onChange={(e) => set('username', e.target.value)}
                  autoFocus
                  autoComplete="username"
                />
              </div>
              {errors.username && <span className="field-error">{errors.username}</span>}
            </div>

            <div className="form-group">
              <label className="glass-label">Password</label>
              <div className="input-icon-wrap">
                <Lock size={17} className="input-lead-icon" />
                <input
                  type={showPwd ? 'text' : 'password'}
                  className={`glass-input has-lead has-trail ${errors.password ? 'input-error' : ''}`}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  autoComplete="current-password"
                />
                <button type="button" className="input-trail-btn" onClick={() => setShowPwd((s) => !s)} tabIndex={-1}>
                  {showPwd ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {errors.password && <span className="field-error">{errors.password}</span>}
            </div>

            <button type="submit" className="btn btn-primary glass-submit" disabled={loading}>
              {loading ? <span className="loading-spinner" /> : <><LogIn size={18} /> Sign In</>}
            </button>
          </form>

          <div className="glass-help">Trouble signing in? Contact your school administrator.</div>
        </div>

        <div className="auth-hero-footer">© 2026 School ERP · All rights reserved</div>
      </div>
    </div>
  );
}
