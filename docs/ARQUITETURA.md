# Arquitetura — Sob Medida (ATS pessoal)

Documento de referência das decisões técnicas, da estrutura de pastas, do modelo de dados e do fluxo completo da aplicação.

## 1. Visão geral

Aplicação full-stack em **Next.js 16 (App Router)** com **TypeScript**. A interface (React Server/Client Components) e a API (Route Handlers em Node.js) vivem no mesmo projeto. Os dados ficam em **MySQL/MariaDB** (driver `mysql2`, SQL escrito à mão, sem ORM). Os arquivos enviados ficam em disco, numa pasta privada (`storage/`), e só são servidos por rotas autenticadas. A IA (Anthropic Claude) é chamada **somente pelo servidor**, com a chave em variável de ambiente.

```
Navegador ──► proxy.ts (redireciona quem não tem cookie de sessão)
   │
   ├─► Páginas (Server Components) ──► camada de dados (src/server/repositories) ──► MySQL
   │
   └─► /api/* (Route Handlers) ──► serviços ──┬─► MySQL
                                               ├─► storage/ (arquivos)
                                               ├─► unpdf (leitura de PDF)
                                               ├─► @react-pdf/renderer (geração de PDF)
                                               └─► Claude API (análise e personalização)
```

## 2. Decisões técnicas

| Decisão | Motivo |
| --- | --- |
| Next.js 16 com Cache Components | Padrão das versões novas do framework. Páginas entregam a "casca" na hora e os dados chegam por streaming dentro de `<Suspense>`. |
| `mysql2/promise` com pool e SQL parametrizado | Pedido explícito (sem Prisma). Placeholders `?` evitam SQL injection. Compatível com MySQL 8 e MariaDB 10.4+. |
| Arquivos em disco, metadados no banco | O MariaDB do XAMPP vem com `max_allowed_packet = 1 MB`; BLOBs maiores falhariam. Disco + hash SHA-256 é simples e verificável. |
| Sessão própria (token opaco + tabela `sessions`) | Revogável (logout invalida no servidor), sem dependências. O cookie guarda só o token; o banco guarda o hash. Senhas com `scrypt` (nativo do Node). |
| Claude Opus 5.5 + saídas estruturadas (Zod) | O schema garante JSON válido e tipado; nada de "parsear texto livre". |
| Pipeline de IA em etapas | Cada etapa tem um objetivo único e é salva no banco: falhas podem ser retomadas e o progresso exibido com honestidade. |
| Salvaguardas determinísticas após a IA | A IA nunca é a última palavra sobre fatos: o código copia dados factuais do original e bloqueia competências que não existem nele. |
| `unpdf` para ler PDF | Build do pdf.js pensada para servidor (sem worker), funciona bem no Node. |
| Claude lê o PDF do currículo diretamente | Currículos em duas colunas costumam sair embaralhados na extração de texto; o modelo vê o layout da página e estrutura melhor. |
| `@react-pdf/renderer` para gerar PDF | Layout declarativo em React, texto real e selecionável, fonte embutida, hifenização desligada (palavras quebradas atrapalham ATS). |

## 3. Estrutura de pastas

```
db/migrations/           SQL versionado (aplicado por scripts/migrate.mjs)
docs/                    documentação
scripts/migrate.mjs      cria o banco e aplica migrações
assets/fonts/            fontes embutidas no PDF gerado
storage/                 arquivos enviados (ignorado pelo git)
src/
  proxy.ts               proteção otimista das páginas
  app/
    (auth)/login, (auth)/registro
    (app)/               área autenticada com sidebar
      page.tsx           Painel
      curriculo/         Meu Currículo
      nova-analise/      Nova Análise
      vagas/             Minhas Vagas
      vagas/[id]/        detalhe da vaga e compatibilidade
      vagas/[id]/curriculo/  revisão, edição e PDF
    api/                 rotas de API (auth, resume, jobs, pipeline, pdf)
  components/            UI (ui/, layout/, ats/, resume/, jobs/, review/, dashboard/)
  lib/                   código puro, usado no cliente e no servidor
    domain/              schemas Zod e tipos (currículo, vaga, relatório)
    ats/                 normalização, palavras-chave, pontuação, salvaguardas, diff
  server/                código exclusivo do servidor (import 'server-only')
    db/, auth/, storage/, pdf/, ai/, repositories/, services/
```

