import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseServer";

export async function POST(request) {
  try {
    const { titulo, autor, filename } = await request.json();
    if (!titulo || !filename) {
      return NextResponse.json({ error: "titulo e filename são obrigatórios" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: livro, error: errInsert } = await supabase
      .from("livros")
      .insert({ titulo, autor: autor || null, storage_path: "" })
      .select()
      .single();

    if (errInsert) {
      return NextResponse.json({ error: errInsert.message }, { status: 500 });
    }

    const path = `${livro.id}/${filename}`;

    const { data: signed, error: errSigned } = await supabase.storage
      .from("livros")
      .createSignedUploadUrl(path);

    if (errSigned) {
      await supabase.from("livros").delete().eq("id", livro.id);
      return NextResponse.json({ error: errSigned.message }, { status: 500 });
    }

    await supabase.from("livros").update({ storage_path: path }).eq("id", livro.id);

    return NextResponse.json({
      livroId: livro.id,
      path,
      token: signed.token,
    });
  } catch (err) {
    console.error("Erro upload-url:", err?.message || err);
    return NextResponse.json({ error: err?.message || "Erro ao preparar upload" }, { status: 500 });
  }
}
