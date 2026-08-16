---
layout: page
title: "Pessoas — versão experimental"
lang: pt
permalink: /pessoas-beta/
alt_lang: /en/people-beta/
---

<h1 class="hero-title">Pessoas <span class="people-beta-tag">versão experimental</span></h1>

<p class="people-beta-intro">
  Esta página é um experimento visual em avaliação e ainda não substitui a
  página oficial de <a href="{{ site.baseurl }}/sobre/equipe/">Equipe</a>.
  Os dados e os perfis individuais são exatamente os mesmos — só a
  organização visual está sendo testada aqui.
</p>

{% assign people = site.people | where: "lang", "pt" | sort: "order" %}
{% assign groups = site.data.people_groups_beta %}

{% assign andre = people | where_exp: "p", "groups[p.slug] == 'andre'" %}
{% assign friday = people | where_exp: "p", "groups[p.slug] == 'friday'" %}
{% assign destaque = andre | concat: friday %}

{% assign colaboradores = people | where_exp: "p", "groups[p.slug] == 'colaboradores'" %}
{% assign pesquisadores = people | where_exp: "p", "groups[p.slug] == 'pesquisadores'" %}
{% assign estudantes = people | where_exp: "p", "groups[p.slug] == 'estudantes'" %}
{% assign extensao = people | where_exp: "p", "groups[p.slug] == 'extensao'" %}
{% assign outros = people | where_exp: "p", "groups[p.slug] == nil" %}

{% include people-beta-section.html people=destaque %}
{% include people-beta-section.html people=colaboradores title="Colaboradores" spaced="true" %}
{% include people-beta-section.html people=pesquisadores title="Pesquisadores / pós-graduação" spaced="true" %}
{% include people-beta-section.html people=estudantes title="Estudantes" %}
{% include people-beta-section.html people=extensao title="Extensão / comunicação" %}
{% include people-beta-section.html people=outros title="Outros (ainda não classificados nesta versão experimental)" %}

<hr>

<p class="alumni-link">
  <a href="{{ site.baseurl }}/sobre/equipe/">
    → Ver a página oficial de Equipe
  </a>
</p>
