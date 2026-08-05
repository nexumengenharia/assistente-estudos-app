import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabaseServer";

export async function POST(request) {
  try {
    const { topicoId } = await request.json();
    if (!topicoId) {
      return NextResponse.json({ error: "topicoId obrigatório" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada no servidor" }, { status: 500 });
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
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 3000,
      messages: [
        {
          role: "user",
          content: `Você é um professor particular excepcional, do tipo que os alunos nunca esquecem — didático, detalhista, gosta de ir fundo no "porquê" das coisas e nunca entrega uma explicação rasa. Crie uma aula completa e aprofundada em português sobre o tópico "${topico.topico}" (módulo "${topico.modulo}").

Contexto do tópico: ${topico.descricao}

Regras gerais: nada de resposta curta ou genérica. Escreva como se fosse literalmente o conteúdo de uma aula paga de um bom curso técnico. Use exemplos concretos, números reais, nomes de ferramentas reais quando fizer sentido. Evite frases vagas tipo "é importante entender que" sem explicar o porquê.

Gere quatro partes:

1. metafora (mínimo 5 frases): uma analogia rica do dia a dia, desenvolvida em detalhe, que crie uma imagem mental clara e memorável do conceito central. Não jogue a analogia e pare — explore-a, mostre onde ela se encaixa e onde ela quebra.

2. explicacao (mínimo 250 palavras, use \\n\\n para separar em 2-3 parágrafos): explicação técnica completa. Cubra: o que é, por que existe/qual problema resolve, como funciona por dentro passo a passo, variações ou casos especiais importantes, e pelo menos um erro comum que iniciantes cometem e por que ele acontece.

3. exemplo (mínimo 100 palavras): um exemplo prático real e específico — código, requisição HTTP completa com headers/body quando fizer sentido, comando de terminal, ou passo a passo numerado — aplicando o conceito em um cenário realista de automação/backend/IA (o aluno trabalha com n8n, Supabase, APIs). Não descreva o exemplo, mostre ele.

4. desafio: uma pergunta ou mini-exercício específico (não genérico) que force o aluno a aplicar o que aprendeu, conectado diretamente ao exemplo dado.

Responda SOMENTE em JSON válido, sem markdown ao redor, no formato exato:
{"metafora": "...", "explicacao": "...", "exemplo": "...", "desafio": "..."}

Use \\n para quebras de linha dentro dos textos quando ajudar a organizar. Não use markdown com # ou **.`,
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

    const aulaTextoLegado = [estrutura.metafora, estrutura.explicacao, estrutura.exemplo, estrutura.desafio]
      .filter(Boolean)
      .join("\n\n");

    const { error: errInsert } = await supabase.from("logs_estudo").insert({
      topico_id: topico.id,
      aula_gerada: aulaTextoLegado || "aula gerada",
      aula_gerada_v2: JSON.stringify(estrutura),
      data_aula: new Date().toISOString(),
    });

    if (errInsert) {
      console.error("Erro ao salvar log da aula:", errInsert.message);
      return NextResponse.json({ error: `Erro ao salvar aula: ${errInsert.message}` }, { status: 500 });
    }

    return NextResponse.json({ aula: estrutura });
  } catch (err) {
    console.error("Erro gerar-aula:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Erro ao gerar aula" }, { status: 500 });
  }
}
