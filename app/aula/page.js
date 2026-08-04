"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import Nav from "@/components/Nav";

export default function AulaIndexPage() {
  const supabase = createClient();
  const router = useRouter();
  const [semTopico, setSemTopico] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: atual } = await supabase
        .from("grade_curricular")
        .select("id")
        .eq("status", "estudando")
        .order("ordem", { ascending: true })
        .limit(1)
        .maybeSingle();

      let alvo = atual;
      if (!alvo) {
        const { data: prox } = await supabase
          .from("grade_curricular")
          .select("id")
          .eq("status", "pendente")
          .order("ordem", { ascending: true })
          .limit(1)
          .maybeSingle();
        alvo = prox;
      }

      if (alvo) {
        router.replace(`/aula/${alvo.id}`);
      } else {
        setSemTopico(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="chat-shell">
      <Nav />
      <div style={{ padding: 40, textAlign: "center", color: "#999" }}>
        {semTopico ? "🎉 Você concluiu todos os tópicos da trilha!" : "Carregando..."}
      </div>
    </div>
  );
}
