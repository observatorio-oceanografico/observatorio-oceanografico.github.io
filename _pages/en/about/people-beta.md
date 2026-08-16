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
{% assign groups = site.data.people_groups %}

{% assign andre = people | where_exp: "p", "groups[p.slug] == 'andre'" %}
{% assign friday = people | where_exp: "p", "groups[p.slug] == 'friday'" %}
{% assign featured = andre | concat: friday %}

{% comment %}
  "Senior researchers and collaborators" group: curatorial order
  (senior_order), not the profile's `order`. senior_order entries
  without a matching profile (e.g. Jonas, no profile yet) are simply
  skipped — no empty card is created.
{% endcomment %}
{% assign senior_all = people | where_exp: "p", "groups[p.slug] == 'senior'" %}
{% assign senior = "" | split: "" %}
{% for senior_slug in site.data.people_groups.senior_order %}
  {% assign senior_match = senior_all | where: "slug", senior_slug %}
  {% assign senior = senior | concat: senior_match %}
{% endfor %}

{% assign researchers = people | where_exp: "p", "groups[p.slug] == 'pesquisadores'" %}
{% assign students = people | where_exp: "p", "groups[p.slug] == 'estudantes'" %}
{% assign outreach = people | where_exp: "p", "groups[p.slug] == 'extensao'" %}
{% assign others = people | where_exp: "p", "groups[p.slug] == nil" %}

{% include people-beta-section.html people=featured %}
{% include people-beta-section.html people=senior title="Senior researchers and collaborators" spaced="true" %}
{% include people-beta-section.html people=researchers title="Researchers and graduate students" spaced="true" %}
{% include people-beta-section.html people=students title="Students" %}
{% include people-beta-section.html people=outreach title="Outreach and communication" %}
{% include people-beta-section.html people=others title="Others (not yet classified in this experimental version)" %}

<hr>

<section class="people-beta-alumni">
  <h2 class="people-beta-alumni-title">Alumni</h2>
  <p class="people-beta-alumni-text">
    Meet those who were once part of the Observatório Oceanográfico.
    <a href="{{ site.baseurl }}/en/about/alumni/">View the Alumni page →</a>
  </p>
</section>

<hr>

<p class="people-beta-back-link">
  <a href="{{ site.baseurl }}/en/about/team/">
    → View the official Team page
  </a>
</p>
