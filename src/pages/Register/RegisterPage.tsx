import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "@/api/auth.api";
import { extractErrorMessage } from "@/utils/apiError";
import vaultLogo from "@/assets/vault-logo.png";

export function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await register(email, password, name);
      navigate("/confirm", { state: { email } });
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
          <img src={vaultLogo} alt="Vault" className="h-8 w-8 rounded-lg" />
          <span className="text-lg font-semibold text-vault-text dark:text-[#e6edf3]">Vault</span>
        </div>

        <h1 className="mb-1 page-title">Crea tu cuenta</h1>
        <p className="mb-8 text-sm text-vault-muted2 dark:text-[#8b949e]">
          Empeza a llevar el control de tu patrimonio.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">Nombre</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-vault"
              placeholder="Tu nombre"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-vault-muted2 dark:text-[#8b949e]">Email</label>
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
              minLength={8}
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
            {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-vault-muted dark:text-[#8b949e]">
          Ya tenes cuenta?{" "}
          <Link to="/login" className="text-vault-accent hover:underline">
            Ingresa
          </Link>
        </p>
      </div>
    </div>
  );
}
