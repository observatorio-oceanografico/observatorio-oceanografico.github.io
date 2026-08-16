---
layout: page
title: Equipe
lang: pt
permalink: /sobre/equipe/
alt_lang: /en/about/team/
---

<h1 class="hero-title">Equipe</h1>

{% assign people = site.people | where: "lang", "pt" | sort: "order" %}
{% assign groups = site.data.people_groups %}

{% assign andre = people | where_exp: "p", "groups[p.slug] == 'andre'" %}
{% assign friday = people | where_exp: "p", "groups[p.slug] == 'friday'" %}
{% assign destaque = andre | concat: friday %}

{% comment %}
  Grupo "Pesquisadores seniores e colaboradores": ordem curatorial
  (senior_order), não o `order` do perfil. Entradas de senior_order
  sem perfil correspondente (ex.: Jonas, ainda sem perfil) são
  simplesmente ignoradas — nenhum card vazio é criado.
{% endcomment %}
{% assign senior_all = people | where_exp: "p", "groups[p.slug] == 'senior'" %}
{% assign senior = "" | split: "" %}
{% for senior_slug in site.data.people_groups.senior_order %}
  {% assign senior_match = senior_all | where: "slug", senior_slug %}
  {% assign senior = senior | concat: senior_match %}
{% endfor %}

{% assign pesquisadores = people | where_exp: "p", "groups[p.slug] == 'pesquisadores'" %}
{% assign estudantes = people | where_exp: "p", "groups[p.slug] == 'estudantes'" %}
{% assign extensao = people | where_exp: "p", "groups[p.slug] == 'extensao'" %}
{% assign outros = people | where_exp: "p", "groups[p.slug] == nil" %}

{% include people-beta-section.html people=destaque %}
{% include people-beta-section.html people=senior title="Pesquisadores seniores e colaboradores" spaced="true" %}
{% include people-beta-section.html people=pesquisadores title="Pesquisadores e pós-graduação" spaced="true" %}
{% include people-beta-section.html people=estudantes title="Estudantes" %}
{% include people-beta-section.html people=extensao title="Extensão e comunicação" %}
{% include people-beta-section.html people=outros title="Outros" %}

<hr>

<section class="people-beta-alumni">
  <h2 class="people-beta-alumni-title">Alumni</h2>
  <p class="people-beta-alumni-text">
    Conheça quem já fez parte do Observatório Oceanográfico.
    <a href="{{ site.baseurl }}/sobre/alumni/">Ver página de Alumni →</a>
  </p>
</section>
