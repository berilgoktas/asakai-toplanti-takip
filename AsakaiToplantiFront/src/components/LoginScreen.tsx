import { useState, FormEvent } from "react";

type LoginScreenProps = {
  onLogin: (username: string, password: string) => Promise<{ ok: boolean; message?: string }>;
};

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password.trim()) {
      setError("Kullanıcı adı ve şifre zorunlu");
      return;
    }
    setLoading(true);
    const result = await onLogin(username.trim(), password);
    setLoading(false);
    if (!result.ok) setError(result.message || "Kullanıcı adı veya şifre hatalı");
  };

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
            />
            <button
              type="button"
              className="login-card__toggle"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {showPassword ? "Gizle" : "Göster"}
            </button>
          </div>
        </div>

        {error && <p className="login-card__error">{error}</p>}

        <button type="submit" className="login-card__submit" disabled={loading}>
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>

       
      </form>
    </div>
  );
}
