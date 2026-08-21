"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import Nav from "@/components/Nav";

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

export default function LivroPage() {
  const { id } = useParams();
  const supabase = createClient();
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [livro, setLivro] = useState(null);
  const [leituras, setLeituras] = useState([]);
  const [semanas, setSemanas] = useState([]);

  const [data, setData] = useState(hoje());
  const [paginaInicial, setPaginaInicial] = useState("");
  const [paginaFinal, setPaginaFinal] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function carregar() {
    setCarregando(true);

    const { data: l } = await supabase.from("livros").select("*").eq("id", id).maybeSingle();
    setLivro(l || null);

    const { data: ld } = await supabase
      .from("leituras_diarias")
      .select("*")
      .eq("livro_id", id)
      .order("data", { ascending: false });
    setLeituras(ld || []);

    const { data: rs } = await supabase
      .from("resumos_semanais")
      .select("*")
      .eq("livro_id", id)
      .order("semana_inicio", { ascending: false });
    setSemanas(rs || []);

    if (ld && ld.length > 0) {
      setPaginaInicial(String(ld[0].pagina_final + 1));
    } else {
      setPaginaInicial("1");
    }

    setCarregando(false);
  }

  async function registrarCheckin() {
    setErro("");
    const pi = Number(paginaInicial);
    const pf = Number(paginaFinal);
    if (!pi || !pf) {
      setErro("Informe a página inicial e final.");
      return;
    }
    if (pf < pi) {
      setErro("A página final não pode ser menor que a inicial.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/api/leitura/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livroId: id, data, paginaInicial: pi, paginaFinal: pf }),
      });
      const resultado = await res.json();
      if (!res.ok || resultado.error) throw new Error(resultado.error || "Erro ao registrar leitura");
      setPaginaFinal("");
      await carregar();
    } catch (e) {
      setErro(e.message || "Falha ao registrar leitura.");
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <div>
        <Nav />
        <div style={{ padding: 40, textAlign: "center", color: "#999" }}>Carregando...</div>
      </div>
    );
  }

  if (!livro) {
    return (
      <div>
        <Nav />
        <div style={{ padding: 40, textAlign: "center", color: "#999" }}>Livro não encontrado.</div>
      </div>
    );
  }

  return (
    <div>
      <Nav subtitle={livro.titulo} />

      <div className="dash-wrap">
        <div className="dash-header">
          <button
            onClick={() => router.push("/leitura")}
            style={{ background: "none", border: "none", color: "#667eea", fontWeight: 600, cursor: "pointer", fontSize: "0.85em", marginBottom: 10 }}
          >
            ← Leitura
          </button>
          <h1>📖 {livro.titulo}</h1>
          <p style={{ color: "#666" }}>{livro.autor || "Autor não informado"} · {livro.total_paginas} páginas</p>
        </div>

        <div className="dash-header">
          <h2 style={{ fontSize: "1.05em", marginBottom: 14 }}>Registrar leitura de hoje</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.85em", color: "#666", marginBottom: 4 }}>Data</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid #ddd" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85em", color: "#666", marginBottom: 4 }}>Página inicial</label>
              <input
                type="number"
                min="1"
                value={paginaInicial}
                onChange={(e) => setPaginaInicial(e.target.value)}
                style={{ width: 100, padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.85em", color: "#666", marginBottom: 4 }}>Página final</label>
              <input
                type="number"
                min="1"
                value={paginaFinal}
                onChange={(e) => setPaginaFinal(e.target.value)}
                style={{ width: 100, padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
              />
            </div>
            <button className="gerar-btn" onClick={registrarCheckin} disabled={enviando}>
              {enviando ? "Gerando resumo..." : "Registrar"}
            </button>
          </div>
          {erro && <div style={{ color: "#dc3545", fontSize: "0.85em", marginTop: 10 }}>⚠ {erro}</div>}
        </div>

        {semanas.length > 0 && (
          <div className="dash-header">
            <h2 style={{ fontSize: "1.05em", marginBottom: 14 }}>Resumos semanais</h2>
            {semanas.map((s) => (
              <div key={s.id} style={{ marginBottom: 20 }}>
                <div className="status-badge status-concluido-badge">
                  {s.semana_inicio} a {s.semana_fim} · páginas {s.pagina_inicial}-{s.pagina_final}
                </div>
                <div className="aula-bubble" style={{ marginTop: 8 }}>
                  <div className="aula-section">
                    <div className="aula-section-title">📅 Resumo da semana</div>
                    <div className="aula-section-content">{s.resumo_semana}</div>
                  </div>
                  <div className="aula-section">
                    <div className="aula-section-title">📚 Acumulado do livro até aqui</div>
                    <div className="aula-section-content">{s.resumo_acumulado}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {leituras.length > 0 && (
          <div className="dash-header">
            <h2 style={{ fontSize: "1.05em", marginBottom: 14 }}>Resumos diários</h2>
            {leituras.map((l) => (
              <div key={l.id} style={{ marginBottom: 16 }}>
                <div className="timestamp">{l.data} · páginas {l.pagina_inicial}-{l.pagina_final}</div>
                <div className="message-bubble" style={{ background: "#e8eaf6", color: "#333", marginTop: 6 }}>
                  {l.resumo_dia}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
