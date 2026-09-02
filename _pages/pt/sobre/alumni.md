---
layout: page
title: Alumni
lang: pt
permalink: /sobre/alumni/
alt_lang: /en/about/alumni/
---

<div class="alumni-texto">
  <h2>Alumni do Observatório Oceanográfico (ex-membros)</h2>

  <p>
    Ex-integrantes do Observatório Oceanográfico que seguiram outros caminhos
    acadêmicos ou profissionais. Os registros abaixo preservam as informações
    históricas de atuação/período de vínculo tal como constavam na fonte
    original; dados incompletos (Lattes ou LinkedIn não informados) foram
    mantidos em branco.
  </p>

  <div class="alumni-list">
    {% assign alumni = site.data.alumni | sort: "name" %}
    {% for person in alumni %}
      {% include alumni-card.html person=person %}
    {% endfor %}
  </div>
</div>
