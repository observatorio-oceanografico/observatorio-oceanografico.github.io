# Migração de permalinks das notícias

Registro técnico da migração dos permalinks de `_posts/` (notícias) para o
padrão limpo `/noticias/<slug>/` (PT) e `/en/news/<slug>/` (EN), mantendo
100% de compatibilidade com as 13 URLs antigas.

Esta migração tocou **apenas** permalinks, redirects e o `<link rel="canonical">`.
Nenhum layout, CSS, imagem, excerpt, category, tag ou texto de notícia foi alterado.

## Tabela: URL antiga → URL nova

| Arquivo | Idioma | URL antiga | URL nova |
|---|---|---|---|
| `2025-06-04-o2-na-semana-do-meio-ambiente-uff.md` | pt | `/2025/06/04/o2-na-semana-do-meio-ambiente-uff.html` | `/noticias/o2-na-semana-do-meio-ambiente-uff/` |
| `2025-06-25-seminario-interno-aratinga.md` | pt | `/2025/06/25/seminario-interno-aratinga.html` | `/noticias/seminario-interno-aratinga/` |
| `2025-08-01-Ayemboe_Silas.md` | pt | `/2025/08/01/ayemboe_silas.html` | `/noticias/ayemboe_silas/` |
| `2025-08-22-ISAES2025-participation.md` | en | `/2025/08/18/isaes2025-participation.html` * | `/en/news/isaes2025-participation/` |
| `2025-08-22-Participacao-ISAES2025.md` | pt | `/2025/08/18/participacao-isaes2025.html` * | `/noticias/participacao-isaes2025/` |
| `2025-12-02-acknowledge-Elsevier-Evolving-Earth.md` | en | `/2025/12/02/acknowledge-elsevier-evolving-earth.html` | `/en/news/acknowledge-elsevier-evolving-earth/` |
| `2025-12-02-agradecimento-Elsevier-Evolving-Earth.md` | pt | `/2025/12/02/agradecimento-elsevier-evolving-earth.html` | `/noticias/agradecimento-elsevier-evolving-earth/` |
| `2026-05-13-New-article-STOTEN.md` | en | `/2026/05/13/new-article-stoten.html` | `/en/news/new-article-stoten/` |
| `2026-05-13-Novo-artigo-STOTEN.md` | pt | `/2026/05/13/novo-artigo-stoten.html` | `/noticias/novo-artigo-stoten/` |
| `2026-05-16-cultura-oceanica-selecao-bolsistas.md` | pt | `/cultura-oceanica/extensao/observatorio-oceanografico/2026/05/16/cultura-oceanica-selecao-bolsistas.html` | `/noticias/cultura-oceanica-selecao-bolsistas/` |
| `2026-05-16-ocean-literacy-selection-process.md` | en | `/cultura-oceanica/extensao/observatorio-oceanografico/2026/05/16/ocean-literacy-selection-process.html` | `/en/news/ocean-literacy-selection-process/` |
| `2026-08-26-o2-presents-turtle-replica-fluhidros-enes.md` | en | `/cultura-oceanica/extensao/observatorio-oceanografico/2026/08/26/o2-presents-turtle-replica-fluhidros-enes.html` | `/en/news/o2-presents-turtle-replica-fluhidros-enes/` |
| `2026-08-26-observatorio-oceanografico-apresenta-replica-tartaruga-fluhidros-enes.md` | pt | `/cultura-oceanica/extensao/observatorio-oceanografico/2026/08/26/observatorio-oceanografico-apresenta-replica-tartaruga-fluhidros-enes.html` | `/noticias/observatorio-oceanografico-apresenta-replica-tartaruga-fluhidros-enes/` |

\* Os dois posts do ISAES têm nome de arquivo com data `2025-08-22`, mas
front matter com `date: 2025-08-18`. O permalink padrão do Jekyll usa a
`date` do front matter (não a data do nome do arquivo) para montar
`:year/:month/:day`, então a URL antiga real dessas duas notícias já era
`/2025/08/18/...`, não `/2025/08/22/...`. Confirmado no build real (a
pasta `2025/08/22/` não é gerada). Os dois redirects estáticos usam a
data correta, `2025-08-18`.