## 4. Modelo de dados

```
users 1──N sessions
users 1──N stored_files
users 1──N base_resumes (versões do currículo original; uma ativa)
users 1──N jobs ──N──1 base_resumes (versão usada na análise)
jobs  1──N job_files ──1 stored_files (imagens/PDF da vaga)
jobs  1──N job_status_history
jobs  1──N tailored_resumes (versões personalizadas) ──1 stored_files (PDF final)
users 1──N ai_runs (auditoria de chamadas à IA)
```

- **base_resumes**: cada envio cria uma nova versão; nunca é sobrescrita por personalizações. `data_json` guarda os dados estruturados (editáveis), `extracted_json` guarda a extração original da IA (referência imutável), `source_file_id` aponta para o PDF enviado.
- **jobs**: dados da vaga, texto consolidado, `analysis_json` (análise da vaga), `match_json` (requisito a requisito, com evidências), `score_json` (cálculo da pontuação), status da candidatura e estado do pipeline.
- **tailored_resumes**: `base_snapshot_json` (cópia do original usado), `ai_content_json` (versão gerada após as salvaguardas), `content_json` (versão atual com edições), `report_json` (alterações, palavras-chave, lacunas, verificação de fidelidade, sugestões).

## 5. Fluxo completo

1. **Cadastro/login** → sessão em cookie `HttpOnly`.
2. **Meu Currículo**: upload do PDF → validação (assinatura `%PDF`, tamanho, páginas) → extração de texto local (unpdf) → Claude estrutura os dados a partir do PDF → IDs estáveis atribuídos pelo código → nova versão ativa. O usuário revisa e corrige.
3. **Nova Análise**: texto e/ou imagens e/ou PDF → vaga criada (estado `criada`).
4. Pipeline (cada etapa é uma requisição, com progresso real na tela):
   1. **Leitura**: PDF com texto é lido localmente; imagens/PDF escaneado são transcritos pela IA.
   2. **Análise da vaga**: cargo, nível, requisitos atômicos (obrigatório/desejável), tecnologias, competências, formação, diferenciais, palavras-chave ATS com variações. A IA vê só a vaga.
   3. **Compatibilidade**: cada requisito é avaliado contra o currículo com trechos literais como evidência; o código confere se os trechos existem. A pontuação é calculada pelo código (fórmula exibida na tela).
   4. **Personalização**: a IA reescreve e reorganiza referenciando os IDs do original; o código mescla com os fatos do original e bloqueia o que não existe nele.
   5. **Verificação de fidelidade**: uma segunda chamada, independente, procura afirmações sem respaldo e propõe correções; o código aplica as correções e roda checagens finais (termos técnicos inexistentes, números sem origem, senioridade inflada).
5. **Revisão**: original × personalizado, diferenças, palavras-chave adicionadas, reorganização, lacunas não adicionadas, sugestões; edição livre; pré-visualização.
6. **PDF**: gerado a partir da versão revisada, salvo e baixado como `Nome_Curriculo_Cargo.pdf`. Status passa a "Currículo preparado".
7. **Minhas Vagas**: histórico, status da candidatura (com histórico de mudanças), download do PDF correspondente.

## 6. Segurança

- Rotas de API verificam a sessão no servidor (o proxy faz só um redirecionamento otimista e não roda em `/api`).
- Toda consulta filtra por `user_id`; IDs de outros usuários retornam 404.
- Requisições que alteram dados exigem `Origin` do próprio site; cookie `SameSite=Lax`.
- Uploads: tipo verificado pelos bytes iniciais (não pela extensão), limites de tamanho e de páginas, nomes aleatórios em disco, caminho confinado à pasta de armazenamento.
- Conteúdo de vagas e documentos é tratado como **dado não confiável**: vai delimitado por tags, o prompt proíbe seguir instruções internas, a saída é restrita por schema e as salvaguardas do código impedem que uma "instrução escondida" altere fatos do currículo. Instruções suspeitas são mostradas ao usuário.
- Chave da IA apenas no servidor (`server-only` impede importação acidental no cliente).
- Limite de tentativas de login e de chamadas de IA por usuário.
