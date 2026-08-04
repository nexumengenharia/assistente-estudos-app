import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabaseServer";

export async function POST(request) {
  try {
    const { topicoId } = await request.json();
    if (!topicoId) {
      return NextResponse.json({ error: "topicoId obrigatório" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: topico, error: errTopico } = await supabase
      .from("grade_curricular")
      .select("*")
      .eq("id", topicoId)
      .single();

    if (errTopico || !topico) {
      return NextResponse.json({ error: "Tópico não encontrado" }, { status: 404 });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1200,
      messages: [
        {
          role: "user",
          content: `Você é um professor particular direto e prático. Crie uma mini-aula em português sobre o tópico "${topico.topico}" (módulo "${topico.modulo}").

Contexto do tópico: ${topico.descricao}

Gere três partes:
1. metafora: uma analogia curta e simples do dia a dia que explique a ideia central (2-4 frases)
2. explicacao: explicação técnica direta e precisa (4-6 frases)
3. desafio: uma pergunta ou mini-exercício prático que o aluno deve responder com as próprias palavras para provar que entendeu

Responda SOMENTE em JSON válido, sem markdown, no formato exato:
{"metafora": "...", "explicacao": "...", "desafio": "..."}`,
        },
      ],
    });

    const raw = msg.content?.[0]?.text || "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let estrutura;
    try {
      estrutura = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (e) {
      estrutura = { metafora: "", explicacao: raw, desafio: "Explique com suas palavras o que você entendeu sobre este tópico." };
    }

    if (topico.status === "pendente") {
      await supabase
        .from("grade_curricular")
        .update({ status: "estudando", data_envio: new Date().toISOString() })
        .eq("id", topico.id);
    }

    await supabase.from("logs_estudo").insert({
      topico_id: topico.id,
      aula_gerada_v2: JSON.stringify(estrutura),
      data_aula: new Date().toISOString(),
    });

    return NextResponse.json({ aula: estrutura });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao gerar aula" }, { status: 500 });
  }
}