Notícias sem `categories` (as 9 mais antigas) tinham URL
`/:year/:month/:day/:title.html`. Notícias com `categories` (as 4 mais
recentes, `cultura-oceanica`/`extensao`/`observatorio-oceanografico`)
tinham URL `/:categories/:year/:month/:day/:title.html` — daí o padrão
mais longo. Ambos os casos migram para o mesmo padrão limpo.

## O que mudou

1. **`_config.yml`** — nova coleção `redirects` (`output: true`, sem
   permalink global, cada documento define o seu — mesmo padrão já usado
   por `people`/`projects`). Não altera `posts` nem nenhuma coleção
   existente.
2. **13 arquivos em `_posts/`** — cada um recebeu uma linha
   `permalink: /noticias/<slug>/` ou `permalink: /en/news/<slug>/` no
   front matter. Nada mais foi tocado nesses arquivos.
3. **`_layouts/redirect.html`** (novo) — layout mínimo e isolado para as
   páginas de redirect: `<meta http-equiv="refresh">`, `<link rel="canonical">`
   e um link clicável. Não estende `_layouts/default.html` (não herda
   navegação/rodapé) e não usa JavaScript.
4. **`_redirects/*.html`** (13 arquivos novos) — um stub por URL antiga,
   cada um com `permalink: <url antiga>` e `redirect_to: <url nova>`.
   `sitemap: false` para não poluir o `sitemap.xml` do jekyll-sitemap.
5. **`_includes/head.html`** — adicionado `<link rel="canonical" href="{{ page.url | absolute_url }}">`.
   O site não tinha nenhum mecanismo de canonical antes (verificado:
   nenhum `rel="canonical"` existia em nenhum include/layout, e
   `jekyll-seo-tag` não está entre os plugins). Ver nota de escopo abaixo.

## Mecanismo de redirect escolhido

**Páginas estáticas de redirect**, não `jekyll-redirect-from`.

O repositório não usa `jekyll-redirect-from` nem qualquer plugin
equivalente hoje (`_config.yml` só lista `jekyll-feed` e
`jekyll-sitemap`, e não há `Gemfile` — o site é construído pelo pipeline
clássico do GitHub Pages a partir da whitelist de plugins do gem
`github-pages`). Como não havia suporte já existente e confiável, e o
pedido era para não introduzir dependência nova sem necessidade, optei
pela alternativa seguramente suportada: 13 páginas HTML mínimas, cada
uma na sua coleção isolada (`_redirects/`), sem plugin, sem JavaScript,
funcionando em qualquer build Jekyll padrão (testado com Jekyll 4.4.1
puro, sem gems extras além de `jekyll-feed`/`jekyll-sitemap`).

Cada stub contém:
```html
<meta http-equiv="refresh" content="0; url=/noticias/<slug>/">
<link rel="canonical" href="https://.../noticias/<slug>/">
<p>Esta página mudou de endereço. <a href="/noticias/<slug>/">Clique aqui para continuar</a>.</p>
```

## Canonical

Antes desta mudança, o site **não gerava `<link rel="canonical">` em
nenhuma página** (nem posts, nem páginas comuns) — confirmado revisando
`_includes/head.html` e todos os `_layouts/*.html`. Não havia, portanto,
nada para duplicar.

