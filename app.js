(function startApp() {
  "use strict";

  const Parser = window.BRParser;
  const LEARNING_KEY = "br-fieldsort-corrections-v2";
  const TARGET_FIELDS = ["deviceType", "floor", "direction", "location", "description"];
  const state = {
    file: null,
    headers: [],
    rows: [],
    delimiter: ",",
    indexes: {},
    records: [],
    selected: new Set(),
    filter: "all",
    query: "",
    fillMode: "smart",
    learning: loadLearning()
  };

  const elements = {
    importView: document.querySelector("#importView"),
    workspaceView: document.querySelector("#workspaceView"),
    dropZone: document.querySelector("#dropZone"),
    fileInput: document.querySelector("#fileInput"),
    browseBtn: document.querySelector("#browseBtn"),
    newFileBtn: document.querySelector("#newFileBtn"),
    exportBtn: document.querySelector("#exportBtn"),
    fileSummary: document.querySelector("#fileSummary"),
    rowCount: document.querySelector("#rowCount"),
    columnCount: document.querySelector("#columnCount"),
    readyCount: document.querySelector("#readyCount"),
    reviewCount: document.querySelector("#reviewCount"),
    editCount: document.querySelector("#editCount"),
    learnedCount: document.querySelector("#learnedCount"),
    allFilterCount: document.querySelector("#allFilterCount"),
    reviewFilterCount: document.querySelector("#reviewFilterCount"),
    editedFilterCount: document.querySelector("#editedFilterCount"),
    csvGrid: document.querySelector("#csvGrid"),
    gridHead: document.querySelector("#gridHead"),
    reviewBody: document.querySelector("#reviewBody"),
    emptyResults: document.querySelector("#emptyResults"),
    visibleSummary: document.querySelector("#visibleSummary"),
    searchInput: document.querySelector("#searchInput"),
    showOptionsBtn: document.querySelector("#showOptionsBtn"),
    optionsPanel: document.querySelector("#optionsPanel"),
    fillMode: document.querySelector("#fillMode"),
    learnToggle: document.querySelector("#learnToggle"),
    clearLearningBtn: document.querySelector("#clearLearningBtn"),
    selectionCount: document.querySelector("#selectionCount"),
    clearSelectionBtn: document.querySelector("#clearSelectionBtn"),
    bulkColumn: document.querySelector("#bulkColumn"),
    bulkValue: document.querySelector("#bulkValue"),
    bulkMode: document.querySelector("#bulkMode"),
    applyBulkBtn: document.querySelector("#applyBulkBtn"),
    resetSelectedBtn: document.querySelector("#resetSelectedBtn"),
    toast: document.querySelector("#toast")
  };

  let toastTimer = null;

  function loadLearning() {
    try {
      const value = JSON.parse(localStorage.getItem(LEARNING_KEY) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function saveLearning() {
    try {
      localStorage.setItem(LEARNING_KEY, JSON.stringify(state.learning));
    } catch {
      showToast("The browser could not save this correction.", true);
    }
  }

  function showToast(message, isError) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle("is-error", Boolean(isError));
    elements.toast.classList.add("is-visible");
    toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 3400);
  }

  function learningKey(deviceType, areaSuite) {
    return `${String(deviceType || "").trim().toUpperCase()}||${Parser.normalizeForParsing(areaSuite).toUpperCase()}`;
  }

  function excelColumnName(index) {
    let value = index + 1;
    let result = "";
    while (value > 0) {
      value -= 1;
      result = String.fromCharCode(65 + (value % 26)) + result;
      value = Math.floor(value / 26);
    }
    return result;
  }

  function ensureTargetColumns(parsed) {
    const headers = parsed.headers.slice();
    const rows = parsed.rows.map((row) => {
      const copy = row.slice();
      while (copy.length < headers.length) copy.push("");
      return copy;
    });
    const aliases = {
      floor: ["Floor"],
      direction: ["Direction"],
      location: ["Location"],
      description: ["Description"],
      areaSuite: ["AreaSuite", "Area/Suite", "Area Suite"],
      deviceType: ["DeviceType", "Device Type"]
    };
    const indexes = {};
    for (const [key, names] of Object.entries(aliases)) indexes[key] = Parser.findColumn(headers, names);
    if (indexes.areaSuite < 0) {
      throw new Error("AreaSuite column not found. Choose a BuildingReports CSV that includes AreaSuite.");
    }
    for (const key of TARGET_FIELDS) {
      if (indexes[key] >= 0) continue;
      indexes[key] = headers.length;
      headers.push(key.charAt(0).toUpperCase() + key.slice(1));
      rows.forEach((row) => row.push(""));
    }
    return { headers, rows, indexes };
  }

  function normalizeExisting(value, field) {
    const text = String(value || "");
    if (!text || !["direction", "location"].includes(field)) return text;
    const letters = text.replace(/[^A-Za-z]/g, "");
    if (!letters || letters !== letters.toUpperCase()) return text;
    return Parser.titleCaseField(Parser.cleanupSpelling(text));
  }

  function inferenceScore(source, inferred) {
    if (!String(source || "").trim()) return 0;
    let score = 0;
    if (inferred.floor) score += 10;
    if (inferred.direction) score += 3;
    if (inferred.location) {
      score += Math.min(Parser.normalizeForParsing(inferred.location).split(/\s+/).filter(Boolean).length, 7);
    }
    if (inferred.classification) score += 2;
    if (/\b(?:ROOM|RM|DOOR|BUILDING|BLDG|CORRIDOR|STAIR|LOBBY|OFFICE|WAREHOUSE)\b/i.test(source)) score += 3;
    return score;
  }

  function outputValues(record, mode) {
    const current = {};
    for (const field of TARGET_FIELDS) current[field] = normalizeExisting(record.original[field], field);
    const inferred = record.inferred;
    if (mode === "empty") {
      return {
        deviceType: current.deviceType,
        floor: current.floor || (inferred.floorSource === "context" ? "" : inferred.floor),
        direction: current.direction || inferred.direction,
        location: current.location || inferred.location,
        description: current.description
      };
    }
    if (mode === "replace") {
      return {
        deviceType: inferred.deviceType || current.deviceType,
        floor: inferred.floor || current.floor,
        direction: inferred.direction || current.direction,
        location: inferred.location || current.location,
        description: inferred.description || current.description
      };
    }
    return {
      deviceType: inferred.deviceType || current.deviceType,
      floor: current.floor || inferred.floor,
      direction: current.direction || inferred.direction,
      location: current.location || inferred.location,
      description: inferred.description || current.description
    };
  }

  function buildRecords() {
    state.records = state.rows.map((row, index) => {
      const areaSuite = row[state.indexes.areaSuite] || "";
      const deviceType = state.indexes.deviceType >= 0 ? row[state.indexes.deviceType] || "" : "";
      const originalDescription = row[state.indexes.description] || "";
      const cleanedDescription = Parser.cleanDescription(originalDescription);
      const areaInference = Parser.inferFields(areaSuite, deviceType);
      const descriptionInference = Parser.inferFields(cleanedDescription, deviceType);
      const descriptionIsBetter =
        inferenceScore(cleanedDescription, descriptionInference) > inferenceScore(areaSuite, areaInference) + 2;
      const parseSource = descriptionIsBetter ? cleanedDescription : areaSuite;
      const inferred = descriptionIsBetter ? descriptionInference : areaInference;
      inferred.deviceType = Parser.inferDeviceType(`${areaSuite} ${cleanedDescription}`, deviceType);
      inferred.description = cleanedDescription;
      const learnedId = learningKey(deviceType, `${areaSuite}||${cleanedDescription}`);
      const learned = state.learning[learnedId];
      if (learned) {
        for (const field of TARGET_FIELDS) {
          if (learned[field] != null) inferred[field] = learned[field];
        }
        inferred.confidence = 100;
        inferred.level = "high";
        inferred.reasons = ["learned from your correction"];
      }
      const original = {
        deviceType,
        floor: row[state.indexes.floor] || "",
        direction: row[state.indexes.direction] || "",
        location: row[state.indexes.location] || "",
        description: originalDescription,
        areaSuite
      };
      const record = {
        index,
        deviceType: inferred.deviceType || deviceType,
        areaSuite,
        parseSource,
        originalRow: row.slice(),
        original,
        inferred,
        values: null,
        edits: new Map(),
        manualColumns: new Set(),
        learned: Boolean(learned),
        learningId: learnedId
      };
      record.values = outputValues(record, state.fillMode);
      return record;
    });

    Parser.applyContext(state.records);
    state.records.forEach((record) => {
      if (!record.original.floor && state.fillMode !== "empty") record.values.floor = record.inferred.floor;
    });
  }

  function fieldForColumn(columnIndex) {
    return TARGET_FIELDS.find((field) => state.indexes[field] === columnIndex) || "";
  }

  function getCellValue(record, columnIndex) {
    if (columnIndex === state.indexes.areaSuite) return record.original.areaSuite;
    const field = fieldForColumn(columnIndex);
    if (field) return record.values[field];
    if (record.edits.has(columnIndex)) return record.edits.get(columnIndex);
    return record.originalRow[columnIndex] || "";
  }

  function setCellValue(record, columnIndex, value, options) {
    if (columnIndex === state.indexes.areaSuite) return false;
    const settings = { manual: true, propagate: false, ...(options || {}) };
    const field = fieldForColumn(columnIndex);
    if (field) record.values[field] = value;
    else record.edits.set(columnIndex, value);
    if (settings.manual) record.manualColumns.add(columnIndex);
    if (settings.propagate && field) updateDuplicateRows(record, field, value);
    return true;
  }

  function needsReview(record) {
    if (!record.parseSource) return false;
    if (record.values.floor && (record.values.location || record.values.direction || record.inferred.classification)) {
      return false;
    }
    if (!record.values.floor && !record.values.location && !record.values.direction) return true;
    if (record.inferred.level === "low") return true;
    const hasUnresolvedFloorCue = !record.values.floor &&
      /\b(?:FLOOR|FLOO|FOOLR|FLR|LEVEL|PENT\s*HOUSE|MEZZ|ROOF|BASEMENT|LOWER\s+LEVEL|LL)\b/i.test(record.parseSource);
    return hasUnresolvedFloorCue;
  }

  async function importFile(file) {
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") {
      showToast("Please choose a CSV file.", true);
      return;
    }
    try {
      const parsed = Parser.parseCsv(await file.text());
      const prepared = ensureTargetColumns(parsed);
      state.file = file;
      state.headers = prepared.headers;
      state.rows = prepared.rows;
      state.indexes = prepared.indexes;
      state.delimiter = parsed.delimiter;
      state.filter = "all";
      state.query = "";
      state.selected.clear();
      elements.searchInput.value = "";
      document.querySelectorAll(".filter-button").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.filter === "all");
      });
      buildRecords();
      populateBulkColumns();
      renderWorkspace();
      elements.importView.hidden = true;
      elements.workspaceView.hidden = false;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      showToast(error.message || "This file could not be read.", true);
    } finally {
      elements.fileInput.value = "";
    }
  }

  function updateStats() {
    const review = state.records.filter(needsReview).length;
    const ready = state.records.length - review;
    const edited = state.records.filter((record) => record.manualColumns.size).length;
    elements.rowCount.textContent = state.records.length.toLocaleString();
    elements.columnCount.textContent = `${state.headers.length} columns shown`;
    elements.readyCount.textContent = ready.toLocaleString();
    elements.reviewCount.textContent = review.toLocaleString();
    elements.editCount.textContent = edited.toLocaleString();
    elements.learnedCount.textContent = `${Object.keys(state.learning).length.toLocaleString()} learned corrections`;
    elements.allFilterCount.textContent = state.records.length.toLocaleString();
    elements.reviewFilterCount.textContent = review.toLocaleString();
    elements.editedFilterCount.textContent = edited.toLocaleString();
    updateSelectionSummary();
  }

  function getFilteredRecords() {
    const query = state.query.toLowerCase();
    return state.records.filter((record) => {
      if (state.filter === "review" && !needsReview(record)) return false;
      if (state.filter === "edited" && !record.manualColumns.size) return false;
      if (!query) return true;
      return state.headers.some((header, columnIndex) =>
        String(getCellValue(record, columnIndex)).toLowerCase().includes(query)
      );
    });
  }

  function columnWidth(header) {
    const normalized = Parser.normalizeHeader(header);
    if (normalized === "areasuite") return 330;
    if (["description", "location", "note"].includes(normalized)) return 220;
    if (["direction", "devicetype", "manufacturer", "modelnumber"].includes(normalized)) return 155;
    if (["scannumber", "serialnumber", "controlpanel", "manufacturedate", "installdate"].includes(normalized)) return 145;
    return 112;
  }

  function renderHead() {
    elements.gridHead.textContent = "";
    const row = document.createElement("tr");
    const selector = document.createElement("th");
    selector.className = "sheet-selector-head sticky-select";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "selectVisible";
    checkbox.setAttribute("aria-label", "Select all visible rows");
    selector.appendChild(checkbox);

    const corner = document.createElement("th");
    corner.className = "sheet-row-head sticky-row-number";
    corner.textContent = "#";
    row.append(selector, corner);

    state.headers.forEach((header, columnIndex) => {
      const th = document.createElement("th");
      th.className = "sheet-column-head";
      if (columnIndex === state.indexes.areaSuite) th.classList.add("locked-column-head");
      const width = columnWidth(header);
      th.style.width = `${width}px`;
      th.style.minWidth = `${width}px`;

      const letter = document.createElement("span");
      letter.className = "column-letter";
      letter.textContent = excelColumnName(columnIndex);
      const name = document.createElement("span");
      name.className = "column-name";
      name.textContent = header;
      if (columnIndex === state.indexes.areaSuite) {
        const lock = document.createElement("small");
        lock.textContent = "Locked";
        name.appendChild(lock);
      }
      th.append(letter, name);
      row.appendChild(th);
    });
    elements.gridHead.appendChild(row);
    checkbox.addEventListener("change", () => {
      const visible = getFilteredRecords();
      visible.forEach((record) => {
        if (checkbox.checked) state.selected.add(record.index);
        else state.selected.delete(record.index);
      });
      renderTable();
    });
  }

  function createCell(record, columnIndex) {
    const td = document.createElement("td");
    const width = columnWidth(state.headers[columnIndex]);
    td.style.width = `${width}px`;
    td.style.minWidth = `${width}px`;
    if (columnIndex === state.indexes.areaSuite) td.classList.add("locked-cell");
    if (record.manualColumns.has(columnIndex)) td.classList.add("modified-cell");
    const field = fieldForColumn(columnIndex);
    if (field && !record.manualColumns.has(columnIndex) && record.values[field] !== record.original[field]) {
      td.classList.add("suggested-cell");
    }

    const input = document.createElement("input");
    input.className = "sheet-input";
    input.type = "text";
    input.value = getCellValue(record, columnIndex);
    input.dataset.index = record.index;
    input.dataset.column = columnIndex;
    input.setAttribute("aria-label", `${state.headers[columnIndex]} for row ${record.index + 1}`);
    if (columnIndex === state.indexes.areaSuite) {
      input.readOnly = true;
      input.title = "Locked source value";
    }
    td.appendChild(input);
    return td;
  }

  function renderTable() {
    const records = getFilteredRecords();
    const fragment = document.createDocumentFragment();
    renderHead();
    elements.reviewBody.textContent = "";

    records.forEach((record) => {
      const tr = document.createElement("tr");
      tr.dataset.index = record.index;
      if (record.manualColumns.size) tr.classList.add("is-edited");
      if (needsReview(record)) tr.classList.add("needs-review");

      const selectCell = document.createElement("td");
      selectCell.className = "sheet-selector-cell sticky-select";
      const select = document.createElement("input");
      select.type = "checkbox";
      select.className = "row-selector";
      select.checked = state.selected.has(record.index);
      select.dataset.index = record.index;
      select.setAttribute("aria-label", `Select row ${record.index + 1}`);
      selectCell.appendChild(select);

      const rowNumber = document.createElement("td");
      rowNumber.className = "sheet-row-number sticky-row-number";
      rowNumber.textContent = record.index + 1;
      rowNumber.title = needsReview(record)
        ? `Needs review · ${record.inferred.reasons.join(", ")}`
        : `Ready · ${record.inferred.reasons.join(", ")}`;
      tr.append(selectCell, rowNumber);
      state.headers.forEach((header, columnIndex) => tr.appendChild(createCell(record, columnIndex)));
      fragment.appendChild(tr);
    });

    elements.reviewBody.appendChild(fragment);
    elements.emptyResults.hidden = records.length > 0;
    elements.visibleSummary.textContent = `Showing ${records.length.toLocaleString()} of ${state.records.length.toLocaleString()} rows · ${state.headers.length} CSV columns`;
    updateSelectVisible();
    updateSelectionSummary();
  }

  function renderWorkspace() {
    elements.fileSummary.textContent = `${state.file.name} · ${state.records.length.toLocaleString()} device records · all ${state.headers.length} columns visible`;
    updateStats();
    renderTable();
  }

  function updateDuplicateRows(sourceRecord, field, value) {
    const key = sourceRecord.learningId;
    const columnIndex = state.indexes[field];
    let changed = 0;
    state.records.forEach((record) => {
      if (record.index === sourceRecord.index) return;
      if (record.learningId !== key) return;
      record.values[field] = value;
      record.manualColumns.add(columnIndex);
      changed += 1;
    });
    return changed;
  }

  function commitLearning(record) {
    if (!elements.learnToggle.checked) return;
    const touchedTarget = TARGET_FIELDS.some((field) => record.manualColumns.has(state.indexes[field]));
    if (!touchedTarget) return;
    state.learning[record.learningId] = { ...record.values };
    saveLearning();
  }

  function handleTableInput(event) {
    const input = event.target.closest(".sheet-input");
    if (!input || input.readOnly) return;
    const record = state.records[Number(input.dataset.index)];
    const columnIndex = Number(input.dataset.column);
    setCellValue(record, columnIndex, input.value);
    input.closest("td").classList.add("modified-cell");
    input.closest("tr").classList.add("is-edited");
  }

  function handleTableChange(event) {
    const input = event.target.closest(".sheet-input");
    if (!input || input.readOnly) return;
    const record = state.records[Number(input.dataset.index)];
    const columnIndex = Number(input.dataset.column);
    const field = fieldForColumn(columnIndex);
    const duplicates = field ? updateDuplicateRows(record, field, input.value) : 0;
    commitLearning(record);
    updateStats();
    if (state.filter === "edited" || duplicates) renderTable();
  }

  function handlePaste(event) {
    const input = event.target.closest(".sheet-input");
    if (!input || input.readOnly) return;
    const text = event.clipboardData && event.clipboardData.getData("text/plain");
    if (!text || (!text.includes("\t") && !/[\r\n]/.test(text.trim()))) return;
    event.preventDefault();

    const matrix = text.replace(/\r/g, "").split("\n");
    if (matrix[matrix.length - 1] === "") matrix.pop();
    const visible = getFilteredRecords();
    const startRecord = visible.findIndex((record) => record.index === Number(input.dataset.index));
    const startColumn = Number(input.dataset.column);
    let changed = 0;

    matrix.forEach((line, rowOffset) => {
      const record = visible[startRecord + rowOffset];
      if (!record) return;
      line.split("\t").forEach((value, columnOffset) => {
        const columnIndex = startColumn + columnOffset;
        if (columnIndex >= state.headers.length || columnIndex === state.indexes.areaSuite) return;
        if (setCellValue(record, columnIndex, value)) changed += 1;
      });
      commitLearning(record);
    });
    renderWorkspace();
    showToast(`Pasted ${changed.toLocaleString()} cells from the clipboard.`);
  }

  function applyFillMode(mode) {
    state.fillMode = mode;
    state.records.forEach((record) => {
      const next = outputValues(record, mode);
      for (const field of TARGET_FIELDS) {
        if (!record.manualColumns.has(state.indexes[field])) record.values[field] = next[field];
      }
    });
    renderWorkspace();
    showToast("Cleanup mode updated. Manual edits were kept.");
  }

  function populateBulkColumns() {
    elements.bulkColumn.textContent = "";
    state.headers.forEach((header, columnIndex) => {
      if (columnIndex === state.indexes.areaSuite) return;
      const option = document.createElement("option");
      option.value = columnIndex;
      option.textContent = `${excelColumnName(columnIndex)} · ${header}`;
      if (columnIndex === state.indexes.floor) option.selected = true;
      elements.bulkColumn.appendChild(option);
    });
  }

  function applyBulkEdit() {
    if (!state.selected.size) {
      showToast("Select one or more rows first.", true);
      return;
    }
    const columnIndex = Number(elements.bulkColumn.value);
    const value = elements.bulkValue.value;
    let changed = 0;
    state.selected.forEach((recordIndex) => {
      const record = state.records[recordIndex];
      if (!record) return;
      if (elements.bulkMode.value === "empty" && getCellValue(record, columnIndex)) return;
      if (setCellValue(record, columnIndex, value)) {
        changed += 1;
        commitLearning(record);
      }
    });
    renderWorkspace();
    showToast(`Updated ${changed.toLocaleString()} selected cells.`);
  }

  function resetSelectedRows() {
    if (!state.selected.size) {
      showToast("Select one or more rows first.", true);
      return;
    }
    state.selected.forEach((recordIndex) => {
      const record = state.records[recordIndex];
      if (!record) return;
      delete state.learning[record.learningId];
      record.edits.clear();
      record.manualColumns.clear();
      record.learned = false;
      record.values = outputValues(record, state.fillMode);
      if (!record.original.floor && state.fillMode !== "empty") record.values.floor = record.inferred.floor;
    });
    saveLearning();
    renderWorkspace();
    showToast("Selected rows were reset to their automatic suggestions.");
  }

  function updateSelectionSummary() {
    const count = state.selected.size;
    elements.selectionCount.textContent = `${count.toLocaleString()} ${count === 1 ? "row" : "rows"} selected`;
    elements.clearSelectionBtn.disabled = count === 0;
    elements.applyBulkBtn.disabled = count === 0;
    elements.resetSelectedBtn.disabled = count === 0;
  }

  function updateSelectVisible() {
    const checkbox = document.querySelector("#selectVisible");
    if (!checkbox) return;
    const visible = getFilteredRecords();
    const selectedVisible = visible.filter((record) => state.selected.has(record.index)).length;
    checkbox.checked = visible.length > 0 && selectedVisible === visible.length;
    checkbox.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
  }

  function exportCsv() {
    try {
      const outputRows = state.records.map((record) =>
        state.headers.map((header, columnIndex) => getCellValue(record, columnIndex))
      );
      const sourceStillLocked = outputRows.every((row, index) =>
        row[state.indexes.areaSuite] === state.rows[index][state.indexes.areaSuite]
      );
      if (!sourceStillLocked || outputRows.length !== state.rows.length) {
        throw new Error("Source validation failed. No file was exported.");
      }
      const csv = Parser.stringifyCsv(state.headers, outputRows, state.delimiter);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${state.file.name.replace(/\.csv$/i, "")}_cleaned.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(`Exported ${outputRows.length.toLocaleString()} rows and ${state.headers.length} columns. AreaSuite verified unchanged.`);
    } catch (error) {
      showToast(error.message || "The cleaned file could not be exported.", true);
    }
  }

  function resetApp() {
    elements.workspaceView.hidden = true;
    elements.importView.hidden = false;
    state.file = null;
    state.headers = [];
    state.rows = [];
    state.records = [];
    state.selected.clear();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  elements.browseBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    elements.fileInput.click();
  });
  elements.dropZone.addEventListener("click", () => elements.fileInput.click());
  elements.dropZone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      elements.fileInput.click();
    }
  });
  elements.fileInput.addEventListener("change", () => importFile(elements.fileInput.files[0]));
  ["dragenter", "dragover"].forEach((name) => {
    elements.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("is-dragging");
    });
  });
  ["dragleave", "drop"].forEach((name) => {
    elements.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove("is-dragging");
    });
  });
  elements.dropZone.addEventListener("drop", (event) => importFile(event.dataTransfer.files[0]));
  elements.newFileBtn.addEventListener("click", resetApp);
  elements.exportBtn.addEventListener("click", exportCsv);
  elements.reviewBody.addEventListener("input", handleTableInput);
  elements.reviewBody.addEventListener("change", handleTableChange);
  elements.reviewBody.addEventListener("paste", handlePaste);
  elements.reviewBody.addEventListener("change", (event) => {
    const selector = event.target.closest(".row-selector");
    if (!selector) return;
    const index = Number(selector.dataset.index);
    if (selector.checked) state.selected.add(index);
    else state.selected.delete(index);
    updateSelectVisible();
    updateSelectionSummary();
  });
  elements.searchInput.addEventListener("input", () => {
    state.query = elements.searchInput.value.trim();
    renderTable();
  });
  document.querySelectorAll(".filter-button").forEach((button) => {
    button.addEventListener("click", () => {
      state.filter = button.dataset.filter;
      document.querySelectorAll(".filter-button").forEach((item) => item.classList.toggle("is-active", item === button));
      renderTable();
    });
  });
  elements.showOptionsBtn.addEventListener("click", () => {
    elements.optionsPanel.hidden = !elements.optionsPanel.hidden;
    elements.showOptionsBtn.textContent = elements.optionsPanel.hidden ? "Cleanup options" : "Hide options";
  });
  elements.fillMode.addEventListener("change", () => applyFillMode(elements.fillMode.value));
  elements.clearLearningBtn.addEventListener("click", () => {
    state.learning = {};
    localStorage.removeItem(LEARNING_KEY);
    state.records.forEach((record) => { record.learned = false; });
    updateStats();
    showToast("Learned corrections cleared. Current edits were kept.");
  });
  elements.clearSelectionBtn.addEventListener("click", () => {
    state.selected.clear();
    renderTable();
  });
  elements.applyBulkBtn.addEventListener("click", applyBulkEdit);
  elements.bulkValue.addEventListener("keydown", (event) => {
    if (event.key === "Enter") applyBulkEdit();
  });
  elements.resetSelectedBtn.addEventListener("click", resetSelectedRows);
})();
