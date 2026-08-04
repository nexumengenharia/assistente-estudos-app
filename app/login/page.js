"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();

  async function entrar(e) {
    e.preventDefault();
    setErro("");
    setCarregando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
    setCarregando(false);
    if (error) {
      setErro("Email ou senha incorretos.");
      return;
    }
    router.push("/aula");
    router.refresh();
  }

  return (
    <div
      className="gradient-header"
      style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
    >
      <div style={{ background: "white", borderRadius: 12, padding: 32, maxWidth: 380, width: "100%", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📚</div>
          <h1 style={{ color: "#333", fontSize: "1.5em", marginBottom: 4 }}>Assistente de Estudos</h1>
          <p style={{ color: "#666", fontSize: "0.9em" }}>Entre para continuar sua jornada</p>
        </div>

        <form onSubmit={entrar}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", color: "#666", fontSize: "0.85em", marginBottom: 5, fontWeight: 500 }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px", fontSize: "0.95em", outline: "none" }}
              placeholder="voce@email.com"
            />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", color: "#666", fontSize: "0.85em", marginBottom: 5, fontWeight: 500 }}>Senha</label>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={{ width: "100%", border: "1px solid #ddd", borderRadius: 8, padding: "10px 12px", fontSize: "0.95em", outline: "none" }}
              placeholder="••••••••"
            />
          </div>
          {erro && <p style={{ color: "#dc3545", fontSize: "0.85em", marginBottom: 12 }}>{erro}</p>}
          <button
            type="submit"
            disabled={carregando}
            style={{
              width: "100%", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", color: "white",
              border: "none", borderRadius: 8, padding: "12px", fontWeight: 600, fontSize: "0.95em",
              cursor: carregando ? "not-allowed" : "pointer", opacity: carregando ? 0.6 : 1,
            }}
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
