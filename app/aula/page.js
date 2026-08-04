"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import Nav from "@/components/Nav";

function parseAula(raw) {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (obj && (obj.metafora || obj.explicacao || obj.desafio)) return obj;
  } catch (e) {}
  return { metafora: "", explicacao: raw, desafio: "" };
}

function hora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
}

export default function AulaPage() {
  const supabase = createClient();
  const [carregando, setCarregando] = useState(true);
  const [topico, setTopico] = useState(null);
  const [stats, setStats] = useState({ total: 0, concluidos: 0, estudando: 0, pendentes: 0 });
  const [log, setLog] = useState(null);
  const [aula, setAula] = useState(null);
  const [gerandoAula, setGerandoAula] = useState(false);
  const [resposta, setResposta] = useState("");
  const [avaliando, setAvaliando] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const chatRef = useRef(null);

  useEffect(() => {
    carregar();
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [aula, feedback, carregando]);

  async function carregar() {
    setCarregando(true);

    const { count: total } = await supabase.from("grade_curricular").select("*", { count: "exact", head: true });
    const { count: concluidos } = await supabase.from("grade_curricular").select("*", { count: "exact", head: true }).eq("status", "concluido");
    const { count: estudando } = await supabase.from("grade_curricular").select("*", { count: "exact", head: true }).eq("status", "estudando");
    const { count: pendentes } = await supabase.from("grade_curricular").select("*", { count: "exact", head: true }).eq("status", "pendente");
    setStats({ total: total || 0, concluidos: concluidos || 0, estudando: estudando || 0, pendentes: pendentes || 0 });

    const { data: atual } = await supabase
      .from("grade_curricular")
      .select("*")
      .eq("status", "estudando")
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();

    let alvo = atual;
    if (!alvo) {
      const { data: prox } = await supabase
        .from("grade_curricular")
        .select("*")
        .eq("status", "pendente")
        .order("ordem", { ascending: true })
        .limit(1)
        .maybeSingle();
      alvo = prox || null;
    }
    setTopico(alvo);

    if (alvo) {
      const { data: ultimoLog } = await supabase
        .from("logs_estudo")
        .select("*")
        .eq("topico_id", alvo.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (ultimoLog) {
        setLog(ultimoLog);
        setAula(parseAula(ultimoLog.aula_gerada_v2 || ultimoLog.aula_gerada));
        if (ultimoLog.feedback_ia || ultimoLog.feedback_gerado) {
          setFeedback({
            nota: ultimoLog.nota,
            texto: ultimoLog.feedback_ia || ultimoLog.feedback_gerado,
            aprovado: ultimoLog.aprovado,
          });
        } else {
          setFeedback(null);
        }
      } else {
        setLog(null);
        setAula(null);
        setFeedback(null);
      }
    }

    setCarregando(false);
  }

  async function gerarAula() {
    if (!topico) return;
    setGerandoAula(true);
    try {
      const res = await fetch("/api/gerar-aula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicoId: topico.id }),
      });
      const data = await res.json();
      await carregar();
    } finally {
      setGerandoAula(false);
    }
  }

  async function enviarResposta() {
    if (!topico || !resposta.trim()) return;
    setAvaliando(true);
    const textoEnviado = resposta;
    try {
      const res = await fetch("/api/avaliar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicoId: topico.id,
          resposta: textoEnviado,
          aula: aula ? `${aula.metafora}\n\n${aula.explicacao}\n\n${aula.desafio}` : "",
        }),
      });
      await res.json();
      setResposta("");
      await carregar();
    } finally {
      setAvaliando(false);
    }
  }

  const pct = stats.total > 0 ? Math.round((stats.concluidos / stats.total) * 100) : 0;

  return (
    <div className="chat-shell">
      <Nav subtitle={topico ? `Tópico atual: ${topico.topico}` : "Trilha concluída"} />

      <div className="progress-strip">
        <span>{stats.concluidos}/{stats.total} tópicos</span>
        <div className="progress-bar-mini">
          <div className="progress-bar-mini-fill" style={{ width: `${pct}%` }} />
        </div>
        <span>{pct}%</span>
      </div>

      <div className="chat-container" ref={chatRef}>
        {carregando ? (
          <div style={{ color: "#999", textAlign: "center", padding: 40 }}>Carregando...</div>
        ) : !topico ? (
          <div className="message assistant">
            <div>
              <div className="message-bubble">🎉 Você concluiu todos os tópicos da trilha! Parabéns pela dedicação.</div>
            </div>
          </div>
        ) : (
          <>
            <div className="message assistant">
              <div>
                <div className={`status-badge ${topico.status === "estudando" ? "status-estudando-badge" : "status-pendente-badge"}`}>
                  {topico.status === "estudando" ? "📚 ESTUDANDO" : "🆕 PRÓXIMO TÓPICO"}
                </div>
                <div className="message-bubble">
                  {topico.modulo} — <strong>{topico.topico}</strong>
                  <br />
                  {topico.descricao}
                </div>
              </div>
            </div>

            {!aula && (
              <div className="message assistant">
                <div>
                  <button
                    onClick={gerarAula}
                    disabled={gerandoAula}
                    className="send-btn"
                    style={{ width: "auto", borderRadius: 20, padding: "10px 20px", fontSize: "0.9em", fontWeight: 600 }}
                  >
                    {gerandoAula ? "Gerando..." : "✨ Gerar aula do dia"}
                  </button>
                </div>
              </div>
            )}

            {aula && (
              <div className="message assistant">
                <div>
                  <div className="aula-bubble">
                    <h3>Aula: {topico.topico}</h3>
                    {aula.metafora && (
                      <div className="aula-section">
                        <div className="aula-section-title">🎯 Metáfora</div>
                        <div className="aula-section-content">{aula.metafora}</div>
                      </div>
                    )}
                    {aula.explicacao && (
                      <div className="aula-section">
                        <div className="aula-section-title">💡 Explicação Técnica</div>
                        <div className="aula-section-content">{aula.explicacao}</div>
                      </div>
                    )}
                    {aula.desafio && (
                      <div className="aula-section">
                        <div className="aula-section-title">🎯 Desafio Prático</div>
                        <div className="aula-section-content">{aula.desafio}</div>
                      </div>
                    )}
                  </div>
                  <div className="timestamp">{hora(log?.data_aula || log?.created_at)}</div>
                </div>
              </div>
            )}

            {log?.resposta_aluno && (
              <div className="message user">
                <div>
                  <div className="message-bubble">{log.resposta_aluno}</div>
                  <div className="timestamp">{hora(log?.data_resposta)}</div>
                </div>
              </div>
            )}

            {feedback && (
              <div className="message assistant">
                <div>
                  <div className={`feedback-message ${feedback.aprovado ? "aprovado" : "reprovado"}`}>
                    <strong>{feedback.aprovado ? "✓ Resposta aprovada!" : "🔁 Quase lá"}</strong>
                    {typeof feedback.nota === "number" && <span> — nota {feedback.nota}/10</span>}
                    <br />
                    {feedback.texto}
                  </div>
                  {feedback.aprovado && (
                    <div className="message-bubble" style={{ marginTop: 10 }}>
                      Tópico concluído! A próxima aula já está liberada — atualize a página ou volte aqui amanhã. 🎉
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {aula && !feedback && (
        <div className="input-area">
          <textarea
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            placeholder="Sua resposta..."
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviarResposta();
              }
            }}
          />
          <button onClick={enviarResposta} disabled={avaliando || !resposta.trim()} className="send-btn">
            {avaliando ? "…" : "➤"}
          </button>
        </div>
      )}
    </div>
  );
}
