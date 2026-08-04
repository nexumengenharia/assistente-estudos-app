import "./globals.css";

export const metadata = {
  title: "Trilha de Estudos — Nilton",
  description: "Assistente de estudos com IA",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-ink">{children}</body>
    </html>
  );
}
