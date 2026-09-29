---
title: "Portfólio"
layout: page
lang: en
alt_lang: /portfolio/
permalink: /en/portfolio/
---

The Oceanographic Observatory’s portfolio brings together research projects, outreach initiatives, and interdisciplinary actions developed within the laboratory, in collaboration with national and international institutions.

The projects presented reflect the Observatory’s main areas of activity, integrating climate and environmental sciences, data analysis, geotechnologies, human capacity building, and dialogue with society.

This portfolio aims to provide an organized and accessible overview of the activities carried out by the Oceanographic Observatory, serving as a reference source for students, researchers, journalists, public managers, and potential institutional partners.

{% assign projects = site.projects | where: "lang", "en" | sort: "order" %}

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
          Learn more →
        </a>
      </div>
    </article>
  {% endfor %}
</div>
