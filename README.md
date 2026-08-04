# Assistente de Estudos — App

Trilha de estudos com IA: aulas geradas por Claude, avaliação automática de respostas e acompanhamento de progresso.

## Stack
- Next.js 14 (App Router)
- Supabase (Auth + Postgres)
- Anthropic API (Claude Sonnet)
- Tailwind CSS

## Variáveis de ambiente (Vercel → Settings → Environment Variables)
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
```

## Estrutura
- `/aula` — aula do dia, geração via IA, envio de resposta e feedback
- `/grade` — grade curricular completa por módulo, com progresso
- `/api/gerar-aula` — gera o conteúdo da aula do tópico atual
- `/api/avaliar` — avalia a resposta do aluno e avança o tópico
