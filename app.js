(() => {
  "use strict";

  const TASK_PRIORITY_FOR_X = [
    "video_open_vocabulary",
    "video_promptable",
    "video_semi_supervised",
    "image_automatic",
    "image_promptable",
  ];

  const state = {
    data: null,
    activeView: "bubble",
    selectedModelId: null,
    sortKey: "release_date",
    sortDir: "desc",
    expandMultitask: false,
    filters: {
      search: "",
      families: new Set(),
      tasks: new Set(),
      methods: new Set(),
      includeSecondary: false,
      paramMax: 900,
      includeNullParams: true,
      yearMin: 2022,
      yearMax: 2026,
    },
  };

  const els = {
    metaSummary: document.getElementById("meta-summary"),
    countPill: document.getElementById("model-count-pill"),
    statusBanner: document.getElementById("status-banner"),
    searchInput: document.getElementById("search-input"),
    filterFamilies: document.getElementById("filter-families"),
    filterTasks: document.getElementById("filter-tasks"),
    filterMethods: document.getElementById("filter-methods"),
    chkIncludeSecondary: document.getElementById("chk-include-secondary"),
    paramMaxRange: document.getElementById("param-max-range"),
    paramMaxLabel: document.getElementById("param-max-label"),
    chkIncludeNullParams: document.getElementById("chk-include-null-params"),
    yearMinRange: document.getElementById("year-min-range"),
    yearMaxRange: document.getElementById("year-max-range"),
    yearRangeLabel: document.getElementById("year-range-label"),
    chkExpandMultitask: document.getElementById("chk-expand-multitask"),
    familyLegend: document.getElementById("family-legend"),
    bubbleSvg: document.getElementById("bubble-svg"),
    tableBody: document.getElementById("models-table-body"),
    treeContainer: document.getElementById("tree-container"),
    detailEmpty: document.getElementById("detail-empty"),
    detailContent: document.getElementById("detail-content"),
    tooltip: document.getElementById("chart-tooltip"),
    defsModal: document.getElementById("defs-modal"),
    defsModalBody: document.getElementById("defs-modal-body"),
    jsonFileInput: document.getElementById("json-file-input"),
  };

  function getTaxonomyMaps() {
    const t = state.data.taxonomies;
    return {
      taskMap: new Map(t.task_types.map((x) => [x.id, x])),
      methodMap: new Map(t.optimization_methods.map((x) => [x.id, x])),
      familyMap: new Map(t.base_families.map((x) => [x.id, x])),
    };
  }

  function showError(msg) {
    els.statusBanner.textContent = msg;
    els.statusBanner.classList.remove("hidden");
  }

  function clearError() {
    els.statusBanner.textContent = "";
    els.statusBanner.classList.add("hidden");
  }

  async function loadDefaultData() {
    clearError();
    try {
      const res = await fetch("data/models.json", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = await res.json();
      initializeWithData(json);
    } catch (err) {
      showError(
        `data/models.json の読み込みに失敗しました (${err.message})。` +
          `ローカルHTTPサーバー (例: python3 -m http.server 8080) 経由で開くか、左下の「別JSONファイル読込」から data/models.json を選択してください。`
      );
      els.metaSummary.textContent = "データ未読込";
    }
  }

  function initializeWithData(json) {
    state.data = json;
    if (!json.models.some((model) => model.id === state.selectedModelId)) {
      state.selectedModelId = null;
      els.detailContent.replaceChildren();
      els.detailContent.classList.add("hidden");
      els.detailEmpty.classList.remove("hidden");
    }
    const { metadata, taxonomies, models } = json;
    els.metaSummary.textContent =
      `登録モデル数: ${models.length} | データ版: ${metadata.version} | 最終更新: ${metadata.last_updated} | 定義書: ${metadata.definition_doc}`;

    state.filters.families = new Set(taxonomies.base_families.map((f) => f.id));
    state.filters.tasks = new Set(taxonomies.task_types.map((t) => t.id));
    state.filters.methods = new Set(taxonomies.optimization_methods.map((m) => m.id));

    const years = models
      .map((m) => Number(String(m.release_date).slice(0, 4)))
      .filter((y) => !Number.isNaN(y));
    const minY = years.length ? Math.min(...years) : 2022;
    const maxY = years.length ? Math.max(...years) : 2026;
    els.yearMinRange.min = String(minY);
    els.yearMinRange.max = String(maxY);
    els.yearMaxRange.min = String(minY);
    els.yearMaxRange.max = String(maxY);
    state.filters.yearMin = minY;
    state.filters.yearMax = maxY;
    els.yearMinRange.value = String(minY);
    els.yearMaxRange.value = String(maxY);
    els.yearRangeLabel.textContent = `${minY} - ${maxY}`;

    const numericParams = models
      .map((m) => m.params_million)
      .filter((p) => typeof p === "number");
    const maxP = numericParams.length ? Math.ceil(Math.max(...numericParams) / 50) * 50 : 900;
    els.paramMaxRange.max = String(Math.max(maxP, 100));
    els.paramMaxRange.value = String(Math.max(maxP, 100));
    state.filters.paramMax = Math.max(maxP, 100);
    els.paramMaxLabel.textContent = `${state.filters.paramMax}M`;

    renderFilterCheckboxes();
    renderLegend();
    renderAll();
  }

  function renderFilterCheckboxes() {
    const { base_families, task_types, optimization_methods } = state.data.taxonomies;

    els.filterFamilies.innerHTML = "";
    for (const fam of base_families) {
      const label = document.createElement("label");
      label.className = "chk-item";
      label.innerHTML = `
        <input type="checkbox" data-filter-family="${fam.id}" ${state.filters.families.has(fam.id) ? "checked" : ""} />
        <span class="swatch" style="background:${fam.color}"></span>
        <span>${escapeHtml(fam.label)}</span>
      `;
      els.filterFamilies.appendChild(label);
    }

    els.filterTasks.innerHTML = "";
    for (const task of task_types) {
      const label = document.createElement("label");
      label.className = "chk-item";
      label.innerHTML = `
        <input type="checkbox" data-filter-task="${task.id}" ${state.filters.tasks.has(task.id) ? "checked" : ""} />
        <span>${escapeHtml(task.short_label || task.label)}</span>
      `;
      els.filterTasks.appendChild(label);
    }

    els.filterMethods.innerHTML = "";
    for (const method of optimization_methods) {
      const label = document.createElement("label");
      label.className = "chk-item";
      label.innerHTML = `
        <input type="checkbox" data-filter-method="${method.id}" ${state.filters.methods.has(method.id) ? "checked" : ""} />
        <span>${escapeHtml(method.short_label || method.label)}</span>
      `;
      els.filterMethods.appendChild(label);
    }
  }

  function renderLegend() {
    els.familyLegend.innerHTML = "";
    for (const fam of state.data.taxonomies.base_families) {
      const span = document.createElement("span");
      span.className = "legend-item";
      span.innerHTML = `<span class="swatch" style="background:${fam.color}; margin-top:0;"></span><span>${escapeHtml(fam.label)}</span>`;
      els.familyLegend.appendChild(span);
    }
  }

  function getFilteredModels() {
    if (!state.data) return [];
    const q = state.filters.search.trim().toLowerCase();

    return state.data.models.filter((m) => {
      if (!state.filters.families.has(m.base_family)) return false;

      const hasMatchingTask = m.task_types.some((t) => state.filters.tasks.has(t));
      if (!hasMatchingTask) return false;

      const methodMatchesPrimary = state.filters.methods.has(m.optimization_method);
      const methodMatchesSecondary =
        state.filters.includeSecondary &&
        (m.optimization_methods_secondary || []).some((s) => state.filters.methods.has(s));
      if (!methodMatchesPrimary && !methodMatchesSecondary) return false;

      if (m.params_million === null || m.params_million === undefined) {
        if (!state.filters.includeNullParams) return false;
      } else if (m.params_million > state.filters.paramMax) {
        return false;
      }

      const year = Number(String(m.release_date).slice(0, 4));
      if (!Number.isNaN(year)) {
        if (year < state.filters.yearMin || year > state.filters.yearMax) return false;
      }

      if (q) {
        const hay = [
          m.name,
          m.id,
          m.base_model,
          m.venue,
          m.description,
          m.params_note,
          m.fps_device,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }

      return true;
    });
  }

  function getPrimaryTaskId(model) {
    for (const tid of TASK_PRIORITY_FOR_X) {
      if (model.task_types.includes(tid)) return tid;
    }
    return model.task_types[0];
  }

  function calcBubbleRadius(paramsMillion) {
    if (paramsMillion === null || paramsMillion === undefined) return 15;
    const minR = 11;
    const maxR = 32;
    const norm = Math.log10(Math.max(paramsMillion, 1) + 1) / Math.log10(900 + 1);
    return Math.round((minR + norm * (maxR - minR)) * 10) / 10;
  }

  function renderAll() {
    if (!state.data) return;
    const filtered = getFilteredModels();
    els.countPill.textContent = `${filtered.length} / ${state.data.models.length}`;

    renderBubbleChart(filtered);
    renderTable(filtered);
    renderTree(filtered);

    if (state.selectedModelId) {
      const found = state.data.models.find((m) => m.id === state.selectedModelId);
      if (found) {
        renderDetailPanel(found);
      }
    }
  }

  function renderBubbleChart(models) {
    const svg = els.bubbleSvg;
    const { task_types, optimization_methods } = state.data.taxonomies;
    const { familyMap, methodMap, taskMap } = getTaxonomyMaps();

    const cols = task_types.length;
    const rows = optimization_methods.length;
    const leftMargin = 205;
    const topMargin = 62;
    const rightMargin = 24;
    const bottomMargin = 24;
    const colW = 165;
    const rowH = 88;
    const width = leftMargin + cols * colW + rightMargin;
    const height = topMargin + rows * rowH + bottomMargin;

    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.innerHTML = "";

    const NS = "http://www.w3.org/2000/svg";
    const mk = (tag, attrs = {}) => {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) {
        el.setAttribute(k, String(v));
      }
      return el;
    };

    // Grid background cells + row/col headers
    const gridGroup = mk("g");
    optimization_methods.forEach((method, rIdx) => {
      const y = topMargin + (rows - 1 - rIdx) * rowH; // baseline at bottom, optimized at top
      task_types.forEach((task, cIdx) => {
        const x = leftMargin + cIdx * colW;
        if ((rIdx + cIdx) % 2 === 1) {
          gridGroup.appendChild(
            mk("rect", {
              x,
              y,
              width: colW,
              height: rowH,
              fill: "var(--grid-cell-alt)",
            })
          );
        }
        gridGroup.appendChild(
          mk("rect", {
            x,
            y,
            width: colW,
            height: rowH,
            fill: "none",
            stroke: "var(--grid-line)",
            "stroke-width": 1,
          })
        );
      });

      // Y-axis label
      const labelY = y + rowH / 2;
      const yText = mk("text", {
        x: leftMargin - 12,
        y: labelY - 4,
        "text-anchor": "end",
        class: "axis-header-title",
      });
      yText.textContent = method.short_label || method.label;
      gridGroup.appendChild(yText);

      const ySub = mk("text", {
        x: leftMargin - 12,
        y: labelY + 11,
        "text-anchor": "end",
        class: "axis-sub-title",
      });
      ySub.textContent = method.id;
      gridGroup.appendChild(ySub);
    });

    // X-axis headers
    task_types.forEach((task, cIdx) => {
      const cx = leftMargin + cIdx * colW + colW / 2;
      const xText = mk("text", {
        x: cx,
        y: 26,
        "text-anchor": "middle",
        class: "axis-header-title",
      });
      xText.textContent = task.short_label || task.label;
      gridGroup.appendChild(xText);

      const xSub = mk("text", {
        x: cx,
        y: 42,
        "text-anchor": "middle",
        class: "axis-sub-title",
      });
      xSub.textContent = task.id;
      gridGroup.appendChild(xSub);
    });

    svg.appendChild(gridGroup);

    // Group placements by cell to avoid overlap
    const placements = [];
    const cellMap = new Map();
    const rowIdxById = new Map(optimization_methods.map((m, i) => [m.id, i]));
    const colIdxById = new Map(task_types.map((t, i) => [t.id, i]));

    for (const model of models) {
      const primaryTask = getPrimaryTaskId(model);
      const taskList = state.expandMultitask ? model.task_types : [primaryTask];

      for (const tid of taskList) {
        if (state.expandMultitask && !state.filters.tasks.has(tid)) continue;
        const cIdx = colIdxById.get(tid);
        const rIdx = rowIdxById.get(model.optimization_method);
        if (cIdx === undefined || rIdx === undefined) continue;
        const key = `${cIdx}:${rIdx}`;
        if (!cellMap.has(key)) cellMap.set(key, []);
        const item = {
          model,
          tid,
          isPrimaryTask: tid === primaryTask,
          cIdx,
          rIdx,
        };
        cellMap.get(key).push(item);
        placements.push(item);
      }
    }

    // Compute (cx, cy) inside each cell
    const modelCoords = new Map();
    for (const [, items] of cellMap.entries()) {
      const n = items.length;
      const { cIdx, rIdx } = items[0];
      const cellX = leftMargin + cIdx * colW;
      const cellY = topMargin + (rows - 1 - rIdx) * rowH;

      items.forEach((item, idx) => {
        let ox = colW / 2;
        let oy = rowH / 2 - 4;
        if (n === 2) {
          ox = colW * (idx === 0 ? 0.31 : 0.69);
        } else if (n === 3) {
          const pts = [
            [0.25, 0.38],
            [0.75, 0.38],
            [0.5, 0.7],
          ];
          ox = colW * pts[idx][0];
          oy = rowH * pts[idx][1];
        } else if (n >= 4) {
          const colsInCell = Math.ceil(Math.sqrt(n));
          const rowsInCell = Math.ceil(n / colsInCell);
          const gc = idx % colsInCell;
          const gr = Math.floor(idx / colsInCell);
          ox = ((gc + 0.6) / (colsInCell + 0.2)) * colW;
          oy = ((gr + 0.5) / (rowsInCell + 0.15)) * (rowH - 10);
        }
        item.cx = cellX + ox;
        item.cy = cellY + oy;
        if (!modelCoords.has(item.model.id)) modelCoords.set(item.model.id, []);
        modelCoords.get(item.model.id).push(item);
      });
    }

    // Dashed connectors when multitask expanded
    if (state.expandMultitask) {
      const linkGroup = mk("g");
      for (const [, pts] of modelCoords.entries()) {
        if (pts.length < 2) continue;
        pts.sort((a, b) => a.cIdx - b.cIdx);
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const famColor = (familyMap.get(p1.model.base_family) || {}).color || "#94a3b8";
          linkGroup.appendChild(
            mk("line", {
              x1: p1.cx,
              y1: p1.cy,
              x2: p2.cx,
              y2: p2.cy,
              stroke: famColor,
              "stroke-width": 1.4,
              "stroke-dasharray": "4 3",
              "stroke-opacity": 0.55,
            })
          );
        }
      }
      svg.appendChild(linkGroup);
    }

    // Render bubbles
    const bubbleGroup = mk("g");
    for (const item of placements) {
      const { model, cx, cy, isPrimaryTask } = item;
      const fam = familyMap.get(model.base_family) || { color: "#94a3b8", label: model.base_family };
      const r = calcBubbleRadius(model.params_million) * (isPrimaryTask ? 1 : 0.78);
      const isNullParams = model.params_million === null || model.params_million === undefined;

      const node = mk("g", {
        class: `bubble-node ${state.selectedModelId === model.id ? "selected" : ""}`,
        transform: `translate(${cx}, ${cy})`,
        tabindex: "0",
        role: "button",
        "aria-label": model.name,
      });

      const circleAttrs = {
        r,
        fill: fam.color,
        "fill-opacity": isPrimaryTask ? (isNullParams ? 0.35 : 0.85) : 0.45,
        stroke: fam.color,
        "stroke-width": state.selectedModelId === model.id ? 3 : 1.8,
        class: "bubble-circle",
      };
      if (isNullParams || !isPrimaryTask) {
        circleAttrs["stroke-dasharray"] = "4 2";
      }
      node.appendChild(mk("circle", circleAttrs));

      const pText = mk("text", { x: 0, y: 0, class: "bubble-param-label" });
      pText.textContent = isNullParams ? "可変" : `${model.params_million}M`;
      node.appendChild(pText);

      const labelText = mk("text", {
        x: 0,
        y: r + 11,
        class: "bubble-label",
      });
      labelText.textContent = model.name;
      node.appendChild(labelText);

      node.addEventListener("mouseenter", (e) => showTooltip(e, model, taskMap, methodMap));
      node.addEventListener("mousemove", moveTooltip);
      node.addEventListener("mouseleave", hideTooltip);
      node.addEventListener("click", () => selectModel(model.id));
      node.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectModel(model.id);
        }
      });

      bubbleGroup.appendChild(node);
    }

    svg.appendChild(bubbleGroup);
  }

  function showTooltip(event, model, taskMap, methodMap) {
    const methodObj = methodMap.get(model.optimization_method);
    const taskLabels = model.task_types
      .map((t) => (taskMap.get(t) ? taskMap.get(t).short_label : t))
      .join(" / ");
    const paramStr =
      model.params_million === null || model.params_million === undefined
        ? "可変・未公表"
        : `${model.params_million}M`;

    els.tooltip.innerHTML = `
      <div class="tooltip-title">${escapeHtml(model.name)}</div>
      <div class="tooltip-row"><strong>主軽量化手法:</strong> ${escapeHtml(methodObj ? methodObj.label : model.optimization_method)}</div>
      <div class="tooltip-row"><strong>対応タスク:</strong> ${escapeHtml(taskLabels)}</div>
      <div class="tooltip-row"><strong>パラメータ数:</strong> ${escapeHtml(paramStr)}</div>
      <div class="tooltip-row"><strong>速度 / FPS:</strong> ${escapeHtml(model.fps_device)}</div>
      <div class="tooltip-row"><strong>発表:</strong> ${escapeHtml(model.venue)} (${escapeHtml(model.release_date)})</div>
    `;
    els.tooltip.classList.remove("hidden");
    moveTooltip(event);
  }

  function moveTooltip(event) {
    const pad = 14;
    const rect = els.tooltip.getBoundingClientRect();
    let x = event.clientX + pad;
    let y = event.clientY + pad;
    if (x + rect.width > window.innerWidth - 10) {
      x = event.clientX - rect.width - pad;
    }
    if (y + rect.height > window.innerHeight - 10) {
      y = event.clientY - rect.height - pad;
    }
    els.tooltip.style.left = `${x}px`;
    els.tooltip.style.top = `${y}px`;
  }

  function hideTooltip() {
    els.tooltip.classList.add("hidden");
  }

  function renderTable(models) {
    const { taskMap, methodMap, familyMap } = getTaxonomyMaps();
    const sorted = [...models].sort((a, b) => {
      const k = state.sortKey;
      let va = a[k];
      let vb = b[k];

      if (k === "params_million") {
        va = va === null || va === undefined ? Number.POSITIVE_INFINITY : va;
        vb = vb === null || vb === undefined ? Number.POSITIVE_INFINITY : vb;
        return state.sortDir === "asc" ? va - vb : vb - va;
      }

      if (Array.isArray(va)) va = va.join(",");
      if (Array.isArray(vb)) vb = vb.join(",");
      va = String(va ?? "");
      vb = String(vb ?? "");
      return state.sortDir === "asc" ? va.localeCompare(vb, "ja") : vb.localeCompare(va, "ja");
    });

    // Update sort indicators
    document.querySelectorAll("#models-table th").forEach((th) => {
      const ind = th.querySelector(".sort-ind");
      if (!ind) return;
      ind.textContent = th.dataset.sort === state.sortKey ? (state.sortDir === "asc" ? "▲" : "▼") : "";
    });

    els.tableBody.innerHTML = "";
    for (const m of sorted) {
      const tr = document.createElement("tr");
      if (m.id === state.selectedModelId) tr.classList.add("selected");

      const fam = familyMap.get(m.base_family);
      const method = methodMap.get(m.optimization_method);
      const tasksHtml = m.task_types
        .map((t) => `<span class="badge">${escapeHtml((taskMap.get(t) || {}).short_label || t)}</span>`)
        .join("");
      const secHtml = (m.optimization_methods_secondary || [])
        .map((s) => `<span class="badge">${escapeHtml((methodMap.get(s) || {}).short_label || s)}</span>`)
        .join("");

      tr.innerHTML = `
        <td><strong>${escapeHtml(m.name)}</strong></td>
        <td><span class="badge" style="border-color:${fam ? fam.color : "#94a3b8"}">${escapeHtml(fam ? fam.label : m.base_family)}</span></td>
        <td>${tasksHtml}</td>
        <td><span class="badge badge-primary">${escapeHtml(method ? method.short_label : m.optimization_method)}</span>${secHtml}</td>
        <td>${m.params_million === null || m.params_million === undefined ? "可変" : `${m.params_million}M`}</td>
        <td>${escapeHtml(m.fps_device)}</td>
        <td>${escapeHtml(m.venue)}</td>
        <td>${escapeHtml(m.release_date)}</td>
      `;
      tr.addEventListener("click", () => selectModel(m.id));
      els.tableBody.appendChild(tr);
    }
  }

  function sourceLinks(record) {
    return record.sources.filter((source) => /^https:\/\//i.test(source.url))
      .map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.label)}</a>`)
      .join(" · ");
  }

  function derivativeBranch(parentId, ancestors = []) {
    const items = (state.data.derivatives || []).filter((item) =>
      item.parent_ids.includes(parentId) && !ancestors.includes(item.id)
    );
    let lastGroup = "";
    return items.map((item) => {
      const groupHeading = item.group && item.group !== lastGroup
        ? `<h4>${escapeHtml(item.group)}</h4>` : "";
      lastGroup = item.group;
      const children = derivativeBranch(item.id, [...ancestors, item.id]);
      return `${groupHeading}<details class="derivative">
        <summary>${escapeHtml(item.name)}</summary>
        <div class="derivative-body">
          <small>${escapeHtml(item.kind)}</small>
          <p>${escapeHtml(item.description)}</p>
          <p><strong>重み</strong>　${escapeHtml(item.weights)}</p>
          <div>${sourceLinks(item)}</div>
          <small>確認日 ${escapeHtml(item.checked_on)}</small>
          ${children}
        </div>
      </details>`;
    }).join("");
  }

  function communitySection(modelId) {
    const entries = (state.data.communities || []).filter((entry) => entry.model_ids.includes(modelId));
    if (!entries.length) return "";
    return `<section class="detail-section lineage"><h3>コミュニティ</h3>${entries.map((entry) =>
      `<p>${escapeHtml(entry.description)}</p><small>確認日 ${escapeHtml(entry.checked_on)}</small>
       <div>${sourceLinks(entry)}</div>`
    ).join("")}</section>`;
  }

  function renderTree(models) {
    const { familyMap, methodMap } = getTaxonomyMaps();
    els.treeContainer.innerHTML = "";

    const byFamily = new Map();
    for (const fam of state.data.taxonomies.base_families) {
      byFamily.set(fam.id, []);
    }
    for (const m of models) {
      if (!byFamily.has(m.base_family)) byFamily.set(m.base_family, []);
      byFamily.get(m.base_family).push(m);
    }

    for (const [famId, famModels] of byFamily.entries()) {
      if (!famModels.length) continue;
      const fam = familyMap.get(famId) || { label: famId, color: "#94a3b8" };
      const card = document.createElement("div");
      card.className = "tree-family-card";
      card.innerHTML = `
        <div class="tree-family-header">
          <span class="swatch" style="background:${fam.color}; margin-top:0;"></span>
          <span>${escapeHtml(fam.label)} (${famModels.length})</span>
        </div>
      `;

      // Build parent-child relationships via base_model matching model name/prefix
      const nameToId = new Map();
      for (const m of famModels) {
        nameToId.set(m.name.toLowerCase(), m.id);
      }

      function findParentId(model) {
        const bm = (model.base_model || "").toLowerCase();
        if (!bm || bm.startsWith("なし")) return null;
        if (bm === "sam") {
          const samRoot = famModels.find((x) => x.id === "sam-vit-h");
          return samRoot && samRoot.id !== model.id ? samRoot.id : null;
        }
        if (bm === "sam 2") {
          const sam2Root = famModels.find((x) => x.id === "sam2-hiera-b-plus");
          return sam2Root && sam2Root.id !== model.id ? sam2Root.id : null;
        }
        if (bm === "sam 2.1") {
          const sam21 = famModels.find((x) => x.id === "sam2-1-hiera-b-plus");
          if (sam21 && sam21.id !== model.id) return sam21.id;
          const sam2Root = famModels.find((x) => x.id === "sam2-hiera-b-plus");
          return sam2Root && sam2Root.id !== model.id ? sam2Root.id : null;
        }
        if (bm === "sam 3") {
          const sam3 = famModels.find((x) => x.id === "sam3");
          return sam3 && sam3.id !== model.id ? sam3.id : null;
        }
        for (const candidate of famModels) {
          if (candidate.id === model.id) continue;
          if (
            candidate.name.toLowerCase() === bm ||
            candidate.name.toLowerCase().startsWith(bm + " ")
          ) {
            return candidate.id;
          }
        }
        return null;
      }

      const childrenMap = new Map();
      const roots = [];
      for (const m of famModels) {
        const pid = findParentId(m);
        if (pid) {
          if (!childrenMap.has(pid)) childrenMap.set(pid, []);
          childrenMap.get(pid).push(m);
        } else {
          roots.push(m);
        }
      }

      function buildList(list) {
        const ul = document.createElement("ul");
        ul.className = "tree-list";
        for (const m of list) {
          const li = document.createElement("li");
          li.className = "tree-node-wrap";
          const method = methodMap.get(m.optimization_method);
          const paramStr = m.params_million === null ? "可変" : `${m.params_million}M`;
          const btn = document.createElement("button");
          btn.className = `tree-node-btn ${state.selectedModelId === m.id ? "selected" : ""}`;
          btn.innerHTML = `
            <div class="tree-node-top">
              <span>${escapeHtml(m.name)}</span>
              <span class="badge">${escapeHtml(paramStr)}</span>
            </div>
            <div class="tree-node-meta">${escapeHtml(method ? method.short_label : m.optimization_method)} | ${escapeHtml(m.venue)} (${escapeHtml(m.release_date)})</div>
          `;
          btn.addEventListener("click", () => selectModel(m.id));
          li.appendChild(btn);
          const branch = derivativeBranch(m.id);
          if (branch) {
            li.insertAdjacentHTML("beforeend", `<details class="lineage tree-derivatives">
              <summary>派生・関連実装</summary>${branch}</details>`);
          }

          const kids = childrenMap.get(m.id);
          if (kids && kids.length) {
            const subUl = buildList(kids);
            subUl.className = "tree-children";
            li.appendChild(subUl);
          }
          ul.appendChild(li);
        }
        return ul;
      }

      card.appendChild(buildList(roots));
      els.treeContainer.appendChild(card);
    }
  }

  function selectModel(modelId) {
    state.selectedModelId = modelId;
    const model = state.data.models.find((m) => m.id === modelId);
    if (model) {
      renderDetailPanel(model);
      renderAll();
    }
  }

  function renderDetailPanel(model) {
    const { taskMap, methodMap, familyMap } = getTaxonomyMaps();
    const fam = familyMap.get(model.base_family);
    const primaryMethod = methodMap.get(model.optimization_method);

    const branch = derivativeBranch(model.id);
    const taskBadges = model.task_types
      .map((t) => `<span class="badge">${escapeHtml((taskMap.get(t) || {}).label || t)}</span>`)
      .join("");

    const secBadges = (model.optimization_methods_secondary || []).length
      ? model.optimization_methods_secondary
          .map((s) => `<span class="badge">${escapeHtml((methodMap.get(s) || {}).label || s)}</span>`)
          .join("")
      : '<span style="color: var(--text-muted);">なし</span>';

    const links = [];
    if (model.github_url) {
      links.push(`<a class="link-btn" href="${escapeHtml(model.github_url)}" target="_blank" rel="noopener noreferrer">GitHub リポジトリ</a>`);
    }
    if (model.paper_url) {
      links.push(`<a class="link-btn" href="${escapeHtml(model.paper_url)}" target="_blank" rel="noopener noreferrer">論文 (arXiv)</a>`);
    }

    els.detailEmpty.classList.add("hidden");
    els.detailContent.classList.remove("hidden");
    els.detailContent.innerHTML = `
      <div class="detail-header">
        <div><span class="badge" style="border-color:${fam ? fam.color : "#94a3b8"}">${escapeHtml(fam ? fam.label : model.base_family)}</span></div>
        <h2 class="detail-title">${escapeHtml(model.name)}</h2>
        <div style="font-size:11px; color:var(--text-muted);">ID: <code>${escapeHtml(model.id)}</code></div>
      </div>

      ${branch ? `<section class="detail-section lineage"><h3>派生・関連実装</h3>${branch}</section>` : ""}
      ${communitySection(model.id)}
      <div class="detail-section">
        <div class="detail-section-label">技術メカニズム</div>
        <div>${escapeHtml(model.description)}</div>
      </div>

      <div class="detail-section">
        <div class="detail-section-label">分類（定義ドキュメント準拠）</div>
        <div class="detail-kv">
          <div class="detail-k">対応タスク</div>
          <div class="detail-v">${taskBadges}</div>
          <div class="detail-k">主軽量化手法</div>
          <div class="detail-v"><span class="badge badge-primary">${escapeHtml(primaryMethod ? primaryMethod.label : model.optimization_method)}</span></div>
          <div class="detail-k">副軽量化手法</div>
          <div class="detail-v">${secBadges}</div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-label">諸元・計測値</div>
        <div class="detail-kv">
          <div class="detail-k">パラメータ数</div>
          <div class="detail-v">${model.params_million === null ? "可変・未公表" : `${model.params_million}M`}</div>
          <div class="detail-k">構成内訳</div>
          <div class="detail-v">${escapeHtml(model.params_note)}</div>
          <div class="detail-k">推論速度 / FPS</div>
          <div class="detail-v">${escapeHtml(model.fps_device)}</div>
          <div class="detail-k">派生元モデル</div>
          <div class="detail-v">${escapeHtml(model.base_model)}</div>
          <div class="detail-k">発表学会</div>
          <div class="detail-v">${escapeHtml(model.venue)}</div>
          <div class="detail-k">公開年月</div>
          <div class="detail-v">${escapeHtml(model.release_date)}</div>
        </div>
      </div>

      <div class="detail-section">
        <div class="detail-section-label">一次情報リンク</div>
        <div class="detail-links">${links.length ? links.join("") : '<span style="color:var(--text-muted)">公開リンクなし</span>'}</div>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function bindEvents() {
    // View switcher
    document.querySelectorAll(".view-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const view = btn.dataset.view;
        state.activeView = view;
        document.querySelectorAll(".view-btn").forEach((b) => {
          const active = b.dataset.view === view;
          b.classList.toggle("active", active);
          b.setAttribute("aria-selected", String(active));
        });
        document.querySelectorAll(".view-panel").forEach((p) => {
          p.classList.toggle("active", p.id === `view-${view}`);
        });
      });
    });

    // Search
    els.searchInput.addEventListener("input", () => {
      state.filters.search = els.searchInput.value;
      renderAll();
    });

    // Dynamic checkboxes delegation
    els.filterFamilies.addEventListener("change", (e) => {
      const id = e.target.dataset.filterFamily;
      if (!id) return;
      if (e.target.checked) state.filters.families.add(id);
      else state.filters.families.delete(id);
      renderAll();
    });

    els.filterTasks.addEventListener("change", (e) => {
      const id = e.target.dataset.filterTask;
      if (!id) return;
      if (e.target.checked) state.filters.tasks.add(id);
      else state.filters.tasks.delete(id);
      renderAll();
    });

    els.filterMethods.addEventListener("change", (e) => {
      const id = e.target.dataset.filterMethod;
      if (!id) return;
      if (e.target.checked) state.filters.methods.add(id);
      else state.filters.methods.delete(id);
      renderAll();
    });

    els.chkIncludeSecondary.addEventListener("change", () => {
      state.filters.includeSecondary = els.chkIncludeSecondary.checked;
      renderAll();
    });

    els.paramMaxRange.addEventListener("input", () => {
      state.filters.paramMax = Number(els.paramMaxRange.value);
      els.paramMaxLabel.textContent = `${state.filters.paramMax}M`;
      renderAll();
    });

    els.chkIncludeNullParams.addEventListener("change", () => {
      state.filters.includeNullParams = els.chkIncludeNullParams.checked;
      renderAll();
    });

    const syncYearRange = () => {
      let y1 = Number(els.yearMinRange.value);
      let y2 = Number(els.yearMaxRange.value);
      if (y1 > y2) {
        [y1, y2] = [y2, y1];
      }
      state.filters.yearMin = y1;
      state.filters.yearMax = y2;
      els.yearRangeLabel.textContent = `${y1} - ${y2}`;
      renderAll();
    };
    els.yearMinRange.addEventListener("input", syncYearRange);
    els.yearMaxRange.addEventListener("input", syncYearRange);

    els.chkExpandMultitask.addEventListener("change", () => {
      state.expandMultitask = els.chkExpandMultitask.checked;
      renderAll();
    });

    // Reset group buttons
    document.querySelectorAll("[data-reset-group]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (!state.data) return;
        const g = btn.dataset.resetGroup;
        if (g === "family") {
          state.filters.families = new Set(state.data.taxonomies.base_families.map((x) => x.id));
        } else if (g === "task") {
          state.filters.tasks = new Set(state.data.taxonomies.task_types.map((x) => x.id));
        } else if (g === "method") {
          state.filters.methods = new Set(state.data.taxonomies.optimization_methods.map((x) => x.id));
        }
        renderFilterCheckboxes();
        renderAll();
      });
    });

    // Reset all
    document.getElementById("btn-reset-all").addEventListener("click", () => {
      if (!state.data) return;
      els.searchInput.value = "";
      state.filters.search = "";
      els.chkIncludeSecondary.checked = false;
      state.filters.includeSecondary = false;
      els.chkIncludeNullParams.checked = true;
      state.filters.includeNullParams = true;
      initializeWithData(state.data);
    });

    // Table sorting
    document.querySelectorAll("#models-table th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
        } else {
          state.sortKey = key;
          state.sortDir = key === "release_date" ? "desc" : "asc";
        }
        renderTable(getFilteredModels());
      });
    });

    // Reload JSON
    document.getElementById("btn-reload-data").addEventListener("click", loadDefaultData);

    // Local JSON picker fallback
    els.jsonFileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          clearError();
          initializeWithData(parsed);
        } catch (err) {
          showError(`選択されたJSONの解析に失敗しました: ${err.message}`);
        }
      };
      reader.readAsText(file, "utf-8");
    });

    // Theme toggle
    document.getElementById("btn-theme-toggle").addEventListener("click", () => {
      const html = document.documentElement;
      html.dataset.theme = html.dataset.theme === "dark" ? "light" : "dark";
    });

    // Definition modal
    document.getElementById("btn-open-defs").addEventListener("click", async () => {
      els.defsModal.classList.remove("hidden");
      els.defsModalBody.textContent = "読み込み中...";
      const path = (state.data && state.data.metadata && state.data.metadata.definition_doc) || "docs/classification-definitions.md";
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const md = await res.text();
        const pre = document.createElement("pre");
        pre.textContent = md;
        els.defsModalBody.innerHTML = "";
        els.defsModalBody.appendChild(pre);
      } catch (err) {
        els.defsModalBody.textContent = `定義ドキュメント (${path}) を読み込めませんでした: ${err.message}`;
      }
    });

    document.getElementById("btn-close-defs").addEventListener("click", () => {
      els.defsModal.classList.add("hidden");
    });

    els.defsModal.addEventListener("click", (e) => {
      if (e.target === els.defsModal) els.defsModal.classList.add("hidden");
    });
  }

  bindEvents();
  loadDefaultData();
})();
