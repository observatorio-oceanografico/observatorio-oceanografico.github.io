---
title: "Portfólio"
layout: page
lang: pt
alt_lang: /en/portfolio/
permalink: /portfolio/
---

O portfólio do Observatório Oceanográfico reúne projetos de pesquisa,
iniciativas de extensão e ações interdisciplinares desenvolvidas no
âmbito do laboratório, em colaboração com instituições nacionais e
internacionais.

Os projetos apresentados refletem os principais eixos de atuação do
Observatório, integrando ciência climática e ambiental, análise de
dados, geotecnologias, formação de recursos humanos e diálogo com a
sociedade.

Este portfólio tem como objetivo oferecer uma visão organizada e
acessível das atividades desenvolvidas pelo Observatório Oceanográfico,
servindo como fonte de referência para estudantes, pesquisadores,
jornalistas, gestores públicos e potenciais parceiros institucionais.

{% assign projects = site.projects | where: "lang", "pt" | sort: "order" %}

<div class="project-list">
  {% for project in projects %}
    <article class="project-card">
      {% if project.header.teaser %}
        <div class="project-thumb">
          <img src="{{ project.header.teaser | relative_url }}"
               alt="{{ project.title }}">
        </div>
      {% endif %}

      <div class="project-body">
        <h3 class="project-title">
          <a href="{{ project.url | relative_url }}">{{ project.title }}</a>
        </h3>

        <p class="project-excerpt">
          {{ project.excerpt }}
        </p>

        <a class="project-link" href="{{ project.url | relative_url }}">
          Saiba mais →
        </a>
      </div>
    </article>
  {% endfor %}
</div>
