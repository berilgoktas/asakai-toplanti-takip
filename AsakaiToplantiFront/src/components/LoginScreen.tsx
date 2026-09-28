import { useState, useEffect, FormEvent } from "react";

type LoginScreenProps = {
  onLogin: (
    username: string,
    password: string
  ) => Promise<{ ok: boolean; message?: string; lockSeconds?: number; kalanHak?: number }>;
};

const STORAGE_KEY = "asakai.loginGuard";
const LAST_USER_KEY = "asakai.loginGuardLastUser";

type Guard = { kalanHak: number; lockUntil: number | null };
type GuardMap = Record<string, Guard>;

const formatLock = (totalSeconds: number) => {
  const s = Math.max(0, totalSeconds);
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  if (minutes <= 0) return `${seconds} saniye`;
  if (seconds === 0) return `${minutes} dakika`;
  return `${minutes} dakika ${seconds} saniye`;
};

const userKey = (name: string) => name.trim().toLowerCase();

const readMap = (): GuardMap => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as GuardMap) : {};
  } catch {
    return {};
  }
};

const writeGuard = (name: string, guard: Guard) => {
  const key = userKey(name);
  if (!key) return;
  const map = readMap();
  map[key] = guard;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  localStorage.setItem(LAST_USER_KEY, name.trim());
};

const clearGuard = (name: string) => {
  const key = userKey(name);
  const map = readMap();
  if (key) delete map[key];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

const secondsLeft = (lockUntil: number | null) => {
  if (!lockUntil) return 0;
  return Math.max(0, Math.ceil((lockUntil - Date.now()) / 1000));
};

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const lastUser = localStorage.getItem(LAST_USER_KEY) ?? "";
  const [username, setUsername] = useState(lastUser);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [lockLeft, setLockLeft] = useState(0);
  const [loading, setLoading] = useState(false);

  const applyGuard = (name: string) => {
    const stored = readMap()[userKey(name)];
    if (!stored) {
      setLockLeft(0);
      setError("");
      return;
    }
    const left = secondsLeft(stored.lockUntil);
    if (left > 0) {
      setLockLeft(left);
      setError("");
      return;
    }
    setLockLeft(0);
    if (stored.kalanHak < 10) {
      setError(`Kullanıcı adı veya şifre hatalı. Kalan deneme hakkı: ${stored.kalanHak}`);
    } else {
      setError("");
    }
  };

  useEffect(() => {
    applyGuard(username);
  }, []);

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
    const name = username.trim();
    const result = await onLogin(name, password);
    setLoading(false);
    if (result.ok) {
      setLockLeft(0);
      setError("");
      clearGuard(name);
      return;
    }
    if (result.lockSeconds && result.lockSeconds > 0) {
      writeGuard(name, { kalanHak: 0, lockUntil: Date.now() + result.lockSeconds * 1000 });
      setLockLeft(result.lockSeconds);
      setError("");
      return;
    }
    const kalan = typeof result.kalanHak === "number" ? result.kalanHak : 9;
    writeGuard(name, { kalanHak: kalan, lockUntil: null });
    setError(result.message || `Kullanıcı adı veya şifre hatalı. Kalan deneme hakkı: ${kalan}`);
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
              onChange={(e) => {
                setUsername(e.target.value);
                applyGuard(e.target.value);
              }}
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
