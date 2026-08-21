import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabaseServer";

function inicioDaSemana(dataStr) {
  const d = new Date(`${dataStr}T00:00:00Z`);
  const diaSemana = d.getUTCDay();
  const deslocamento = diaSemana === 0 ? -6 : 1 - diaSemana;
  d.setUTCDate(d.getUTCDate() + deslocamento);
  return d.toISOString().slice(0, 10);
}

function fimDaSemana(semanaInicioStr) {
  const d = new Date(`${semanaInicioStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 6);
  return d.toISOString().slice(0, 10);
}

async function gerarTexto(anthropic, prompt, maxTokens) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content?.[0]?.text?.trim() || "";
}

export async function POST(request) {
  try {
    const { livroId, data, paginaInicial, paginaFinal } = await request.json();
    if (!livroId || !data || !paginaInicial || !paginaFinal) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }
    if (paginaFinal < paginaInicial) {
      return NextResponse.json({ error: "Página final não pode ser menor que a inicial" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const { data: livro } = await supabase.from("livros").select("titulo").eq("id", livroId).single();

    const { data: paginas } = await supabase
      .from("livro_paginas")
      .select("numero_pagina, texto")
      .eq("livro_id", livroId)
      .gte("numero_pagina", paginaInicial)
      .lte("numero_pagina", paginaFinal)
      .order("numero_pagina", { ascending: true });

    if (!paginas || paginas.length === 0) {
      return NextResponse.json({ error: "Nenhum texto encontrado nesse intervalo de páginas" }, { status: 404 });
    }

    const textoTrecho = paginas.map((p) => p.texto).join("\n\n");

    const resumoDia = await gerarTexto(
      anthropic,
      `Você é um assistente de leitura. O usuário leu as páginas ${paginaInicial} a ${paginaFinal} do livro "${livro?.titulo || ""}", com o seguinte texto:\n\n"""${textoTrecho.slice(0, 15000)}"""\n\nEscreva um resumo objetivo em português (150-250 palavras) do que foi lido nesse trecho, destacando as ideias principais. Responda só com o resumo, sem introduções.`,
      800
    );

    const { data: checkin, error: errUpsert } = await supabase
      .from("leituras_diarias")
      .upsert(
        { livro_id: livroId, data, pagina_inicial: paginaInicial, pagina_final: paginaFinal, resumo_dia: resumoDia },
        { onConflict: "livro_id,data" }
      )
      .select()
      .single();

    if (errUpsert) {
      return NextResponse.json({ error: errUpsert.message }, { status: 500 });
    }

    const semanaInicio = inicioDaSemana(data);
    const semanaFim = fimDaSemana(semanaInicio);

    const { data: leiturasDaSemana } = await supabase
      .from("leituras_diarias")
      .select("data, pagina_inicial, pagina_final, resumo_dia")
      .eq("livro_id", livroId)
      .gte("data", semanaInicio)
      .lte("data", semanaFim)
      .order("data", { ascending: true });

    const resumosDaSemana = (leiturasDaSemana || []).map((l) => `${l.data}: ${l.resumo_dia}`).join("\n\n");
    const paginaInicialSemana = Math.min(...(leiturasDaSemana || []).map((l) => l.pagina_inicial));
    const paginaFinalSemana = Math.max(...(leiturasDaSemana || []).map((l) => l.pagina_final));

    const resumoSemana = await gerarTexto(
      anthropic,
      `Você é um assistente de leitura. Aqui estão os resumos diários de leitura do livro "${livro?.titulo || ""}" nesta semana (páginas ${paginaInicialSemana} a ${paginaFinalSemana}):\n\n"""${resumosDaSemana}"""\n\nSintetize num único resumo semanal coeso em português (200-350 palavras), conectando as ideias dos dias em vez de só listar. Responda só com o resumo.`,
      1000
    );

    const { data: semanaAnterior } = await supabase
      .from("resumos_semanais")
      .select("resumo_acumulado")
      .eq("livro_id", livroId)
      .lt("semana_inicio", semanaInicio)
      .order("semana_inicio", { ascending: false })
      .limit(1)
      .maybeSingle();

    let resumoAcumulado;
    if (semanaAnterior?.resumo_acumulado) {
      resumoAcumulado = await gerarTexto(
        anthropic,
        `Você é um assistente de leitura. Este é o resumo acumulado do livro "${livro?.titulo || ""}" até a semana passada:\n\n"""${semanaAnterior.resumo_acumulado}"""\n\nE este é o resumo do que foi lido nesta nova semana:\n\n"""${resumoSemana}"""\n\nEscreva um novo resumo acumulado em português (300-450 palavras) que incorpore o progresso desta semana ao histórico anterior, mantendo a visão geral do livro até agora. Responda só com o resumo.`,
        1300
      );
    } else {
      resumoAcumulado = resumoSemana;
    }

    const { error: errSemana } = await supabase.from("resumos_semanais").upsert(
      {
        livro_id: livroId,
        semana_inicio: semanaInicio,
        semana_fim: semanaFim,
        pagina_inicial: paginaInicialSemana,
        pagina_final: paginaFinalSemana,
        resumo_semana: resumoSemana,
        resumo_acumulado: resumoAcumulado,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "livro_id,semana_inicio" }
    );

    if (errSemana) {
      return NextResponse.json({ error: errSemana.message }, { status: 500 });
    }

    return NextResponse.json({ resumoDia, resumoSemana, resumoAcumulado, checkin });
  } catch (err) {
    console.error("Erro checkin:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Erro ao processar check-in" }, { status: 500 });
  }
}
