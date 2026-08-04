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
      max_tokens: 2200,
      messages: [
        {
          role: "user",
          content: `Você é um professor particular excelente, didático e detalhista. Crie uma aula completa em português sobre o tópico "${topico.topico}" (módulo "${topico.modulo}").

Contexto do tópico: ${topico.descricao}

Gere quatro partes, todas bem desenvolvidas (não resuma demais, o aluno quer aprender de verdade):

1. metafora: uma analogia rica do dia a dia que explique a ideia central, com pelo menos 4-6 frases, desenvolvendo a comparação em detalhe.
2. explicacao: explicação técnica completa e aprofundada, com pelo menos 8-12 frases. Cubra o conceito, por que ele existe, como funciona na prática, erros comuns e quando usar cada variação, se aplicável. Pode usar parágrafos.
3. exemplo: um exemplo prático real e concreto (pode incluir trecho de código, requisição HTTP, comando, ou passo a passo numerado), mostrando o conceito sendo aplicado de verdade — não apenas descrito.
4. desafio: uma pergunta ou mini-exercício prático e específico que o aluno deve responder com as próprias palavras para provar que entendeu, conectando com o exemplo dado.

Responda SOMENTE em JSON válido, sem markdown ao redor, no formato exato:
{"metafora": "...", "explicacao": "...", "exemplo": "...", "desafio": "..."}

Dentro dos textos você pode usar quebras de linha (\\n) para organizar parágrafos, listas numeradas em texto simples, etc. Não use markdown com # ou **.`,
        },
      ],
    });

    const raw = msg.content?.[0]?.text || "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let estrutura;
    try {
      estrutura = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    } catch (e) {
      estrutura = { metafora: "", explicacao: raw, exemplo: "", desafio: "Explique com suas palavras o que você entendeu sobre este tópico." };
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
