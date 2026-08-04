"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import Nav from "@/components/Nav";

const statusLabel = { pendente: "Pendente", estudando: "Em estudo", concluido: "Concluído" };
const statusIcon = { pendente: "-", estudando: "→", concluido: "✓" };

export default function GradePage() {
  const supabase = createClient();
  const [topicos, setTopicos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("grade_curricular").select("*").order("ordem", { ascending: true });
      setTopicos(data || []);
      setCarregando(false);
    })();
  }, []);

  const modulos = topicos.reduce((acc, t) => {
    acc[t.modulo] = acc[t.modulo] || [];
    acc[t.modulo].push(t);
    return acc;
  }, {});

  const pendentes = topicos.filter((t) => t.status === "pendente").length;
  const estudando = topicos.filter((t) => t.status === "estudando").length;
  const concluidos = topicos.filter((t) => t.status === "concluido").length;
  const progresso = topicos.length > 0 ? Math.round((concluidos / topicos.length) * 100) : 0;

  return (
    <div>
      <Nav subtitle="Sua jornada de aprendizado em Automação e IA" />

      <div className="dash-wrap">
        <div className="dash-header">
          <h1>📚 Grade Curricular</h1>
          <p style={{ color: "#666" }}>{topicos.length} tópicos na trilha completa</p>
          <div className="stats">
            <div className="stat-card">
              <div className="stat-number">{pendentes}</div>
              <div className="stat-label">Pendentes</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{estudando}</div>
              <div className="stat-label">Estudando</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{concluidos}</div>
              <div className="stat-label">Concluídos</div>
            </div>
            <div className="stat-card">
              <div className="stat-number">{progresso}%</div>
              <div className="stat-label">Progresso</div>
            </div>
          </div>
        </div>

        {carregando ? (
          <div style={{ textAlign: "center", color: "#999", padding: 40 }}>Carregando...</div>
        ) : (
          <div className="modules">
            {Object.entries(modulos).map(([modulo, itens]) => {
              const done = itens.filter((i) => i.status === "concluido").length;
              const pct = Math.round((done / itens.length) * 100);
              return (
                <div key={modulo} className="module">
                  <div className="module-header">{modulo}</div>
                  <div className="topics">
                    {itens.map((t) => (
                      <div key={t.id} className="topic" onClick={() => setSelecionado(t)}>
                        <div className={`topic-status status-${t.status}`}>{statusIcon[t.status]}</div>
                        <div className="topic-info">
                          <div className="topic-name">{t.topico}</div>
                          <div className="topic-description">{t.descricao}</div>
                        </div>
                        <div className="topic-order">{t.ordem}</div>
                      </div>
                    ))}
                  </div>
                  <div className="module-stats">
                    <span>{done}/{itens.length} completos</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selecionado && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelecionado(null); }}>
          <div className="modal-box">
            <span className="modal-close" onClick={() => setSelecionado(null)}>&times;</span>
            <h2>{selecionado.topico}</h2>
            <div className="modal-section">
              <label>Status</label>
              <span className={`modal-status ${selecionado.status}`}>{statusLabel[selecionado.status]}</span>
            </div>
            <div className="modal-section">
              <label>Módulo</label>
              <p>{selecionado.modulo}</p>
            </div>
            <div className="modal-section">
              <label>Descrição</label>
              <p>{selecionado.descricao}</p>
            </div>
            <div className="modal-section">
              <label>Ordem na trilha</label>
              <p>Tópico #{selecionado.ordem} de {topicos.length}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
