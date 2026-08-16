/* ==========================================================================
   O2 Submission Portal — Pessoas module logic (join/pessoas.html)
   Vanilla JS, no dependencies. Split into small, self-contained modules so
   pieces (photo handling, validation, data shaping) can be lifted as-is once
   a real O2 backend exists. Loaded only by pessoas.html — home and the
   Notícias/Projetos placeholders do not include this script.

   Schema note (2026-08-16): this form was rebuilt for the real O2 "person"
   schema — a single submission is a single language (see `language` in the
   payload), not a paired PT/EN record. Curatorial fields (slug, group,
   order, senior_order, active, alumni, permalink, alt_lang) are assigned
   later during curation and are never collected here.

   Network submission (2026-08-16): prepareSubmission() validates the form,
   processes the photo, renders the local payload/preview (unchanged), and
   then POSTs multipart/form-data to the real O2 Submission Worker at
   SUBMIT_ENDPOINT — a "payload" field (the JSON payload as text) plus an
   optional "photo" field (the exact processed PNG blob, filename matching
   payload.photo.filename). No token or credential of any kind lives here;
   the Worker holds the only secret (GITHUB_TOKEN) and this frontend never
   sees it. The local download buttons (downloadPayload/downloadPhoto)
   still work independently, for conference/dev purposes.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  function $(id) {
    return document.getElementById(id);
  }

  function slugify(value) {
    return (value || "profile")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "profile";
  }

  function formatBytes(bytes) {
    return Math.round(bytes / 1024) + " KB";
  }

  /* ------------------------------------------------------------------ */
  /* Element references                                                  */
  /* ------------------------------------------------------------------ */

  var form = $("profile-form");

  var els = {
    photo: $("photo"),
    fullName: $("fullName"),
    role: $("role"),
    institution: $("institution"),
    email: $("email"),
    lattes: $("lattes"),
    orcid: $("orcid"),
    github: $("github"),
    linkedin: $("linkedin"),
    profileMarkdown: $("profileMarkdown")
  };

  var areaInputEl = $("areaInput");
  var areasChipsEl = $("areas-chips");
  var markdownLivePreviewEl = $("markdown-live-preview");

  var preview = {
    langBadge: $("preview-lang-badge"),
    photo: $("preview-photo"),
    photoFallback: $("preview-photo-fallback"),
    initials: $("preview-initials"),
    name: $("preview-name"),
    role: $("preview-role"),
    institution: $("preview-institution"),
    areas: $("preview-areas"),
    markdown: $("preview-markdown"),
    links: {
      email: $("link-email"),
      lattes: $("link-lattes"),
      orcid: $("link-orcid"),
      github: $("link-github"),
      linkedin: $("link-linkedin")
    }
  };

  var photoErrorEl = $("photo-error");
  var photoCropPanel = $("photo-crop-panel");
  var cropStageEl = $("crop-stage");
  var cropImageEl = $("crop-image");
  var cropZoomEl = $("crop-zoom");
  var photoMetaEl = $("photo-meta");

  var resultPanel = $("result-panel");
  var resultJson = $("result-json");
  var downloadJsonBtn = $("download-json");
  var downloadPhotoBtn = $("download-photo");
  var errorSummary = $("error-summary");
  var errorSummaryList = $("error-summary-list");
  var submitStatusEl = $("submit-status");
  var submitBtn = form.querySelector('button[type="submit"]');
  var submitBtnDefaultLabel = submitBtn ? submitBtn.textContent : "Preparar submissão";

  var state = {
    areas: [], // simple multi-value list, built via the tag input
    processedPhoto: null, // { blob, width, height, size, previewUrl }
    lastPayload: null,
    isSubmitting: false // guards against double submission while a request is in flight
  };

  /* ------------------------------------------------------------------ */
  /* Photo processing — read → square crop → resize 800×800 → PNG blob   */
  /* Entirely local (canvas). No upload of any kind. Photo is optional;   */
  /* this pipeline only runs when a file is selected.                    */
  /* ------------------------------------------------------------------ */

  var ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
  var MAX_SOURCE_IMAGE_SIZE = 8 * 1024 * 1024; // 8 MB, original file selected by the user
  var OUTPUT_SIZE = 800;
  var MIN_OUTPUT_SIZE = 400;
  var MAX_PNG_BYTES = 1024 * 1024; // 1 MB, final PNG
  var CROP_DEBOUNCE_MS = 120;

  // Interactive crop state. Kept separate from the photo processing
  // pipeline itself so a fancier crop editor can replace only this part
  // later without touching processProfileImage()/renderSquarePng().
  var cropState = {
    img: null,
    naturalWidth: 0,
    naturalHeight: 0,
    baseScale: 1,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    startOffsetX: 0,
    startOffsetY: 0,
    updateTimer: null,
    generation: 0,
    imageObjectUrl: null
  };

  function initPhotoUpload() {
    els.photo.addEventListener("change", function () {
      photoErrorEl.textContent = "";
      els.photo.setAttribute("aria-invalid", "false");

      var file = els.photo.files && els.photo.files[0];
      if (!file) {
        resetPhotoState();
        return;
      }

      if (ALLOWED_PHOTO_TYPES.indexOf(file.type) === -1) {
        photoErrorEl.textContent = "Escolha uma imagem em JPG, PNG ou WEBP.";
        els.photo.setAttribute("aria-invalid", "true");
        els.photo.value = "";
        resetPhotoState();
        return;
      }

      if (file.size > MAX_SOURCE_IMAGE_SIZE) {
        photoErrorEl.textContent = "A imagem selecionada é muito grande. Utilize uma imagem de até 8 MB.";
        els.photo.setAttribute("aria-invalid", "true");
        els.photo.value = "";
        resetPhotoState();
        return;
      }

      loadImageForCrop(file);
    });
  }

  function resetPhotoState() {
    cropState.img = null;
    cropState.generation++;
    if (cropState.imageObjectUrl) {
      URL.revokeObjectURL(cropState.imageObjectUrl);
      cropState.imageObjectUrl = null;
    }
    if (state.processedPhoto && state.processedPhoto.previewUrl) {
      URL.revokeObjectURL(state.processedPhoto.previewUrl);
    }
    state.processedPhoto = null;
    photoCropPanel.hidden = true;
    photoMetaEl.hidden = true;
    renderPreview();
  }

  function loadImageForCrop(file) {
    var objectUrl = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      if (cropState.imageObjectUrl) {
        URL.revokeObjectURL(cropState.imageObjectUrl);
      }
      cropState.imageObjectUrl = objectUrl;
      initCropForImage(img);
    };
    img.onerror = function () {
      URL.revokeObjectURL(objectUrl);
      photoErrorEl.textContent = "Não foi possível ler esta imagem. Tente outro arquivo.";
    };
    img.src = objectUrl;
  }

  function stageSize() {
    return cropStageEl.clientWidth || 220;
  }

  function displayedSize() {
    var scale = cropState.baseScale * cropState.zoom;
    return {
      width: cropState.naturalWidth * scale,
      height: cropState.naturalHeight * scale,
      scale: scale
    };
  }

  // Cover-fit crop centered on the image is the default/fallback: it is
  // applied automatically as soon as an image loads, before any dragging.
  function initCropForImage(img) {
    photoCropPanel.hidden = false;
    var stage = stageSize();

    cropState.img = img;
    cropState.naturalWidth = img.naturalWidth;
    cropState.naturalHeight = img.naturalHeight;
    cropState.baseScale = Math.max(stage / img.naturalWidth, stage / img.naturalHeight);
    cropState.zoom = 1;
    cropZoomEl.value = "1";

    var d = displayedSize();
    cropState.offsetX = (stage - d.width) / 2;
    cropState.offsetY = (stage - d.height) / 2;

    cropImageEl.src = img.src;
    applyImageTransform();
    scheduleCropUpdate(true);
  }

  function clampOffset() {
    var d = displayedSize();
    var stage = stageSize();
    cropState.offsetX = Math.min(0, Math.max(stage - d.width, cropState.offsetX));
    cropState.offsetY = Math.min(0, Math.max(stage - d.height, cropState.offsetY));
  }

  function applyImageTransform() {
    var d = displayedSize();
    cropImageEl.style.width = d.width + "px";
    cropImageEl.style.height = d.height + "px";
    cropImageEl.style.left = cropState.offsetX + "px";
    cropImageEl.style.top = cropState.offsetY + "px";
  }

  function scheduleCropUpdate(immediate) {
    if (cropState.updateTimer) {
      window.clearTimeout(cropState.updateTimer);
      cropState.updateTimer = null;
    }
    if (immediate) {
      generateProcessedPhoto();
    } else {
      cropState.updateTimer = window.setTimeout(generateProcessedPhoto, CROP_DEBOUNCE_MS);
    }
  }

  function initCropInteractions() {
    cropStageEl.addEventListener("pointerdown", function (e) {
      if (!cropState.img) return;
      cropState.dragging = true;
      cropState.dragStartX = e.clientX;
      cropState.dragStartY = e.clientY;
      cropState.startOffsetX = cropState.offsetX;
      cropState.startOffsetY = cropState.offsetY;
      cropStageEl.setPointerCapture(e.pointerId);
      cropStageEl.classList.add("is-dragging");
    });

    cropStageEl.addEventListener("pointermove", function (e) {
      if (!cropState.dragging) return;
      cropState.offsetX = cropState.startOffsetX + (e.clientX - cropState.dragStartX);
      cropState.offsetY = cropState.startOffsetY + (e.clientY - cropState.dragStartY);
      clampOffset();
      applyImageTransform();
      scheduleCropUpdate(false);
    });

    function endDrag() {
      if (!cropState.dragging) return;
      cropState.dragging = false;
      cropStageEl.classList.remove("is-dragging");
      scheduleCropUpdate(true);
    }
    cropStageEl.addEventListener("pointerup", endDrag);
    cropStageEl.addEventListener("pointercancel", endDrag);
    cropStageEl.addEventListener("pointerleave", function () {
      if (cropState.dragging) endDrag();
    });

    cropZoomEl.addEventListener("input", function () {
      if (!cropState.img) return;
      var stage = stageSize();
      var oldD = displayedSize();
      // Keep the same visual center while zooming in/out.
      var centerFracX = (-cropState.offsetX + stage / 2) / oldD.width;
      var centerFracY = (-cropState.offsetY + stage / 2) / oldD.height;

      cropState.zoom = parseFloat(cropZoomEl.value) || 1;
      var newD = displayedSize();
      cropState.offsetX = -(centerFracX * newD.width - stage / 2);
      cropState.offsetY = -(centerFracY * newD.height - stage / 2);

      clampOffset();
      applyImageTransform();
      scheduleCropUpdate(false);
    });
  }

  // Reads the current crop viewport back into natural-pixel source
  // coordinates and hands off to renderSquarePng() for the actual
  // resize + PNG encode + size-budget pass.
  function generateProcessedPhoto() {
    if (!cropState.img) return;

    var stage = stageSize();
    var d = displayedSize();
    var sourceSize = stage / d.scale;
    var sourceX = -cropState.offsetX / d.scale;
    var sourceY = -cropState.offsetY / d.scale;

    sourceX = Math.max(0, Math.min(sourceX, cropState.naturalWidth - sourceSize));
    sourceY = Math.max(0, Math.min(sourceY, cropState.naturalHeight - sourceSize));

    var generation = ++cropState.generation;
    var img = cropState.img;

    renderSquarePng(img, sourceX, sourceY, sourceSize, OUTPUT_SIZE)
      .then(function (result) {
        if (!result || generation !== cropState.generation) return;
        setProcessedPhoto(result);
      })
      .catch(function () {
        photoErrorEl.textContent = "Não foi possível processar esta imagem.";
      });
  }

  // Draws the given square source region onto a canvas at `outSize`,
  // encodes it as PNG, and — if the result is over the 1 MB budget —
  // progressively shrinks the output dimension (staying 1:1, staying PNG)
  // until it fits or the minimum size is reached. Never falls back to
  // JPEG/WebP.
  function renderSquarePng(img, sx, sy, ssize, outSize) {
    return new Promise(function (resolve, reject) {
      function draw(size) {
        var canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        var ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("2d context unavailable"));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, sx, sy, ssize, ssize, 0, 0, size, size);

        canvas.toBlob(function (blob) {
          if (!blob) {
            reject(new Error("PNG encode failed"));
            return;
          }
          if (blob.size > MAX_PNG_BYTES && size > MIN_OUTPUT_SIZE) {
            draw(Math.max(MIN_OUTPUT_SIZE, Math.round(size * 0.85)));
          } else {
            resolve({ blob: blob, width: size, height: size, size: blob.size });
          }
        }, "image/png");
      }
      draw(outSize);
    });
  }

  function setProcessedPhoto(result) {
    if (state.processedPhoto && state.processedPhoto.previewUrl) {
      URL.revokeObjectURL(state.processedPhoto.previewUrl);
    }
    state.processedPhoto = {
      blob: result.blob,
      width: result.width,
      height: result.height,
      size: result.size,
      previewUrl: URL.createObjectURL(result.blob)
    };
    refreshPhotoMeta();
    renderPreview();
  }

  function computePhotoFilename() {
    var name = els.fullName.value.trim();
    return name ? slugify(name) + ".png" : null;
  }

  function refreshPhotoMeta() {
    if (!state.processedPhoto) {
      photoMetaEl.hidden = true;
      return;
    }
    var filename = computePhotoFilename();
    var lines = [
      "<strong>Imagem preparada:</strong>",
      filename || "(defina o nome completo para gerar o nome do arquivo)",
      state.processedPhoto.width + " × " + state.processedPhoto.height + " px",
      "PNG",
      formatBytes(state.processedPhoto.size)
    ];
    photoMetaEl.innerHTML = lines.join("<br>");
    photoMetaEl.hidden = false;
  }

  /* ------------------------------------------------------------------ */
  /* Areas of activity — simple tag input (Enter/comma to add, × to      */
  /* remove). Backed by state.areas, a plain array of strings.           */
  /* ------------------------------------------------------------------ */

  function addArea(rawValue) {
    var value = (rawValue || "").trim();
    if (!value) return;
    var exists = state.areas.some(function (existing) {
      return existing.toLowerCase() === value.toLowerCase();
    });
    if (!exists) {
      state.areas.push(value);
      renderAreaChips();
      renderPreview();
    }
    areaInputEl.value = "";
  }

  function removeAreaAt(index) {
    state.areas.splice(index, 1);
    renderAreaChips();
    renderPreview();
  }

  function renderAreaChips() {
    areasChipsEl.innerHTML = "";
    state.areas.forEach(function (area, index) {
      var chip = document.createElement("span");
      chip.className = "tag-chip";

      var label = document.createElement("span");
      label.className = "tag-chip__label";
      label.textContent = area;
      chip.appendChild(label);

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "tag-chip__remove";
      removeBtn.setAttribute("aria-label", "Remover " + area);
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", function () {
        removeAreaAt(index);
      });
      chip.appendChild(removeBtn);

      areasChipsEl.appendChild(chip);
    });
  }

  function initAreaInput() {
    areaInputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addArea(areaInputEl.value);
      } else if (e.key === "Backspace" && areaInputEl.value === "" && state.areas.length > 0) {
        removeAreaAt(state.areas.length - 1);
      }
    });
    areaInputEl.addEventListener("blur", function () {
      addArea(areaInputEl.value);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Markdown — "Sobre mim" free-form content. HTML is escaped before any */
  /* markdown syntax is applied, so raw HTML typed by the user is always  */
  /* shown as literal text, never parsed as markup.                       */
  /* ------------------------------------------------------------------ */

  function escapeHtml(value) {
    return (value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderInlineMarkdown(text) {
    return text
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }

  // Minimal, safe Markdown-to-HTML: headings (#, ##, ###), unordered lists
  // (-, *), **bold**, *italic*, and paragraphs — matching exactly what the
  // "Conteúdo em Markdown" help text documents. Everything else is escaped
  // and shown as plain text.
  function renderMarkdownPreview(markdown) {
    var escaped = escapeHtml(markdown);
    var lines = escaped.split(/\r\n|\r|\n/);
    var html = [];
    var listOpen = false;

    function closeList() {
      if (listOpen) {
        html.push("</ul>");
        listOpen = false;
      }
    }

    lines.forEach(function (rawLine) {
      var line = rawLine.trim();

      if (line.length === 0) {
        closeList();
        return;
      }

      var heading = line.match(/^(#{1,3})\s+(.*)$/);
      if (heading) {
        closeList();
        var tag = "h" + (heading[1].length + 3); // # → h4, ## → h5, ### → h6
        html.push("<" + tag + ">" + renderInlineMarkdown(heading[2]) + "</" + tag + ">");
        return;
      }

      var listItem = line.match(/^[-*]\s+(.*)$/);
      if (listItem) {
        if (!listOpen) {
          html.push("<ul>");
          listOpen = true;
        }
        html.push("<li>" + renderInlineMarkdown(listItem[1]) + "</li>");
        return;
      }

      closeList();
      html.push("<p>" + renderInlineMarkdown(line) + "</p>");
    });

    closeList();
    return html.join("");
  }

  /* ------------------------------------------------------------------ */
  /* Live preview                                                        */
  /* ------------------------------------------------------------------ */

  function initials(name) {
    var parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function renderLinkPill(anchor, url) {
    if (url) {
      anchor.href = url;
      anchor.hidden = false;
      anchor.classList.remove("team-card__link--muted");
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    } else {
      anchor.removeAttribute("href");
      anchor.hidden = true;
    }
  }

  function getSelectedLanguage() {
    var checked = document.querySelector('input[name="language"]:checked');
    return checked ? checked.value : "pt";
  }

  function renderPreview() {
    var name = els.fullName.value.trim();
    var role = els.role.value.trim();
    var institution = els.institution.value.trim();
    var email = els.email.value.trim();

    preview.name.textContent = name || "Seu nome";
    preview.role.textContent = role || "Função / vínculo";
    preview.institution.textContent = institution || "Instituição";

    preview.areas.innerHTML = "";
    state.areas.forEach(function (area) {
      var tag = document.createElement("span");
      tag.className = "team-card__tag";
      tag.textContent = area;
      preview.areas.appendChild(tag);
    });

    // Once processing finishes, the preview always uses the final PNG —
    // never the raw original file.
    if (state.processedPhoto) {
      preview.photo.src = state.processedPhoto.previewUrl;
      preview.photo.hidden = false;
      preview.photo.alt = name ? "Foto de " + name : "Foto de perfil";
      preview.photoFallback.hidden = true;
    } else {
      preview.photo.hidden = true;
      preview.photo.removeAttribute("src");
      preview.photoFallback.hidden = false;
      preview.initials.textContent = initials(name);
    }

    renderLinkPill(preview.links.email, email ? "mailto:" + email : "");
    renderLinkPill(preview.links.lattes, els.lattes.value.trim());
    renderLinkPill(preview.links.orcid, els.orcid.value.trim());
    renderLinkPill(preview.links.github, els.github.value.trim());
    renderLinkPill(preview.links.linkedin, els.linkedin.value.trim());

    var markdownHtml = renderMarkdownPreview(els.profileMarkdown.value);
    if (markdownHtml) {
      preview.markdown.innerHTML = markdownHtml;
    } else {
      preview.markdown.innerHTML = '<p class="team-card__placeholder">Seu conteúdo em Markdown aparecerá aqui.</p>';
    }
    markdownLivePreviewEl.innerHTML = markdownHtml;

    preview.langBadge.textContent = getSelectedLanguage() === "en" ? "EN" : "PT";
  }

  function initLivePreviewBindings() {
    var watched = [
      els.fullName, els.role, els.institution, els.email,
      els.lattes, els.orcid, els.github, els.linkedin,
      els.profileMarkdown
    ];
    watched.forEach(function (el) {
      el.addEventListener("input", renderPreview);
    });
    document.querySelectorAll('input[name="language"]').forEach(function (radio) {
      radio.addEventListener("change", renderPreview);
    });
    // The generated photo filename is derived from the name, so keep the
    // discrete "imagem preparada" note in sync as the person types it.
    els.fullName.addEventListener("input", refreshPhotoMeta);
  }

  /* ------------------------------------------------------------------ */
  /* Help tips — small "?" buttons next to a few link labels             */
  /* (Lattes, ORCID, GitHub, LinkedIn). CSS alone already shows the       */
  /* bubble on :hover and :focus-visible; this only adds a tap-to-toggle  */
  /* fallback for touch screens, where hover is unreliable or absent.     */
  /* ------------------------------------------------------------------ */

  function initHelpTips() {
    var buttons = document.querySelectorAll(".help-tip__btn");
    if (!buttons.length) return;

    function closeAll() {
      buttons.forEach(function (btn) {
        btn.setAttribute("aria-expanded", "false");
      });
    }

    buttons.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var wasOpen = btn.getAttribute("aria-expanded") === "true";
        closeAll();
        if (!wasOpen) {
          btn.setAttribute("aria-expanded", "true");
        }
      });
    });

    // Tapping/clicking anywhere else, or pressing Escape, dismisses an
    // open tip. Hover/focus-visible tips are unaffected — they close on
    // their own via CSS when the pointer/focus leaves the button.
    document.addEventListener("click", closeAll);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAll();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Validation                                                          */
  /* ------------------------------------------------------------------ */

  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function isValidUrl(value) {
    try {
      var url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (err) {
      return false;
    }
  }

  // Declarative field rules: id -> { label, required, kind }
  // Only Nome completo, Função/vínculo and Instituição are required.
  // Areas, links and the Markdown content are all optional.
  var FIELD_RULES = [
    { id: "fullName", label: "Nome completo", required: true, kind: "text" },
    { id: "role", label: "Função / vínculo", required: true, kind: "text" },
    { id: "institution", label: "Instituição", required: true, kind: "text" },
    { id: "email", label: "E-mail", required: false, kind: "email" },
    { id: "lattes", label: "Lattes", required: false, kind: "url" },
    { id: "orcid", label: "ORCID", required: false, kind: "url" },
    { id: "github", label: "GitHub", required: false, kind: "url" },
    { id: "linkedin", label: "LinkedIn", required: false, kind: "url" }
  ];

  function validateField(rule) {
    var el = els[rule.id];
    var value = el.value.trim();
    var message = "";

    if (rule.required && value.length === 0) {
      message = "O campo " + rule.label + " é obrigatório.";
    } else if (value.length > 0 && rule.kind === "email" && !EMAIL_PATTERN.test(value)) {
      message = "Informe um endereço de e-mail válido.";
    } else if (value.length > 0 && rule.kind === "url" && !isValidUrl(value)) {
      message = "Informe uma URL completa começando com https://";
    }

    var errorEl = $(rule.id + "-error");
    if (message) {
      errorEl.textContent = message;
      el.setAttribute("aria-invalid", "true");
    } else {
      errorEl.textContent = "";
      el.setAttribute("aria-invalid", "false");
    }
    return message;
  }

  // Photo is optional, but if a file was chosen it must have finished
  // processing into a final PNG before the form can be submitted.
  function validatePhoto() {
    var hasFile = els.photo.files && els.photo.files.length > 0;
    if (hasFile && !state.processedPhoto) {
      var message = "Aguarde o processamento da imagem antes de continuar.";
      photoErrorEl.textContent = message;
      els.photo.setAttribute("aria-invalid", "true");
      return message;
    }
    return "";
  }

  function validateForm() {
    var errors = [];
    FIELD_RULES.forEach(function (rule) {
      var message = validateField(rule);
      if (message) {
        errors.push({ id: rule.id, message: rule.label + ": " + message });
      }
    });

    var photoMessage = validatePhoto();
    if (photoMessage) {
      errors.push({ id: "photo", message: "Foto: " + photoMessage });
    }

    if (errors.length > 0) {
      errorSummaryList.innerHTML = "";
      errors.forEach(function (err) {
        var li = document.createElement("li");
        var link = document.createElement("a");
        link.href = "#" + err.id;
        link.textContent = err.message;
        link.addEventListener("click", function (e) {
          e.preventDefault();
          var target = $(err.id);
          target.focus();
        });
        li.appendChild(link);
        errorSummaryList.appendChild(li);
      });
      errorSummary.hidden = false;
      errorSummary.scrollIntoView({ block: "start" });
    } else {
      errorSummary.hidden = true;
      errorSummaryList.innerHTML = "";
    }

    return errors.length === 0;
  }

  function initInlineValidation() {
    FIELD_RULES.forEach(function (rule) {
      els[rule.id].addEventListener("blur", function () { validateField(rule); });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Data collection & payload construction                              */
  /* ------------------------------------------------------------------ */

  // Raw form values, no shaping. Kept separate from buildSubmissionPayload()
  // so validation/collection/shaping stay independently testable.
  function collectFormData() {
    return {
      language: getSelectedLanguage(),
      fullName: els.fullName.value.trim(),
      role: els.role.value.trim(),
      institution: els.institution.value.trim(),
      areas: state.areas.slice(),
      email: els.email.value.trim(),
      lattes: els.lattes.value.trim(),
      orcid: els.orcid.value.trim(),
      github: els.github.value.trim(),
      linkedin: els.linkedin.value.trim(),
      profileMarkdown: els.profileMarkdown.value.trim()
    };
  }

  // Shapes the final public submission payload. Deliberately excludes
  // curatorial fields (slug, group, order, senior_order, active, alumni,
  // permalink, alt_lang) — those are assigned later in the admin/curation
  // flow and are never collected here. `photo` is null when no image was
  // selected; photo is optional in this form.
  function buildSubmissionPayload(formData) {
    var photo = null;
    if (state.processedPhoto) {
      photo = {
        filename: slugify(formData.fullName) + ".png",
        mime_type: "image/png",
        width: state.processedPhoto.width,
        height: state.processedPhoto.height,
        size_bytes: state.processedPhoto.size
      };
    }

    return {
      submission_type: "person",
      language: formData.language,
      name: formData.fullName,
      role: formData.role,
      institution: formData.institution,
      areas: formData.areas,
      links: {
        email: formData.email,
        lattes: formData.lattes,
        orcid: formData.orcid,
        github: formData.github,
        linkedin: formData.linkedin
      },
      profile_markdown: formData.profileMarkdown,
      photo: photo
    };
  }

  /* ------------------------------------------------------------------ */
  /* Local downloads (stand-ins for the future submit action)            */
  /* ------------------------------------------------------------------ */

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadPayload(payload) {
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    triggerDownload(blob, slugify(payload.name) + ".json");
  }

  function downloadPhoto(blob, filename) {
    triggerDownload(blob, filename);
  }

  /* ------------------------------------------------------------------ */
  /* "Preparar submissão" — submits to the real O2 Submission Worker      */
  /* (Pessoas only). Validates locally, processes the photo, renders the  */
  /* local payload/preview (unchanged), then POSTs multipart/form-data.   */
  /* No token/secret of any kind is present in this frontend.             */
  /* ------------------------------------------------------------------ */

  var SUBMIT_ENDPOINT = "https://o2-submission-api.andrebelem.workers.dev/submit/person";

  // Friendly pt-BR text for every error code handlePersonSubmission() in
  // the Worker can return (see worker/src/index.js). Falls back to
  // GENERIC_SUBMIT_ERROR for anything unrecognized, so a future Worker
  // error code never surfaces a blank or raw message to the user.
  var SUBMIT_ERROR_MESSAGES = {
    INVALID_CONTENT_TYPE: "Não foi possível preparar o envio. Tente novamente.",
    INVALID_FORM_DATA: "Não foi possível preparar o envio. Tente novamente.",
    MISSING_PAYLOAD: "Não foi possível preparar o envio. Tente novamente.",
    INVALID_PAYLOAD_JSON: "Não foi possível preparar o envio. Tente novamente.",
    INVALID_PAYLOAD: "Os dados não passaram na validação do servidor. Revise o formulário e tente novamente.",
    MISSING_PHOTO_FILE: "Houve um problema com a foto enviada. Selecione a foto novamente e tente de novo.",
    INVALID_PHOTO_TYPE: "Houve um problema com o formato da foto. Selecione a foto novamente e tente de novo.",
    PHOTO_TOO_LARGE: "A foto processada ultrapassa o limite permitido. Tente outra imagem.",
    INVALID_PHOTO_FILENAME: "Houve um problema com o nome do arquivo da foto. Selecione a foto novamente e tente de novo.",
    PHOTO_FILENAME_MISMATCH: "Houve um problema com o nome do arquivo da foto. Selecione a foto novamente e tente de novo.",
    PHOTO_SIZE_MISMATCH: "Houve um problema com o tamanho do arquivo da foto. Selecione a foto novamente e tente de novo.",
    UNEXPECTED_PHOTO_FILE: "Houve um problema com o envio da foto. Tente novamente.",
    GITHUB_TARGET_NOT_CONFIGURED: "O servidor de submissões não está disponível no momento. Tente novamente mais tarde.",
    MISSING_GITHUB_TOKEN: "O servidor de submissões não está disponível no momento. Tente novamente mais tarde.",
    GITHUB_ERROR: "Não foi possível concluir a submissão no GitHub. Tente novamente em alguns minutos."
  };
  var GENERIC_SUBMIT_ERROR = "Não foi possível enviar sua submissão. Tente novamente em alguns instantes.";
  var NETWORK_SUBMIT_ERROR = "Não foi possível conectar ao servidor de submissões. Verifique sua conexão e tente novamente.";

  function setSubmitStatus(message, kind) {
    if (!submitStatusEl) return;
    submitStatusEl.textContent = message || "";
    submitStatusEl.className = "submit-status" + (kind ? " submit-status--" + kind : "");
  }

  // Success is rendered via DOM APIs (never innerHTML with server text) so
  // that nothing from the Worker's JSON response — including the PR URL —
  // can ever be interpreted as markup.
  function renderSubmitSuccess(body) {
    submitStatusEl.innerHTML = "";
    submitStatusEl.className = "submit-status submit-status--success";

    var strong = document.createElement("strong");
    strong.textContent = "Submissão enviada com sucesso.";
    submitStatusEl.appendChild(strong);

    var github = body && body.github;
    var prUrl = github && typeof github.pull_request_url === "string" ? github.pull_request_url : "";

    if (prUrl && isValidUrl(prUrl)) {
      submitStatusEl.appendChild(document.createElement("br"));

      var link = document.createElement("a");
      link.className = "submit-status__link";
      link.href = prUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Ver Pull Request";
      submitStatusEl.appendChild(link);

      if (typeof github.pull_request_number === "number") {
        var note = document.createElement("span");
        note.className = "submit-status__note";
        note.textContent = " (PR #" + github.pull_request_number + ")";
        submitStatusEl.appendChild(note);
      }
    }
  }

  // Builds the exact multipart/form-data body the Worker expects: a
  // "payload" text field (the JSON payload, as text) and, only when the
  // payload declares a photo, a "photo" field carrying the already
  // processed PNG blob under its final filename — never the original file
  // the user selected.
  function buildSubmitFormData(payload) {
    var fd = new FormData();
    fd.append("payload", JSON.stringify(payload));
    if (payload.photo && state.processedPhoto) {
      fd.append("photo", state.processedPhoto.blob, payload.photo.filename);
    }
    return fd;
  }

  // POSTs to the Worker and always resolves (never rejects) with
  // { ok, status, body } — ok mirrors response.ok, body is the parsed JSON
  // (or null if the response had no/invalid JSON body). Network failures
  // (offline, DNS, CORS, etc.) are the only case that reaches the caller's
  // .catch(), since fetch() itself is what throws for those.
  function submitToWorker(payload) {
    var fd = buildSubmitFormData(payload);
    return fetch(SUBMIT_ENDPOINT, { method: "POST", body: fd }).then(function (response) {
      return response
        .json()
        .catch(function () {
          return null;
        })
        .then(function (body) {
          return { ok: response.ok, status: response.status, body: body };
        });
    });
  }

  function submitPayloadToWorker(payload) {
    state.isSubmitting = true;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Enviando…";
    }
    setSubmitStatus("Enviando submissão…", "pending");

    submitToWorker(payload)
      .then(function (result) {
        if (result.ok && result.body && result.body.ok) {
          renderSubmitSuccess(result.body);
        } else {
          var code = result.body && result.body.error;
          var message = (code && SUBMIT_ERROR_MESSAGES[code]) || GENERIC_SUBMIT_ERROR;
          console.error("O2 submission failed:", result.status, result.body);
          setSubmitStatus(message, "error");
        }
      })
      .catch(function (err) {
        console.error("O2 submission network error:", err);
        setSubmitStatus(NETWORK_SUBMIT_ERROR, "error");
      })
      .then(function () {
        // Runs after either branch above (ES5-friendly stand-in for
        // .finally, which is unavailable in some older environments).
        state.isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtnDefaultLabel;
        }
      });
  }

  function prepareSubmission(e) {
    if (e) e.preventDefault();
    if (state.isSubmitting) return; // guards against double submission (double click, double Enter)

    var isValid = validateForm();
    if (!isValid) {
      resultPanel.hidden = true;
      return;
    }

    var formData = collectFormData();
    var payload = buildSubmissionPayload(formData);
    state.lastPayload = payload;

    resultJson.textContent = JSON.stringify(payload, null, 2);
    resultPanel.hidden = false;
    downloadPhotoBtn.hidden = !state.processedPhoto;
    resultPanel.scrollIntoView({ block: "start", behavior: "auto" });

    submitPayloadToWorker(payload);
  }

  /* ------------------------------------------------------------------ */
  /* Submit / reset                                                      */
  /* ------------------------------------------------------------------ */

  function initSubmit() {
    form.addEventListener("submit", prepareSubmission);

    downloadJsonBtn.addEventListener("click", function () {
      if (!state.lastPayload) return;
      downloadPayload(state.lastPayload);
    });

    downloadPhotoBtn.addEventListener("click", function () {
      if (!state.lastPayload || !state.processedPhoto) return;
      downloadPhoto(state.processedPhoto.blob, state.lastPayload.photo.filename);
    });

    form.addEventListener("reset", function () {
      window.setTimeout(function () {
        resetPhotoState();
        state.areas = [];
        state.lastPayload = null;
        renderAreaChips();
        errorSummary.hidden = true;
        resultPanel.hidden = true;
        downloadPhotoBtn.hidden = true;
        setSubmitStatus("", null);
        // Does not touch state.isSubmitting: a request already in flight is
        // left to resolve on its own and will restore the button itself.
        if (submitBtn && !state.isSubmitting) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtnDefaultLabel;
        }
        FIELD_RULES.forEach(function (rule) {
          $(rule.id + "-error").textContent = "";
          els[rule.id].setAttribute("aria-invalid", "false");
        });
        photoErrorEl.textContent = "";
        els.photo.setAttribute("aria-invalid", "false");
        renderPreview();
      }, 0);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                */
  /* ------------------------------------------------------------------ */

  function init() {
    initPhotoUpload();
    initCropInteractions();
    initAreaInput();
    initLivePreviewBindings();
    initInlineValidation();
    initHelpTips();
    initSubmit();
    renderPreview();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
