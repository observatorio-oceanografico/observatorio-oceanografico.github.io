# Como adicionar sua bio ao site do Observatório Oceanográfico

> Última atualização: 21/06/2026
> Repositório: https://github.com/observatorio-oceanografico/observatorio-oceanografico.github.io

Este guia explica o passo a passo para você criar (ou atualizar) sua página
de perfil no site do Observatório Oceanográfico, em português e inglês,
usando **Fork** + **Pull Request** no GitHub.

> 💻 **Não precisa instalar nada.** Todo o processo abaixo pode ser feito
> direto pelo navegador, no site do GitHub — não é necessário usar Git,
> terminal, VS Code ou linha de comando. Se você já tiver familiaridade
> com Git, há uma alternativa rápida na seção 9, mas ela é opcional.

---

## 1. Faça um Fork do repositório

1. Acesse: https://github.com/observatorio-oceanografico/observatorio-oceanografico.github.io
2. Clique no botão **Fork** (canto superior direito da página).
3. Na tela seguinte, deixe as opções padrão e clique em **Create fork**.
4. Isso cria uma cópia do repositório na sua própria conta do GitHub, em
   `github.com/SEU-USUARIO/observatorio-oceanografico.github.io`. É dentro
   dessa cópia (o seu fork) que você vai trabalhar — você não tem permissão
   para editar o repositório original diretamente, e não precisa dela.

---

## 2. Localize a sua pasta de bios (pelo navegador)

1. No seu fork (a cópia que você acabou de criar), clique na pasta
   **`_people`**, na lista de arquivos.
2. Procure se já existem dois arquivos com o seu nome:

   ```
   _people/seu-nome.pt.md   ← versão em português
   _people/seu-nome.en.md   ← versão em inglês
   ```

3. **Se os arquivos já existirem** (pré-criados pelo professor), clique em
   cada um deles e depois no ícone de lápis ✏️ (**Edit this file**), no
   canto superior direito da visualização do arquivo, para começar a editar
   direto no navegador.

4. **Se os arquivos ainda não existirem**, você vai criá-los copiando um
   exemplo já pronto:
   - Abra o arquivo `andre-belem.pt.md` (ou outro colega já cadastrado)
     dentro de `_people`.
   - Clique no ícone de lápis ✏️ para editar.
   - Selecione todo o conteúdo e copie.
   - Volte para a pasta `_people`, clique em **Add file → Create new file**.
   - Dê o nome do novo arquivo como `seu-nome.pt.md` (e depois repita o
     processo para `seu-nome.en.md`, usando o `andre-belem.en.md` como
     modelo).
   - Cole o conteúdo copiado e ajuste os campos conforme o passo 3.

---

## 3. Edite o cabeçalho (front matter)

O bloco entre `---` no topo do arquivo contém os seus dados. Exemplo
(versão em português):

```yaml
---
layout: academic_profile
title: "Seu Nome Completo"
lang: pt
permalink: /pessoas/seu-nome/
alt_lang: /people/seu-nome/

role: "Sua função (ex: Estudante de Doutorado · Oceanografia)"
affiliation: "PPG-DOT — Dinâmica dos Oceanos e da Terra"
affiliation_url: "https://ppgdot-uff.com.br/"

avatar: "/assets/img/equipe/seu-nome.jpg"

email: "seuemail@id.uff.br"
github: "https://github.com/seu-usuario"
orcid: "0000-0000-0000-0000"
lattes: "http://lattes.cnpq.br/seu-id-lattes"
scholar: "https://scholar.google.com/citations?user=SEU_ID"
scopus: "https://www.scopus.com/authid/detail.uri?authorId=SEU_ID"
medium: "https://medium.com/@seu-usuario"

location: "Niterói, RJ"
order: 1
slug: seu-nome
---
```

### ⚠️ Regras importantes do cabeçalho

| Campo | O que fazer |
|---|---|
| `order` | **NÃO altere.** Esse número controla a ordem de exibição da equipe no site e é definido pelo Prof. André. |
| `email`, `github`, `orcid`, `lattes`, `scholar`, `scopus`, `medium` | Preencha com os seus dados. Se você não tiver algum desses perfis (ex: ainda não tem Lattes ou Scopus), **apague a linha inteira** — não deixe o campo vazio ou com `""`. |
| `permalink` / `alt_lang` | Ajuste o final da URL para o seu nome (em minúsculas, sem acentos, com hífen entre palavras — ex: `/pessoas/joao-silva/`). Mantenha o mesmo padrão entre o `.pt.md` e o `.en.md`. |
| `avatar` | Deve apontar para o caminho da sua foto dentro de `assets/img/equipe/` (veja o passo 4). |
| `slug` | Mesmo valor usado no `permalink`, sem barras (ex: `joao-silva`). |

---

## 4. Adicione sua foto (pelo navegador)

1. Escolha uma foto de boa qualidade (apresentável, em primeiro plano, de
   preferência formato quadrado ou retrato).
