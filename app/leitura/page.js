"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import Nav from "@/components/Nav";

const statusLabel = { processando: "Processando...", pronto: "Pronto", erro: "Erro" };

export default function LeituraPage() {
  const supabase = createClient();
  const router = useRouter();
  const [livros, setLivros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [autor, setAutor] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    setCarregando(true);
    const { data } = await supabase.from("livros").select("*").order("created_at", { ascending: false });
    setLivros(data || []);
    setCarregando(false);
  }

  async function anexarLivro() {
    if (!titulo.trim() || !arquivo) {
      setErro("Preencha o título e escolha um arquivo PDF.");
      return;
    }
    setEnviando(true);
    setErro("");
    try {
      setProgresso("Preparando upload...");
      const resUrl = await fetch("/api/leitura/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, autor, filename: arquivo.name }),
      });
      const dadosUrl = await resUrl.json();
      if (!resUrl.ok || dadosUrl.error) throw new Error(dadosUrl.error || "Erro ao preparar upload");

      setProgresso("Enviando PDF...");
      const { error: errUpload } = await supabase.storage
        .from("livros")
        .uploadToSignedUrl(dadosUrl.path, dadosUrl.token, arquivo);
      if (errUpload) throw new Error(errUpload.message);

      setProgresso("Processando PDF (extraindo texto)...");
      const resProc = await fetch("/api/leitura/processar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livroId: dadosUrl.livroId }),
      });
      const dadosProc = await resProc.json();
      if (!resProc.ok || dadosProc.error) throw new Error(dadosProc.error || "Erro ao processar PDF");

      setModalAberto(false);
      setTitulo("");
      setAutor("");
      setArquivo(null);
      await carregar();
      router.push(`/leitura/${dadosUrl.livroId}`);
    } catch (e) {
      setErro(e.message || "Falha ao anexar livro.");
    } finally {
      setEnviando(false);
      setProgresso("");
    }
  }

  return (
    <div>
      <Nav subtitle="Seus livros e o progresso de leitura" />

      <div className="dash-wrap">
        <div className="dash-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1>📖 Leitura</h1>
            <p style={{ color: "#666" }}>{livros.length} livro(s) anexado(s)</p>
          </div>
          <button className="gerar-btn" onClick={() => setModalAberto(true)}>+ Anexar livro</button>
        </div>

        {carregando ? (
          <div style={{ textAlign: "center", color: "#999", padding: 40 }}>Carregando...</div>
        ) : livros.length === 0 ? (
          <div style={{ textAlign: "center", color: "#999", padding: 40 }}>Nenhum livro anexado ainda.</div>
        ) : (
          <div className="modules">
            {livros.map((l) => (
              <div key={l.id} className="module" onClick={() => l.status === "pronto" && router.push(`/leitura/${l.id}`)} style={{ cursor: l.status === "pronto" ? "pointer" : "default" }}>
                <div className="module-header">{l.titulo}</div>
                <div className="topic">
                  <div className="topic-info">
                    <div className="topic-name">{l.autor || "Autor não informado"}</div>
                    <div className="topic-description">
                      {statusLabel[l.status]}
                      {l.status === "pronto" && ` · ${l.total_paginas} páginas`}
                      {l.status === "erro" && l.erro_mensagem ? ` — ${l.erro_mensagem}` : ""}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modalAberto && (
        <div className="modal-overlay" onClick={() => !enviando && setModalAberto(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <span className="modal-close" onClick={() => !enviando && setModalAberto(false)}>×</span>
            <h2>Anexar livro</h2>
            <div className="modal-section">
              <label>Título</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                disabled={enviando}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
              />
            </div>
            <div className="modal-section">
              <label>Autor (opcional)</label>
              <input
                type="text"
                value={autor}
                onChange={(e) => setAutor(e.target.value)}
                disabled={enviando}
                style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
              />
            </div>
            <div className="modal-section">
              <label>Arquivo PDF</label>
              <input type="file" accept="application/pdf" onChange={(e) => setArquivo(e.target.files?.[0] || null)} disabled={enviando} />
            </div>
            {erro && <div style={{ color: "#dc3545", fontSize: "0.85em", marginBottom: 10 }}>⚠ {erro}</div>}
            {progresso && <div style={{ color: "#667eea", fontSize: "0.85em", marginBottom: 10 }}>{progresso}</div>}
            <button className="gerar-btn" onClick={anexarLivro} disabled={enviando} style={{ width: "100%" }}>
              {enviando ? "Enviando..." : "Anexar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
