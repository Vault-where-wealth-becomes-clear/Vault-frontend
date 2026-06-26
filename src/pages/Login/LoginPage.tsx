import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, submitTotp } from "@/api/auth.api";
import { extractErrorMessage } from "@/utils/apiError";
import vaultLogo from "@/assets/vault-logo.png";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [challengeSession, setChallengeSession] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.kind === "challenge") {
        setChallengeSession(result.challenge.session);
      } else {
        navigate("/dashboard");
      }
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTotp = async (event: FormEvent) => {
    event.preventDefault();
    if (!challengeSession) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await submitTotp(email, challengeSession, totpCode);
      navigate("/dashboard");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Lado izquierdo decorativo ── */}
      <div
        className="relative hidden w-[55%] flex-shrink-0 md:flex flex-col justify-center overflow-hidden px-12"
        style={{
          background: "linear-gradient(135deg, #0a0f1e 0%, #0d1f4a 50%, #0a0f1e 100%)",
        }}
      >
        {/* Círculo difuso 1 */}
        <div
          className="pointer-events-none absolute"
          style={{
            width: 400,
            height: 400,
            top: -100,
            left: -100,
            background: "radial-gradient(circle, rgba(30,58,138,0.4) 0%, transparent 70%)",
          }}
        />
        {/* Círculo difuso 2 */}
        <div
          className="pointer-events-none absolute"
          style={{
            width: 300,
            height: 300,
            bottom: 50,
            right: -50,
            background: "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)",
          }}
        />

        {/* Contenido */}
        <div className="relative z-10 flex flex-col">
          {/* Logo + nombre */}
          <div className="flex items-center gap-3">
            <img
              src={vaultLogo}
              alt="Vault"
              className="h-12 w-12 rounded-2xl border border-white/10"
            />
            <span
              className="text-white"
              style={{ letterSpacing: "0.15em", fontWeight: 300, fontSize: 18 }}
            >
              VAULT
            </span>
          </div>

          <div style={{ height: 48 }} />

          {/* Título */}
          <h2
            className="text-white"
            style={{ fontSize: 36, fontWeight: 200, lineHeight: 1.15, letterSpacing: "-0.02em" }}
          >
            Tu patrimonio,
            <br />
            siempre claro.
          </h2>

          {/* Subtítulo */}
          <p
            className="mt-4"
            style={{ color: "rgba(255,255,255,0.45)", fontWeight: 300, fontSize: 14 }}
          >
            Where wealth becomes clear.
          </p>

          <div style={{ height: 64 }} />

          {/* Métricas */}
          <div className="grid grid-cols-3 gap-6">
            {[
              { value: "93%", label: "PRECISIÓN IA" },
              { value: "3 min", label: "POR EXTRACTO" },
              { value: "0", label: "COMPETIDORES" },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-white" style={{ fontSize: 24, fontWeight: 300 }}>
                  {value}
                </p>
                <p
                  className="mt-1"
                  style={{
                    color: "rgba(255,255,255,0.45)",
                    fontSize: 11,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Separador */}
          <div
            className="mt-12"
            style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
          />

          <p className="mt-6" style={{ color: "rgba(255,255,255,0.25)", fontSize: 11 }}>
            © 2026 Vault
          </p>
        </div>
      </div>

      {/* ── Lado derecho — formulario ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#f8fafc] dark:bg-[#0d1117] px-12">
        <div className="w-full max-w-sm">
          {challengeSession ? (
            <>
              <h1
                className="mb-2"
                style={{ fontSize: 24, fontWeight: 300, color: "#0f172a" }}
              >
                Verificación en dos pasos
              </h1>
              <p className="mb-8 text-sm" style={{ color: "#64748b" }}>
                Ingresa el código TOTP de tu app de autenticación.
              </p>

              <form onSubmit={handleTotp} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                    Código
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    className="input-vault"
                    placeholder="123456"
                  />
                </div>

                {error && (
                  <div className="rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #1e3a8a, #3b5bdb)" }}
                >
                  {isSubmitting ? "Verificando..." : "Verificar"}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1
                className="mb-2 dark:text-[#e6edf3]"
                style={{ fontSize: 24, fontWeight: 300, color: "#0f172a" }}
              >
                Bienvenido de nuevo
              </h1>
              <p className="mb-8 text-sm" style={{ color: "#64748b" }}>
                Ingresá tus credenciales para acceder.
              </p>

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-vault"
                    placeholder="vos@email.com"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-vault"
                    placeholder="········"
                  />
                </div>

                {error && (
                  <div className="rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #1e3a8a, #3b5bdb)" }}
                >
                  {isSubmitting ? "Ingresando..." : "Ingresar"}
                </button>
              </form>

              <p className="mt-6 text-center text-xs text-vault-muted dark:text-[#8b949e]">
                No tenes cuenta?{" "}
                <Link to="/register" className="text-vault-accent hover:underline">
                  Registrate
                </Link>
              </p>
              <p className="mt-2 text-center text-xs text-vault-muted dark:text-[#8b949e]">
                No confirmaste tu cuenta todavía?{" "}
                <Link to="/confirm" state={{ email }} className="text-vault-accent hover:underline">
                  Confirmala acá
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
