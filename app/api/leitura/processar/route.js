import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { createAdminClient } from "@/lib/supabaseServer";

export const maxDuration = 60;

export async function POST(request) {
  try {
    const { livroId } = await request.json();
    if (!livroId) {
      return NextResponse.json({ error: "livroId obrigatório" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: livro, error: errLivro } = await supabase
      .from("livros")
      .select("*")
      .eq("id", livroId)
      .single();

    if (errLivro || !livro) {
      return NextResponse.json({ error: "Livro não encontrado" }, { status: 404 });
    }

    const { data: arquivo, error: errDownload } = await supabase.storage
      .from("livros")
      .download(livro.storage_path);

    if (errDownload) {
      await supabase.from("livros").update({ status: "erro", erro_mensagem: errDownload.message }).eq("id", livroId);
      return NextResponse.json({ error: errDownload.message }, { status: 500 });
    }

    const buffer = Buffer.from(await arquivo.arrayBuffer());

    let paginas;
    const parser = new PDFParse({ data: buffer });
    try {
      const resultado = await parser.getText();
      paginas = resultado.pages;
    } catch (errParse) {
      await supabase.from("livros").update({ status: "erro", erro_mensagem: errParse.message }).eq("id", livroId);
      return NextResponse.json({ error: `Erro ao processar PDF: ${errParse.message}` }, { status: 500 });
    } finally {
      await parser.destroy();
    }

    const linhas = (paginas || [])
      .map((p) => ({ livro_id: livroId, numero_pagina: p.num, texto: (p.text || "").trim() }))
      .filter((p) => p.texto.length > 0);

    if (linhas.length === 0) {
      await supabase
        .from("livros")
        .update({ status: "erro", erro_mensagem: "Nenhum texto extraído do PDF (pode ser um PDF escaneado/imagem)." })
        .eq("id", livroId);
      return NextResponse.json({ error: "Nenhum texto extraído do PDF" }, { status: 422 });
    }

    const { error: errInsert } = await supabase.from("livro_paginas").insert(linhas);
    if (errInsert) {
      await supabase.from("livros").update({ status: "erro", erro_mensagem: errInsert.message }).eq("id", livroId);
      return NextResponse.json({ error: errInsert.message }, { status: 500 });
    }

    await supabase
      .from("livros")
      .update({ status: "pronto", total_paginas: paginas.length })
      .eq("id", livroId);

    return NextResponse.json({ totalPaginas: paginas.length });
  } catch (err) {
    console.error("Erro processar:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Erro ao processar livro" }, { status: 500 });
  }
}
