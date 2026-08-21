"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function Nav({ subtitle }) {
  const pathname = usePathname();
  const router = useRouter();

  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="gradient-header chat-header">
      <div className="chat-header" style={{ padding: 0, boxShadow: "none", flex: 1 }}>
        <div>
          <h1>📚 Assistente de Estudos</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      <nav className="top-nav">
        <Link href="/aula" className={pathname === "/aula" ? "active" : ""}>Aula</Link>
        <Link href="/grade" className={pathname === "/grade" ? "active" : ""}>Grade</Link>
        <Link href="/leitura" className={pathname?.startsWith("/leitura") ? "active" : ""}>Leitura</Link>
        <a href="#" onClick={(e) => { e.preventDefault(); sair(); }}>Sair</a>
      </nav>
    </div>
  );
}