2. Formatos aceitos: **`.jpg`** ou **`.png`**.
3. No seu fork, navegue até a pasta `assets/img/equipe/`.
4. Clique em **Add file → Upload files**.
5. Arraste a foto do seu computador (ou clique para selecionar o arquivo).
6. Use um nome de arquivo simples, sem espaços ou acentos, **antes** de
   fazer o upload (ex: `joao-silva.jpg`) — você pode renomear o arquivo no
   seu computador antes de subir.
7. Role até o final da página e clique em **Commit changes** para salvar
   o upload diretamente na branch principal do seu fork.
8. Volte aos seus arquivos `.pt.md` e `.en.md` e atualize o campo
   `avatar:` no cabeçalho, apontando para o caminho correto, por exemplo:

   ```yaml
   avatar: "/assets/img/equipe/joao-silva.jpg"
   ```

---

## 5. Escreva o corpo do texto (sua apresentação)

Abaixo do cabeçalho, escreva livremente sua bio em formato Markdown.
Você pode usar:

- **Negrito** (`**texto**`) e *itálico* (`*texto*`)
- [Links](https://exemplo.com) (`[texto do link](https://url.com)`)
- Emojis (📫 🔬 🌊 ⚡ etc.) — copie e cole diretamente no texto
- Subtítulos com `###` (ex: `### Interesses pessoais`)
- Listas com `-` ou `*`

**Sugestão de estrutura** (não obrigatória, mas recomendada para manter
consistência visual com o restante da equipe):

```markdown
## Apresentação

[Parágrafos sobre sua formação acadêmica, trajetória e atuação atual]

📫 **Contato**
[Como as pessoas podem te encontrar/contatar]

---

### Interesses pessoais

[Hobbies, interesses fora da vida acadêmica]
```

Você pode usar o arquivo do Prof. André (`andre-belem.pt.md` /
`andre-belem.en.md`) como referência de tom e formatação.

**Lembre-se de preencher os dois arquivos** (`.pt.md` e `.en.md`) — o
conteúdo não precisa ser uma tradução literal palavra por palavra, mas deve
apresentar as mesmas informações nos dois idiomas.

---

## 6. Salve as alterações (commit) pelo navegador

Cada vez que você editar um arquivo direto no GitHub (passos 3 e 5), ao
final da edição:

1. Role até o final da página de edição.
2. Em **Commit changes**, escreva uma mensagem curta descrevendo o que foi
   feito (ex: `Adiciona bio de João Silva`).
3. Selecione a opção **Commit directly to the "main" branch** (essa branch
   é a do seu fork, não a do repositório original — está tudo certo).
4. Clique em **Commit changes**.

Repita isso para cada arquivo editado (`.pt.md`, `.en.md` e a foto, se
ainda não tiver salvo).

---

## 7. Abra o Pull Request

Depois de salvar todas as alterações no seu fork:

1. No topo da página do seu fork, deve aparecer uma faixa dizendo algo como
   *"This branch is X commits ahead of observatorio-oceanografico:main"*,
   com um botão **Contribute**.
2. Clique em **Contribute → Open pull request**.
3. Escreva um título claro, por exemplo: `Adiciona bio de João Silva`.
4. Revise as alterações mostradas (o GitHub exibe um resumo do que foi
   adicionado/alterado) e clique em **Create pull request**.
5. Pronto! O Prof. André (ou outro mantenedor) irá revisar e fazer o merge
   para o site.

---

## 8. Checklist antes de enviar o Pull Request

- [ ] Os dois arquivos (`.pt.md` e `.en.md`) foram criados/editados
- [ ] O campo `order` **não foi alterado**
- [ ] `email`, `github`, `orcid` e demais campos preenchidos com seus dados
      reais (campos sem informação foram **removidos**, não deixados em branco)
- [ ] `permalink`, `alt_lang` e `slug` seguem o mesmo padrão nos dois arquivos
- [ ] Foto adicionada em `assets/img/equipe/` (`.jpg` ou `.png`)
- [ ] Campo `avatar` aponta corretamente para o caminho da foto
- [ ] Texto de apresentação escrito nos dois idiomas
- [ ] Pull Request aberto a partir do seu fork

---

## 9. Alternativa para quem já usa Git (opcional)

Se você já tiver Git instalado e alguma familiaridade com terminal, pode
preferir trabalhar localmente em vez de editar pelo navegador:

```bash
git clone https://github.com/SEU-USUARIO/observatorio-oceanografico.github.io.git
cd observatorio-oceanografico.github.io

# edite seus arquivos normalmente no seu editor de preferência

git add _people/seu-nome.pt.md _people/seu-nome.en.md assets/img/equipe/seu-nome.jpg
git commit -m "Adiciona bio de Seu Nome"
git push origin main
```

Depois do `push`, o passo de abrir o Pull Request é o mesmo descrito na
seção 7.

---

## Dúvidas?

Fale com o Prof. André ou pergunte para a **FRIDAY** 🤖 — ela conhece a
estrutura deste repositório e pode ajudar a revisar seu arquivo antes de
você abrir o Pull Request.
