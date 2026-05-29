import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loading, FieldError } from '../components/States';
import Brand from '../components/Brand';
import { t } from '../lib/i18n';

export default function LoginPage() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!ready) return <Loading />;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/sub'} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!loginId.trim() || !password) {
      setError('બધી વિગતો ભરો');
      return;
    }
    setBusy(true);
    try {
      const u = await login(loginId.trim(), password);
      navigate(u.role === 'admin' ? '/admin' : '/sub', { replace: true });
    } catch (err) {
      setError(err?.message?.includes('401') || err?.response?.status === 401 ? t.wrongCreds : (err.message || t.wrongCreds));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="card w-full max-w-md">
        <div className="flex justify-center mb-6">
          <Brand />
        </div>
        <h1 className="text-xl font-bold text-center mb-6">{t.login}</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">{t.phone}</label>
            <input
              className="input"
              type="text"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              placeholder="મોબાઈલ / લૉગિન"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="label">{t.password}</label>
            <div className="relative">
              <input
                className="input pr-16"
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="પાસવર્ડ"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-brand font-medium"
                onClick={() => setShowPwd(!showPwd)}
              >
                {showPwd ? t.hide : t.show}
              </button>
            </div>
          </div>
          <FieldError>{error}</FieldError>
          <button className="btn-primary w-full" type="submit" disabled={busy}>
            {busy ? t.loading : t.login}
          </button>
        </form>
      </div>
    </div>
  );
}
