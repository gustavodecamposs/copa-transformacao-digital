# Copa Transformação Digital

Campeonato de mesa-gol entre amigos. Abra `index.html` no navegador (ou sirva a pasta com qualquer servidor estático).

Sem configuração, os dados ficam só neste navegador (`localStorage`). Use Exportar em Campeões para backup.

## Dados em qualquer navegador (Supabase)

1. Crie um projeto grátis em supabase.com e rode no SQL Editor:
   ```sql
   create table copa (id text primary key, dados jsonb not null, atualizado timestamptz not null default now());
   alter table copa enable row level security;
   create policy "anon le" on copa for select to anon using (id = 'principal');
   create policy "anon grava" on copa for insert to anon with check (id = 'principal');
   create policy "anon atualiza" on copa for update to anon using (id = 'principal') with check (id = 'principal');
   ```
2. Em Project Settings > API, copie a Project URL e a chave `anon public` para `SUPABASE_URL` e `SUPABASE_KEY` no topo de `app.js`.
3. Abra o app uma vez no navegador onde estão os dados atuais: eles sobem sozinhos.
4. Hospede a pasta (GitHub Pages, Netlify Drop) para abrir de qualquer aparelho.

Quem tem o link do site pode editar os dados. Última gravação vence.

Testes das regras: `node test.js`.
