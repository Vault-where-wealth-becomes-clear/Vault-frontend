import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login, submitTotp } from "@/api/auth.api";
import { extractErrorMessage } from "@/utils/apiError";

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
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-vault-navy text-sm font-bold text-white">
            V
          </div>
          <span className="font-syne text-lg font-bold">Vault</span>
        </div>

        {challengeSession ? (
          <>
            <h1 className="mb-1 font-syne text-2xl font-bold">Verificacion en dos pasos</h1>
            <p className="mb-8 text-sm text-vault-muted2">
              Ingresa el codigo TOTP de tu app de autenticacion.
            </p>

            <form onSubmit={handleTotp} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-vault-muted2">Codigo</label>
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

              <button type="submit" disabled={isSubmitting} className="btn-primary mt-2">
                {isSubmitting ? "Verificando..." : "Verificar"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mb-1 font-syne text-2xl font-bold">Bienvenido de nuevo</h1>
            <p className="mb-8 text-sm text-vault-muted2">
              Ingresa tus credenciales para acceder a tu tablero.
            </p>

            <form onSubmit={handleLogin} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-vault-muted2">Email</label>
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
                <label className="mb-1.5 block text-xs font-medium text-vault-muted2">
                  Contrasena
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-vault"
                  placeholder="********"
                />
              </div>

              {error && (
                <div className="rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
                  {error}
                </div>
              )}

              <button type="submit" disabled={isSubmitting} className="btn-primary mt-2">
                {isSubmitting ? "Ingresando..." : "Ingresar"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-vault-muted">
              No tenes cuenta?{" "}
              <Link to="/register" className="text-vault-accent hover:underline">
                Registrate
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
