---
layout: page
title: "People — experimental version"
lang: en
permalink: /en/people-beta/
alt_lang: /pessoas-beta/
---

<h1 class="hero-title">People <span class="people-beta-tag">experimental version</span></h1>

<p class="people-beta-intro">
  This page is a visual experiment under evaluation and does not yet
  replace the official <a href="{{ site.baseurl }}/en/about/team/">Team</a>
  page. The data and individual profiles are exactly the same — only the
  visual organization is being tested here.
</p>

{% assign people = site.people | where: "lang", "en" | sort: "order" %}
{% assign groups = site.data.people_groups_beta %}

{% assign andre = people | where_exp: "p", "groups[p.slug] == 'andre'" %}
{% assign friday = people | where_exp: "p", "groups[p.slug] == 'friday'" %}
{% assign featured = andre | concat: friday %}

{% assign collaborators = people | where_exp: "p", "groups[p.slug] == 'colaboradores'" %}
{% assign researchers = people | where_exp: "p", "groups[p.slug] == 'pesquisadores'" %}
{% assign students = people | where_exp: "p", "groups[p.slug] == 'estudantes'" %}
{% assign outreach = people | where_exp: "p", "groups[p.slug] == 'extensao'" %}
{% assign others = people | where_exp: "p", "groups[p.slug] == nil" %}

{% include people-beta-section.html people=featured %}
{% include people-beta-section.html people=collaborators title="Collaborators" spaced="true" %}
{% include people-beta-section.html people=researchers title="Researchers / Graduate Students" spaced="true" %}
{% include people-beta-section.html people=students title="Students" %}
{% include people-beta-section.html people=outreach title="Outreach / Communication" %}
{% include people-beta-section.html people=others title="Others (not yet classified in this experimental version)" %}

<hr>

<p class="alumni-link">
  <a href="{{ site.baseurl }}/en/about/team/">
    → View the official Team page
  </a>
</p>