Foi adicionado um canonical único e global em `_includes/head.html`,
apontando sempre para `page.url` absoluto. Isso cobre as notícias (que
era o pedido) mas também passa a cobrir todas as outras páginas do site,
já que não existe como isolar esse include só para `news-single` sem
tocar em `_layouts/news-single.html` (que está na lista de "não
alterar"). Avaliei como um acréscimo seguro: não muda nada visualmente,
não conflita com nada existente, e é o comportamento padrão esperado de
qualquer site. Caso prefira reverter esse escopo mais amplo, é a
remoção de 5 linhas em `_includes/head.html`.

**Limitação residual conhecida:** `_config.yml` define `url:
https://observatorio-oceanografico.github.io`, mas o `CNAME` do
repositório aponta para `observatoriooceanografico.org`. Isso é uma
inconsistência pré-existente (não introduzida por esta migração) e faz
o canonical (e o `feed.xml`, que já sofria do mesmo problema antes)
apontar para o domínio `.github.io` em vez do domínio customizado. Não
corrigi porque está fora do escopo (permalinks das notícias) — mas como
o canonical agora depende diretamente desse valor, deixo sinalizado.

## Sistema de submissões — nenhuma mudança de comportamento

`_submissions/news`, `submissoes/noticias.html`, `submissoes/noticias.js`
e o Cloudflare Worker não foram tocados. O fluxo continua:

```
submissão → JSON staging → conversão manual → _posts
```

**Para a curadoria manual futura:** ao converter um JSON de submissão em
um novo arquivo em `_posts/`, adicione o permalink explícito no front
matter, seguindo o mesmo padrão desta migração:

```yaml
# post em português
permalink: /noticias/<slug>/
```

```yaml
# post em inglês
permalink: /en/news/<slug>/
```

Sem esse campo, o post volta a usar o permalink padrão do Jekyll
(`/:categories/:year/:month/:day/:title.html`), que foi exatamente o
problema que esta migração resolveu.

## Validação (build real)

Build executado com Jekyll 4.4.1 + jekyll-feed + jekyll-sitemap (sem
plugins adicionais, mesmo conjunto do `_config.yml` atual), em container
Docker isolado, comparado byte a byte contra um build da mesma árvore
antes da migração (`git archive HEAD`).

- **Build limpo:** os únicos avisos do Jekyll são os 5 já existentes
  antes da migração (erro de sintaxe Liquid em `_pages/*/portfolio/index.md`,
  layout `home` inexistente em `index.md`, e 3 conflitos de destino
  envolvendo `_resources/`/`_pages/*/recursos`) — nenhum é novo, nenhum
  é relacionado a notícias.
- **13 URLs novas** confirmadas na saída do build, incluindo os 4 casos
  pedidos: 2 notícias PT, 1 EN, 1 antiga sem `categories`
  (`ayemboe_silas`), 1 recente com `categories`
  (`observatorio-oceanografico-apresenta-replica-tartaruga-fluhidros-enes`).
- **13 URLs antigas** confirmadas geradas nos mesmos caminhos de sempre
  (inclusive `2025/08/18/...` para os dois posts do ISAES, não
  `2025/08/22/`), cada uma com meta refresh de 0s, canonical absoluto
  para a URL nova e link clicável — sem loop (a URL antiga nunca aponta
  para si mesma) e sem JavaScript.
- **`/noticias/` e `/en/news/`**: os cards e o item em destaque de ambas
  as listagens apontam para as 13 URLs novas (via `post.url`, sem
  nenhuma URL hardcoded) — confirmado por grep nos dois `index.html`
  gerados.
- **`feed.xml`**: também passou a linkar para as URLs novas
  automaticamente (mesmo mecanismo `post.url`, plugin `jekyll-feed`).
- **Layout inalterado:** diff completo do HTML gerado (build antes vs.
  depois) mostra que a única diferença em páginas fora do escopo é a
  nova linha do canonical em `_includes/head.html` — nenhuma mudança de
  estrutura, classe CSS ou conteúdo em `news-single`/`news-list`/`news-card`.

## Limitações residuais

- O mismatch `site.url` vs. `CNAME` (acima) é pré-existente e agora
  afeta também o canonical, além do `feed.xml`.
- Os redirects são "soft" (meta refresh + canonical), não HTTP 301 —
  GitHub Pages não permite redirect HTTP customizado em hospedagem
  estática sem plugin/servidor próprio. É o mesmo padrão já usado por
  sites Jekyll/GitHub Pages sem `jekyll-redirect-from`.
- Notei, sem relação com esta migração, que 3 posts (`Ayemboe_Silas`,
  os dois `ISAES2025`) já estavam com a extensão de imagem corrigida de
  `.jpg` para `.jpeg` na árvore de trabalho (não commitada), condizente
  com o nome real dos arquivos em `assets/img/noticias/`. Não mexi
  nisso — é conteúdo, fora do escopo desta tarefa — só registro para não
  gerar confusão ao revisar o diff.
