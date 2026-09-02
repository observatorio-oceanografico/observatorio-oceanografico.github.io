---
layout: page
title: Alumni
lang: en
permalink: /en/about/alumni/
alt_lang: /sobre/alumni/
---

<div class="alumni-texto">
  <h2>O₂ Alumni (Former Members)</h2>

  <p>
    Former members of the Observatório Oceanográfico who have since pursued
    other academic or professional paths. The entries below preserve the
    historical activity/period information exactly as recorded in the
    original source, which was only kept in Portuguese; missing fields
    (Lattes or LinkedIn not available) were left blank rather than
    invented or translated.
  </p>

  <div class="alumni-list">
    {% assign alumni = site.data.alumni | sort: "name" %}
    {% for person in alumni %}
      {% include alumni-card.html person=person %}
    {% endfor %}
  </div>
</div>
