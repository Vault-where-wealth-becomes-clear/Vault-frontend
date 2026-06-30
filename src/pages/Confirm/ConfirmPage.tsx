import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { confirmSignUp, resendConfirmationCode } from "@/api/auth.api";
import { extractErrorMessage } from "@/utils/apiError";
import vaultLogo from "@/assets/vault-logo.png";

export function ConfirmPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const prefillEmail = (location.state as { email?: string } | null)?.email ?? "";

  const [email, setEmail] = useState(prefillEmail);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await confirmSignUp(email, code);
      navigate("/login");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError("Ingresa tu email para reenviar el código");
      return;
    }
    setError(null);
    setResendMessage(null);
    setIsResending(true);
    try {
      await resendConfirmationCode(email);
      setResendMessage("Te reenviamos el código, revisa tu email.");
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-center gap-2">
          <img src={vaultLogo} alt="Vault" className="h-8 w-8 rounded-lg" />
          <span className="text-lg font-semibold text-vault-text dark:text-[#e6edf3]">Vault</span>
        </div>

        <h1 className="mb-1 page-title">Confirma tu cuenta</h1>
        <p className="mb-8 text-sm text-vault-muted2 dark:text-[#8b949e]">
          Ingresa el código que te llegó por email para activar tu cuenta.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              Código
            </label>
            <input
              type="text"
              inputMode="numeric"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="input-vault"
              placeholder="123456"
            />
          </div>

          {error && (
            <div className="rounded-vault border border-vault-red/20 bg-vault-red/10 px-3.5 py-2.5 text-sm text-vault-red">
              {error}
            </div>
          )}

          {resendMessage && (
            <div className="rounded-vault border border-vault-green/20 bg-vault-green/10 px-3.5 py-2.5 text-sm text-vault-green">
              {resendMessage}
            </div>
          )}

          <button type="submit" disabled={isSubmitting} className="btn-primary mt-2">
            {isSubmitting ? "Confirmando..." : "Confirmar cuenta"}
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="text-center text-xs text-vault-accent hover:underline"
          >
            {isResending ? "Reenviando..." : "Reenviar código"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-vault-muted dark:text-[#8b949e]">
          Ya confirmaste?{" "}
          <Link to="/login" className="text-vault-accent hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
