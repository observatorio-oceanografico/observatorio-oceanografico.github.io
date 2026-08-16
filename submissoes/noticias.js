/* ==========================================================================
   O2 Submission Portal — Notícias module logic (join/noticias.html)
   Vanilla JS, no dependencies. Self-contained and separate from join.js
   (which is Pessoas-only) so this module can evolve independently, without
   touching Pessoas at all.

   Curatorial fields (slug, filename final, layout, permalink, alt_lang,
   ordem, nome final da imagem, caminho no site) are assigned later during
   curation and are never collected here.

   Network submission (2026-08-16): prepareSubmission() validates the form,
   processes the image, renders the local payload/preview (unchanged), and
   then POSTs multipart/form-data to the real O2 Submission Worker at
   SUBMIT_ENDPOINT — a "payload" field (the JSON payload as text) plus an
   optional "image" field (the exact processed JPEG blob, filename matching
   payload.image.filename). No token or credential of any kind lives here;
   the Worker holds the only secret (GITHUB_TOKEN) and this frontend never
   sees it. The local download buttons (downloadPayload/downloadImage)
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
    return (value || "news")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "news";
  }

  function formatBytes(bytes) {
    return Math.round(bytes / 1024) + " KB";
  }

  function todayISO() {
    var d = new Date();
    var month = String(d.getMonth() + 1).padStart(2, "0");
    var day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + month + "-" + day;
  }

  /* ------------------------------------------------------------------ */
  /* Element references                                                  */
  /* ------------------------------------------------------------------ */

  var form = $("news-form");

  var els = {
    title: $("title"),
    date: $("date"),
    excerpt: $("excerpt"),
    contentMarkdown: $("contentMarkdown"),
    image: $("image")
  };

  var tagInputEl = $("tagInput");
  var tagsChipsEl = $("tags-chips");
  var markdownLivePreviewEl = $("markdown-live-preview");

  var preview = {
    langBadge: $("preview-lang-badge"),
    image: $("preview-image"),
    imageFallback: $("preview-image-fallback"),
    date: $("preview-date"),
    title: $("preview-title"),
    excerpt: $("preview-excerpt"),
    tags: $("preview-tags"),
    markdown: $("preview-markdown")
  };

  var imageErrorEl = $("image-error");
  var imagePreviewPanel = $("image-preview-panel");
  var imagePreviewEl = $("image-preview");
  var imageMetaEl = $("image-meta");

  var resultPanel = $("result-panel");
  var resultJson = $("result-json");
  var downloadJsonBtn = $("download-json");
  var downloadImageBtn = $("download-image");
  var errorSummary = $("error-summary");
  var errorSummaryList = $("error-summary-list");
  var submitStatusEl = $("submit-status");
  var submitBtn = form.querySelector('button[type="submit"]');
  var submitBtnDefaultLabel = submitBtn ? submitBtn.textContent : "Preparar submissão";

  var state = {
    tags: [], // simple multi-value list, built via the tag input
    processedImage: null, // { blob, width, height, size, previewUrl }
    lastPayload: null,
    isSubmitting: false // guards against double submission while a request is in flight
  };

  /* ------------------------------------------------------------------ */
  /* Image processing — read → downscale to fit → JPEG blob.             */
  /* Entirely local (canvas), no upload of any kind. No crop of any kind: */
  /* the full image is preserved, only downscaled when it is larger than  */
  /* MAX_LONG_EDGE. Image is optional; this pipeline only runs when a     */
  /* file is selected.                                                    */
  /* ------------------------------------------------------------------ */

  var ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
  var MAX_SOURCE_IMAGE_SIZE = 8 * 1024 * 1024; // 8 MB, original file selected by the user
  var MAX_LONG_EDGE = 1600; // px, longer of width/height — editorial images stay full-frame
  var MIN_LONG_EDGE = 640; // px, floor while chasing the output size budget
  var MAX_OUTPUT_BYTES = 1.5 * 1024 * 1024; // 1.5 MB, final JPEG
  var JPEG_QUALITY_STEPS = [0.86, 0.78, 0.68, 0.58, 0.5];

  function initImageUpload() {
    els.image.addEventListener("change", function () {
      imageErrorEl.textContent = "";
      els.image.setAttribute("aria-invalid", "false");

      var file = els.image.files && els.image.files[0];
      if (!file) {
        resetImageState();
        return;
      }

      if (ALLOWED_IMAGE_TYPES.indexOf(file.type) === -1) {
        imageErrorEl.textContent = "Escolha uma imagem em JPG, PNG ou WEBP.";
        els.image.setAttribute("aria-invalid", "true");
        els.image.value = "";
        resetImageState();
        return;
      }

      if (file.size > MAX_SOURCE_IMAGE_SIZE) {
        imageErrorEl.textContent = "A imagem selecionada é muito grande. Utilize uma imagem de até 8 MB.";
        els.image.setAttribute("aria-invalid", "true");
        els.image.value = "";
        resetImageState();
        return;
      }

      processImageFile(file);
    });
  }

  function resetImageState() {
    if (state.processedImage && state.processedImage.previewUrl) {
      URL.revokeObjectURL(state.processedImage.previewUrl);
    }
    state.processedImage = null;
    imagePreviewPanel.hidden = true;
    imageMetaEl.hidden = true;
    renderPreview();
  }

  function processImageFile(file) {
    var objectUrl = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      renderDownscaledJpeg(img)
        .then(function (result) {
          URL.revokeObjectURL(objectUrl);
          setProcessedImage(result);
        })
        .catch(function () {
          URL.revokeObjectURL(objectUrl);
          imageErrorEl.textContent = "Não foi possível processar esta imagem.";
        });
    };
    img.onerror = function () {
      URL.revokeObjectURL(objectUrl);
      imageErrorEl.textContent = "Não foi possível ler esta imagem. Tente outro arquivo.";
    };
    img.src = objectUrl;
  }

  // Draws the whole source image (no cropping) onto a canvas, scaled down
  // only if its longer edge exceeds MAX_LONG_EDGE, and encodes it as JPEG.
  // If the result is over the size budget, quality is lowered in steps;
  // if it is still over budget at the lowest quality, the canvas itself is
  // shrunk (staying above MIN_LONG_EDGE) and the quality loop restarts.
  function renderDownscaledJpeg(img) {
    return new Promise(function (resolve, reject) {
      var naturalWidth = img.naturalWidth;
      var naturalHeight = img.naturalHeight;
      var initialScale = Math.min(1, MAX_LONG_EDGE / Math.max(naturalWidth, naturalHeight));
      var longEdge = Math.round(Math.max(naturalWidth, naturalHeight) * initialScale);

      function drawAt(targetLongEdge) {
        var scale = targetLongEdge / Math.max(naturalWidth, naturalHeight);
        var width = Math.max(1, Math.round(naturalWidth * scale));
        var height = Math.max(1, Math.round(naturalHeight * scale));

        var canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("2d context unavailable"));
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        tryQualitySteps(canvas, 0, function (blob) {
          if (blob.size > MAX_OUTPUT_BYTES && targetLongEdge > MIN_LONG_EDGE) {
            drawAt(Math.max(MIN_LONG_EDGE, Math.round(targetLongEdge * 0.85)));
          } else {
            resolve({ blob: blob, width: width, height: height, size: blob.size });
          }
        });
      }

      function tryQualitySteps(canvas, stepIndex, done) {
        var quality = JPEG_QUALITY_STEPS[stepIndex];
        canvas.toBlob(function (blob) {
          if (!blob) {
            reject(new Error("JPEG encode failed"));
            return;
          }
          var isLastStep = stepIndex >= JPEG_QUALITY_STEPS.length - 1;
          if (blob.size > MAX_OUTPUT_BYTES && !isLastStep) {
            tryQualitySteps(canvas, stepIndex + 1, done);
          } else {
            done(blob);
          }
        }, "image/jpeg", quality);
      }

      drawAt(longEdge);
    });
  }

  function setProcessedImage(result) {
    if (state.processedImage && state.processedImage.previewUrl) {
      URL.revokeObjectURL(state.processedImage.previewUrl);
    }
    state.processedImage = {
      blob: result.blob,
      width: result.width,
      height: result.height,
      size: result.size,
      previewUrl: URL.createObjectURL(result.blob)
    };
    imagePreviewEl.src = state.processedImage.previewUrl;
    imagePreviewPanel.hidden = false;
    refreshImageMeta();
    renderPreview();
  }

  function computeImageFilename() {
    var title = els.title.value.trim();
    return title ? slugify(title) + ".jpg" : null;
  }

  function refreshImageMeta() {
    if (!state.processedImage) {
      imageMetaEl.hidden = true;
      return;
    }
    var filename = computeImageFilename();
    var lines = [
      "<strong>Imagem preparada:</strong>",
      filename || "(defina o título para gerar o nome do arquivo)",
      state.processedImage.width + " × " + state.processedImage.height + " px",
      "JPEG",
      formatBytes(state.processedImage.size)
    ];
    imageMetaEl.innerHTML = lines.join("<br>");
    imageMetaEl.hidden = false;
  }

  /* ------------------------------------------------------------------ */
  /* Tags — simple tag input (Enter/comma to add, × to remove). Backed by */
  /* state.tags, a plain array of strings. Same pattern as Pessoas'      */
  /* "Áreas de atuação" tag input.                                        */
  /* ------------------------------------------------------------------ */

  function addTag(rawValue) {
    var value = (rawValue || "").trim();
    if (!value) return;
    var exists = state.tags.some(function (existing) {
      return existing.toLowerCase() === value.toLowerCase();
    });
    if (!exists) {
      state.tags.push(value);
      renderTagChips();
      renderPreview();
    }
    tagInputEl.value = "";
  }

  function removeTagAt(index) {
    state.tags.splice(index, 1);
    renderTagChips();
    renderPreview();
  }

  function renderTagChips() {
    tagsChipsEl.innerHTML = "";
    state.tags.forEach(function (tag, index) {
      var chip = document.createElement("span");
      chip.className = "tag-chip";

      var label = document.createElement("span");
      label.className = "tag-chip__label";
      label.textContent = tag;
      chip.appendChild(label);

      var removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "tag-chip__remove";
      removeBtn.setAttribute("aria-label", "Remover " + tag);
      removeBtn.textContent = "×";
      removeBtn.addEventListener("click", function () {
        removeTagAt(index);
      });
      chip.appendChild(removeBtn);

      tagsChipsEl.appendChild(chip);
    });
  }

  function initTagInput() {
    tagInputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag(tagInputEl.value);
      } else if (e.key === "Backspace" && tagInputEl.value === "" && state.tags.length > 0) {
        removeTagAt(state.tags.length - 1);
      }
    });
    tagInputEl.addEventListener("blur", function () {
      addTag(tagInputEl.value);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Markdown — news content. HTML is escaped before any markdown syntax  */
  /* is applied, so raw HTML typed by the user is always shown as literal */
  /* text, never parsed as markup. Adds link support on top of the        */
  /* Pessoas renderer (headings, lists, bold, italic), since news content  */
  /* explicitly needs [text](url) links.                                  */
  /* ------------------------------------------------------------------ */

  function escapeHtml(value) {
    return (value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // Runs against already-escaped text, so any characters a URL/label
  // contributes here are already entity-encoded — nothing produced by
  // this function can break out of an attribute or introduce new markup.
  function renderInlineMarkdown(text) {
    return text
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }

  // Minimal, safe Markdown-to-HTML: headings (#, ##, ###), unordered lists
  // (-, *), **bold**, *italic*, [text](url) links, and paragraphs —
  // matching exactly what the "Conteúdo em Markdown" help text documents.
  // Everything else is escaped and shown as plain text.
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

  function formatDateDisplay(isoDate) {
    if (!isoDate) return "Data";
    var parts = isoDate.split("-");
    if (parts.length !== 3) return isoDate;
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  function getSelectedLanguage() {
    var checked = document.querySelector('input[name="language"]:checked');
    return checked ? checked.value : "pt";
  }

  function renderPreview() {
    var title = els.title.value.trim();
    var excerpt = els.excerpt.value.trim();

    preview.title.textContent = title || "Título da notícia";
    preview.date.textContent = formatDateDisplay(els.date.value);
    preview.excerpt.textContent = excerpt || "O resumo aparecerá aqui.";

    preview.tags.innerHTML = "";
    state.tags.forEach(function (tag) {
      var chip = document.createElement("span");
      chip.className = "team-card__tag";
      chip.textContent = tag;
      preview.tags.appendChild(chip);
    });

    // Once processing finishes, the preview always uses the final JPEG —
    // never the raw original file.
    if (state.processedImage) {
      preview.image.src = state.processedImage.previewUrl;
      preview.image.hidden = false;
      preview.image.alt = title ? "Imagem da notícia: " + title : "Imagem da notícia";
      preview.imageFallback.hidden = true;
    } else {
      preview.image.hidden = true;
      preview.image.removeAttribute("src");
      preview.imageFallback.hidden = false;
    }

    var markdownHtml = renderMarkdownPreview(els.contentMarkdown.value);
    if (markdownHtml) {
      preview.markdown.innerHTML = markdownHtml;
    } else {
      preview.markdown.innerHTML = '<p class="team-card__placeholder">O conteúdo em Markdown aparecerá aqui.</p>';
    }
    markdownLivePreviewEl.innerHTML = markdownHtml;

    preview.langBadge.textContent = getSelectedLanguage() === "en" ? "EN" : "PT";
  }

  function initLivePreviewBindings() {
    var watched = [els.title, els.date, els.excerpt, els.contentMarkdown];
    watched.forEach(function (el) {
      el.addEventListener("input", renderPreview);
    });
    document.querySelectorAll('input[name="language"]').forEach(function (radio) {
      radio.addEventListener("change", renderPreview);
    });
    // The generated image filename is derived from the title, so keep the
    // discrete "imagem preparada" note in sync as the person types it.
    els.title.addEventListener("input", refreshImageMeta);
  }

  /* ------------------------------------------------------------------ */
  /* Validation                                                          */
  /* ------------------------------------------------------------------ */

  // Declarative field rules: id -> { label, required }
  // Title, date, excerpt and content are required. Tags and image are
  // optional.
  var FIELD_RULES = [
    { id: "title", label: "Título", required: true },
    { id: "date", label: "Data", required: true },
    { id: "excerpt", label: "Resumo", required: true },
    { id: "contentMarkdown", label: "Conteúdo da notícia", required: true }
  ];

  function validateField(rule) {
    var el = els[rule.id];
    var value = el.value.trim();
    var message = "";

    if (rule.required && value.length === 0) {
      message = "O campo " + rule.label + " é obrigatório.";
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

  // Image is optional, but if a file was chosen it must have finished
  // processing into a final JPEG before the form can be submitted.
  function validateImage() {
    var hasFile = els.image.files && els.image.files.length > 0;
    if (hasFile && !state.processedImage) {
      var message = "Aguarde o processamento da imagem antes de continuar.";
      imageErrorEl.textContent = message;
      els.image.setAttribute("aria-invalid", "true");
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

    var imageMessage = validateImage();
    if (imageMessage) {
      errors.push({ id: "image", message: "Imagem: " + imageMessage });
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
      title: els.title.value.trim(),
      date: els.date.value,
      excerpt: els.excerpt.value.trim(),
      tags: state.tags.slice(),
      contentMarkdown: els.contentMarkdown.value.trim()
    };
  }

  // Shapes the final public submission payload. Deliberately excludes
  // curatorial fields (slug, filename final, layout, permalink, alt_lang,
  // ordem, nome final da imagem, caminho no site) — those are assigned
  // later in the curation flow and are never collected here. `image` is
  // null when no file was selected; the image is optional in this form.
  function buildSubmissionPayload(formData) {
    var image = null;
    if (state.processedImage) {
      image = {
        filename: slugify(formData.title) + ".jpg",
        mime_type: "image/jpeg",
        width: state.processedImage.width,
        height: state.processedImage.height,
        size_bytes: state.processedImage.size
      };
    }

    return {
      submission_type: "news",
      language: formData.language,
      title: formData.title,
      date: formData.date,
      excerpt: formData.excerpt,
      tags: formData.tags,
      content_markdown: formData.contentMarkdown,
      image: image
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
    triggerDownload(blob, slugify(payload.title) + ".json");
  }

  function downloadImage(blob, filename) {
    triggerDownload(blob, filename);
  }

  /* ------------------------------------------------------------------ */
  /* "Preparar submissão" — submits to the real O2 Submission Worker.    */
  /* Validates locally, processes the image, renders the local           */
  /* payload/preview (unchanged), then POSTs multipart/form-data. No      */
  /* token/secret of any kind is present in this frontend.                */
  /* ------------------------------------------------------------------ */

  var SUBMIT_ENDPOINT = "https://o2-submission-api.andrebelem.workers.dev/submit/news";

  function isValidUrl(value) {
    try {
      var url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (err) {
      return false;
    }
  }

  // Friendly pt-BR text for every error code handleNewsSubmission() in the
  // Worker can return (see worker/src/index.js). Falls back to
  // GENERIC_SUBMIT_ERROR for anything unrecognized, so a future Worker
  // error code never surfaces a blank or raw message to the user.
  var SUBMIT_ERROR_MESSAGES = {
    INVALID_CONTENT_TYPE: "Não foi possível preparar o envio. Tente novamente.",
    INVALID_FORM_DATA: "Não foi possível preparar o envio. Tente novamente.",
    MISSING_PAYLOAD: "Não foi possível preparar o envio. Tente novamente.",
    INVALID_PAYLOAD_JSON: "Não foi possível preparar o envio. Tente novamente.",
    INVALID_PAYLOAD: "Os dados não passaram na validação do servidor. Revise o formulário e tente novamente.",
    INVALID_LANGUAGE: "Os dados não passaram na validação do servidor. Revise o formulário e tente novamente.",
    INVALID_DATE: "Os dados não passaram na validação do servidor. Revise o formulário e tente novamente.",
    INVALID_TAGS: "Os dados não passaram na validação do servidor. Revise o formulário e tente novamente.",
    MISSING_IMAGE_FILE: "Houve um problema com a imagem enviada. Selecione a imagem novamente e tente de novo.",
    UNEXPECTED_IMAGE_FILE: "Houve um problema com o envio da imagem. Tente novamente.",
    INVALID_IMAGE_TYPE: "Houve um problema com o formato da imagem. Selecione a imagem novamente e tente de novo.",
    INVALID_IMAGE_FILENAME: "Houve um problema com o nome do arquivo da imagem. Selecione a imagem novamente e tente de novo.",
    IMAGE_FILENAME_MISMATCH: "Houve um problema com o nome do arquivo da imagem. Selecione a imagem novamente e tente de novo.",
    IMAGE_SIZE_MISMATCH: "Houve um problema com o tamanho do arquivo da imagem. Selecione a imagem novamente e tente de novo.",
    IMAGE_TOO_LARGE: "A imagem processada ultrapassa o limite permitido. Tente outra imagem.",
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
  // payload declares an image, an "image" field carrying the already
  // processed JPEG blob under its final filename — never the original file
  // the user selected.
  function buildSubmitFormData(payload) {
    var fd = new FormData();
    fd.append("payload", JSON.stringify(payload));
    if (payload.image && state.processedImage) {
      fd.append("image", state.processedImage.blob, payload.image.filename);
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
    downloadImageBtn.hidden = !state.processedImage;
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

    downloadImageBtn.addEventListener("click", function () {
      if (!state.lastPayload || !state.processedImage) return;
      downloadImage(state.processedImage.blob, state.lastPayload.image.filename);
    });

    form.addEventListener("reset", function () {
      window.setTimeout(function () {
        resetImageState();
        state.tags = [];
        state.lastPayload = null;
        renderTagChips();
        errorSummary.hidden = true;
        resultPanel.hidden = true;
        downloadImageBtn.hidden = true;
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
        imageErrorEl.textContent = "";
        els.image.setAttribute("aria-invalid", "false");
        els.date.value = todayISO();
        renderPreview();
      }, 0);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Init                                                                */
  /* ------------------------------------------------------------------ */

  function init() {
    if (!els.date.value) {
      els.date.value = todayISO();
    }
    initImageUpload();
    initTagInput();
    initLivePreviewBindings();
    initInlineValidation();
    initSubmit();
    renderPreview();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
