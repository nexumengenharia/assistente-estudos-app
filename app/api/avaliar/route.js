import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabaseServer";

export async function POST(request) {
  try {
    const { topicoId, resposta, aula } = await request.json();
    if (!topicoId || !resposta) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: topico } = await supabase
      .from("grade_curricular")
      .select("*")
      .eq("id", topicoId)
      .single();

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: `Você é um avaliador de estudos. O aluno estudou o tópico "${topico?.topico}" e recebeu esta aula:

"""${aula || ""}"""

Resposta do aluno:
"""${resposta}"""

Avalie a resposta do aluno de 0 a 10 e dê um feedback curto e direto (máximo 120 palavras) em português, dizendo o que acertou e o que faltou. Considere aprovado se nota >= 7.

Responda SOMENTE em JSON válido, sem markdown, no formato:
{"nota": <numero de 0 a 10>, "feedback": "<texto do feedback>", "aprovado": <true ou false>}`,
        },
      ],
    });

    const raw = msg.content?.[0]?.text || "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);

    const nota = Number(parsed.nota) || 0;
    const aprovado = Boolean(parsed.aprovado ?? nota >= 7);
    const feedbackTexto = parsed.feedback || "Não foi possível gerar o feedback.";

    const { data: ultimoLog } = await supabase
      .from("logs_estudo")
      .select("id")
      .eq("topico_id", topicoId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ultimoLog) {
      await supabase
        .from("logs_estudo")
        .update({
          resposta_aluno: resposta,
          feedback_ia: feedbackTexto,
          nota,
          aprovado,
          data_resposta: new Date().toISOString(),
        })
        .eq("id", ultimoLog.id);
    }

    if (aprovado) {
      await supabase
        .from("grade_curricular")
        .update({ status: "concluido", data_conclusao: new Date().toISOString() })
        .eq("id", topicoId);

      const { data: proximo } = await supabase
        .from("grade_curricular")
        .select("id")
        .eq("status", "pendente")
        .order("ordem", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (proximo) {
        await supabase
          .from("grade_curricular")
          .update({ status: "estudando", data_envio: new Date().toISOString() })
          .eq("id", proximo.id);
      }
    }

    return NextResponse.json({ nota, feedback: feedbackTexto, aprovado });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao avaliar resposta" }, { status: 500 });
  }
}
