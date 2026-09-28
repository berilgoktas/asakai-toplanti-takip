import { useState, useEffect, FormEvent } from "react";

type LoginScreenProps = {
  onLogin: (
    username: string,
    password: string
  ) => Promise<{ ok: boolean; message?: string; lockSeconds?: number }>;
};

const formatLock = (totalSeconds: number) => {
  const s = Math.max(0, totalSeconds);
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  if (minutes <= 0) return `${seconds} saniye`;
  if (seconds === 0) return `${minutes} dakika`;
  return `${minutes} dakika ${seconds} saniye`;
};

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [lockLeft, setLockLeft] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (lockLeft <= 0) return;
    const timer = window.setInterval(() => {
      setLockLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [lockLeft > 0]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (lockLeft > 0) return;
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Kullanıcı adı ve şifre zorunlu");
      return;
    }
    setLoading(true);
    const result = await onLogin(username.trim(), password);
    setLoading(false);
    if (result.ok) {
      setLockLeft(0);
      return;
    }
    if (result.lockSeconds && result.lockSeconds > 0) {
      setLockLeft(result.lockSeconds);
      setError("");
      return;
    }
    setError(result.message || "Kullanıcı adı veya şifre hatalı");
  };

  const locked = lockLeft > 0;
  const shownError = locked
    ? `Giriş kilitlendi. Tekrar denemek için ${formatLock(lockLeft)} bekleyin.`
    : error;

  return (
    <div className="login-screen">
      <div className="login-screen__bg" aria-hidden="true">
        <span className="login-screen__blob login-screen__blob--1" />
        <span className="login-screen__blob login-screen__blob--2" />
        <span className="login-screen__blob login-screen__blob--3" />
      </div>

      <form className="login-card" onSubmit={handleSubmit} autoComplete="off">
        <div className="login-card__brand">
          <div className="login-card__brand-text">
            <h1>Asakai Toplantı</h1>
            <p>Toplantı takibi paneline giriş yapın</p>
          </div>
        </div>

        <div className="login-card__field">
          <label htmlFor="login-username">Kullanıcı Adı</label>
          <div className="login-card__input">
            <span className="login-card__icon" aria-hidden="true">@</span>
            <input
              id="login-username"
              type="text"
              placeholder="kullanıcı"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              disabled={locked}
            />
          </div>
        </div>

        <div className="login-card__field">
          <label htmlFor="login-password">Şifre</label>
          <div className="login-card__input">
            <span className="login-card__icon" aria-hidden="true">#</span>
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={locked}
            />
            <button
              type="button"
              className="login-card__toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
              disabled={locked}
            >
              {showPassword ? "Gizle" : "Göster"}
            </button>
          </div>
        </div>

        {shownError && <p className="login-card__error">{shownError}</p>}

        <button className="login-card__submit" disabled={loading || locked} type="submit">
          {locked
            ? `Kilitli (${formatLock(lockLeft)})`
            : loading
              ? "Giriş yapılıyor..."
              : "Giriş Yap"}
        </button>
      </form>
    </div>
  );
}
