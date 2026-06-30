import React, { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "@/api/auth.api";
import { extractErrorMessage } from "@/utils/apiError";

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

  const inputStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.04)",
    border: "0.5px solid rgba(255,255,255,0.1)",
    borderRadius: 8,
    color: "white",
    fontSize: 13,
    height: 40,
    padding: "0 12px",
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    fontWeight: 500,
    letterSpacing: "0.06em",
    marginBottom: 5,
  };

  const submitBtnStyle: React.CSSProperties = {
    width: "100%",
    height: 40,
    background: "#1e3a8a",
    border: "none",
    borderRadius: 8,
    color: "white",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    marginBottom: 10,
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        background: "#080c18",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Capa 1 — formas geométricas SVG */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
        preserveAspectRatio="none"
      >
        <circle
          cx="25%"
          cy="35%"
          r="200"
          stroke="rgba(30,58,138,0.5)"
          strokeWidth="0.8"
          fill="none"
        />
        <circle
          cx="18%"
          cy="70%"
          r="120"
          stroke="rgba(147,197,253,0.25)"
          strokeWidth="0.8"
          fill="none"
        />
        <circle cx="38%" cy="22%" r="5" fill="rgba(147,197,253,0.5)" />
        <circle cx="22%" cy="75%" r="3.5" fill="rgba(147,197,253,0.3)" />
        <line x1="0%" y1="100%" x2="55%" y2="0%" stroke="rgba(30,58,138,0.4)" strokeWidth="0.8" />
        <path
          d="M -50 300 Q 200 80 550 380"
          stroke="rgba(147,197,253,0.15)"
          strokeWidth="0.8"
          fill="none"
        />
        <rect
          x="4%"
          y="12%"
          width="36%"
          height="70%"
          rx="2"
          stroke="rgba(30,58,138,0.25)"
          strokeWidth="0.8"
          fill="none"
        />
        <circle
          cx="55%"
          cy="80%"
          r="80"
          stroke="rgba(30,58,138,0.2)"
          strokeWidth="0.8"
          fill="none"
        />
      </svg>

      {/* Capa 2 — gradiente radial */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 15% 50%, rgba(30,58,138,0.35) 0%, transparent 55%)",
          pointerEvents: "none",
        }}
      />

      {/* Capa 3 — contenido */}
      <div
        style={{ position: "relative", zIndex: 1, display: "flex", width: "100%", height: "100%" }}
      >
        {/* Lado izquierdo */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "40px 48px",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                border: "1px solid rgba(147,197,253,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2 4L7 10L12 5"
                  stroke="#93c5fd"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4.5 4L7 7L9.5 4"
                  stroke="rgba(147,197,253,0.4)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span style={{ fontSize: 10, letterSpacing: "0.2em", color: "rgba(255,255,255,0.4)" }}>
              VAULT
            </span>
          </div>

          {/* Contenido central */}
          <div>
            <h2
              style={{
                fontSize: "clamp(22px, 3vw, 34px)",
                fontWeight: 200,
                color: "white",
                lineHeight: 1.15,
                marginTop: 0,
                marginBottom: 12,
              }}
            >
              Tu patrimonio,
              <br />
              siempre claro.
            </h2>
            <p
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.3)",
                marginTop: 0,
                marginBottom: 36,
              }}
            >
              Where wealth becomes clear.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                "Unificá bancos, broker y cripto en un solo lugar",
                "La IA procesa tus extractos en menos de 3 minutos",
                "Tu patrimonio en USD, siempre actualizado",
              ].map((text) => (
                <div key={text} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: "#93c5fd",
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.15)" }}>
            © 2026 Vault · Confidencial
          </span>
        </div>

        {/* Lado derecho — card */}
        <div
          style={{
            width: 290,
            flexShrink: 0,
            background: "rgba(10,15,30,0.92)",
            borderLeft: "0.5px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "40px 32px",
          }}
        >
          <h1
            style={{ fontSize: 20, fontWeight: 300, color: "white", marginTop: 0, marginBottom: 6 }}
          >
            Crear cuenta
          </h1>
          <p
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.35)",
              marginTop: 0,
              marginBottom: 28,
            }}
          >
            Empezá gratis en segundos.
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div>
              <label style={labelStyle}>NOMBRE</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>EMAIL</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vos@email.com"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>CONTRASEÑA</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="········"
                style={inputStyle}
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
              style={{
                ...submitBtnStyle,
                opacity: isSubmitting ? 0.5 : 1,
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {isSubmitting ? "Creando cuenta..." : "Crear cuenta gratis"}
            </button>
          </form>

          <Link
            to="/login"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 40,
              border: "0.5px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              color: "rgba(255,255,255,0.5)",
              fontSize: 13,
              textDecoration: "none",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            Ya tengo cuenta
          </Link>

          <p
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.2)",
              textAlign: "center",
              marginTop: 14,
              marginBottom: 0,
            }}
          >
            en menos de 3 minutos · Vault hace el resto
          </p>
        </div>
      </div>
    </div>
  );
}
