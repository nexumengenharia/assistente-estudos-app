"use client";
import { useParams } from "next/navigation";
import AulaChat from "@/components/AulaChat";

export default function AulaTopicoPage() {
  const params = useParams();
  return <AulaChat topicoId={params.id} />;
}
