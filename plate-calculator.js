const defaultCompounds = [
  { id: "bzatp", name: "BzATP", stock: 50000, working: 5000, color: "#c6e0b4" },
  { id: "cabozantinib", name: "Cabozantinib", stock: 20000, working: 200, color: "#bdd7ee" },
  { id: "axitinib", name: "Axitinib", stock: 20000, working: 50, color: "#f8cbad" },
  { id: "hei3090", name: "HEI3090", stock: 20000, working: 10, color: "#d9d2e9" },
];

const treatment = (...components) => ({ type: "treatment", components });
const dose = (compoundId, final) => ({ compoundId, final });

const defaultConditions = [
  { type: "medium", components: [] }, { type: "medium", components: [] }, treatment(dose("bzatp", 200)), treatment(dose("bzatp", 200)),
  treatment(dose("cabozantinib", 4)), treatment(dose("cabozantinib", 8)), treatment(dose("cabozantinib", 12)), treatment(dose("cabozantinib", 16)),
  treatment(dose("cabozantinib", 4), dose("bzatp", 200)), treatment(dose("cabozantinib", 8), dose("bzatp", 200)), treatment(dose("cabozantinib", 12), dose("bzatp", 200)), treatment(dose("cabozantinib", 16), dose("bzatp", 200)),
  treatment(dose("axitinib", 1)), treatment(dose("axitinib", 2)), treatment(dose("axitinib", 3)), treatment(dose("axitinib", 4)),
  treatment(dose("axitinib", 1), dose("bzatp", 200)), treatment(dose("axitinib", 2), dose("bzatp", 200)), treatment(dose("axitinib", 3), dose("bzatp", 200)), treatment(dose("axitinib", 4), dose("bzatp", 200)),
  treatment(dose("hei3090", 0.1)), treatment(dose("bzatp", 30)), treatment(dose("bzatp", 100)), treatment(dose("bzatp", 200)),
  treatment(dose("hei3090", 0.1)), treatment(dose("bzatp", 30), dose("hei3090", 0.1)), treatment(dose("bzatp", 100), dose("hei3090", 0.1)), treatment(dose("bzatp", 200), dose("hei3090", 0.1)),
  { type: "medium", components: [] }, { type: "medium", components: [] }, { type: "medium", components: [] }, { type: "blank", components: [] },
];

let compounds = clone(defaultCompounds);
let conditions = clone(defaultConditions);
let editingConditionIndex = null;
let lastConditionResults = [];
let lastPreparationResults = [];

const element = (id) => document.getElementById(id);

window.addEventListener("DOMContentLoaded", () => {
  bindControls();
  renderCompoundRows();
  renderConditionSelects();
  recalculate();
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function bindControls() {
  ["well-volume", "plate-count", "replicate-count", "plate-overage"].forEach((id) => element(id).addEventListener("input", recalculate));
  element("compound-body").addEventListener("input", handleCompoundInput);
  element("compound-body").addEventListener("click", handleCompoundClick);
  element("add-compound").addEventListener("click", addCompound);
  element("plate-plan-grid").addEventListener("click", (event) => {
    const card = event.target.closest("[data-condition-index]");
    if (card) openConditionEditor(Number(card.dataset.conditionIndex));
  });
  element("condition-type").addEventListener("change", updateConditionEditor);
  ["condition-compound-1", "condition-compound-2", "condition-final-1", "condition-final-2"].forEach((id) => element(id).addEventListener("input", updateConditionPreview));
  element("save-condition").addEventListener("click", saveCondition);
  element("reset-plate").addEventListener("click", resetExample);
  element("download-plate-csv").addEventListener("click", downloadPlateCsv);
  element("download-prep-csv").addEventListener("click", downloadPreparationCsv);
  element("print-plate").addEventListener("click", () => window.print());
}

function settings() {
  return {
    wellVolume: finiteInput("well-volume"),
    plates: integerInput("plate-count"),
    replicates: integerInput("replicate-count"),
    overage: finiteInput("plate-overage"),
  };
}

function finiteInput(id) {
  const value = Number(element(id).value);
  return Number.isFinite(value) ? value : 0;
}

function integerInput(id) {
  return Math.trunc(finiteInput(id));
}

function handleCompoundInput(event) {
  const input = event.target.closest("[data-compound-id][data-field]");
  if (!input) return;
  const compound = compounds.find((item) => item.id === input.dataset.compoundId);
  if (!compound) return;
  compound[input.dataset.field] = input.dataset.field === "name" || input.dataset.field === "color" ? input.value : Number(input.value);
  renderConditionSelects();
  recalculate();
}

function handleCompoundClick(event) {
  const button = event.target.closest("[data-remove-compound]");
  if (!button) return;
  const id = button.dataset.removeCompound;
  if (conditions.some((condition) => condition.components.some((component) => component.compoundId === id))) {
    setStatus("COMPOUND IS STILL USED IN THE PLATE PLAN", true);
    return;
  }
  compounds = compounds.filter((compound) => compound.id !== id);
  renderCompoundRows();
  renderConditionSelects();
  recalculate();
}

function addCompound() {
  const nextNumber = compounds.length + 1;
  compounds.push({ id: `compound-${Date.now()}`, name: `Compound ${nextNumber}`, stock: 10000, working: 100, color: "#d7e3df" });
  renderCompoundRows();
  renderConditionSelects();
  recalculate();
}

function renderCompoundRows() {
  element("compound-body").innerHTML = compounds.map((compound) => `
    <tr>
      <td><input aria-label="${escapeHtml(compound.name)} color" data-compound-id="${compound.id}" data-field="color" type="color" value="${compound.color}"></td>
      <td><input aria-label="Compound name" data-compound-id="${compound.id}" data-field="name" type="text" value="${escapeHtml(compound.name)}"></td>
      <td><input aria-label="${escapeHtml(compound.name)} stock concentration" data-compound-id="${compound.id}" data-field="stock" type="number" min="0" step="any" value="${compound.stock}"></td>
      <td><input aria-label="${escapeHtml(compound.name)} working concentration" data-compound-id="${compound.id}" data-field="working" type="number" min="0" step="any" value="${compound.working}"></td>
      <td><button type="button" data-remove-compound="${compound.id}">Remove</button></td>
    </tr>`).join("");
}

function renderConditionSelects() {
  const currentOne = element("condition-compound-1").value;
  const currentTwo = element("condition-compound-2").value;
  const options = compounds.map((compound) => `<option value="${compound.id}">${escapeHtml(compound.name)}</option>`).join("");
  element("condition-compound-1").innerHTML = options;
  element("condition-compound-2").innerHTML = `<option value="">None</option>${options}`;
  if (compounds.some((compound) => compound.id === currentOne)) element("condition-compound-1").value = currentOne;
  if (compounds.some((compound) => compound.id === currentTwo)) element("condition-compound-2").value = currentTwo;
}

function calculateCondition(condition, wellVolume) {
  if (condition.type !== "treatment") return { type: condition.type, additions: [], totalAddition: 0, finalVolume: wellVolume, error: "" };
  const components = condition.components.filter((component) => component.compoundId && Number(component.final) > 0);
  if (!components.length) return { type: condition.type, additions: [], totalAddition: 0, finalVolume: wellVolume, error: "Treatment has no positive final concentration." };
  if (new Set(components.map((component) => component.compoundId)).size !== components.length) return { type: condition.type, additions: [], totalAddition: 0, finalVolume: wellVolume, error: "The same compound is selected twice." };

  const prepared = [];
  for (const component of components) {
    const compound = compounds.find((item) => item.id === component.compoundId);
    if (!compound) return { type: condition.type, additions: [], totalAddition: 0, finalVolume: wellVolume, error: "A selected compound no longer exists." };
    if (!(compound.working > 0)) return { type: condition.type, additions: [], totalAddition: 0, finalVolume: wellVolume, error: `${compound.name}: working concentration must be above zero.` };
    prepared.push({ compound, final: Number(component.final), ratio: Number(component.final) / compound.working });
  }

  const ratioSum = prepared.reduce((sum, item) => sum + item.ratio, 0);
  const denominator = 1 - ratioSum;
  if (!(wellVolume > 0)) return { type: condition.type, additions: [], totalAddition: 0, finalVolume: wellVolume, error: "Medium volume in the well must be above zero." };
  if (!(denominator > 0)) return { type: condition.type, additions: [], totalAddition: 0, finalVolume: wellVolume, error: "Combined final concentrations must be below their working concentrations." };

  const additions = prepared.map((item) => ({ ...item, volume: item.ratio * wellVolume / denominator }));
  const totalAddition = additions.reduce((sum, item) => sum + item.volume, 0);
  return { type: condition.type, additions, totalAddition, finalVolume: wellVolume + totalAddition, error: "" };
}

function recalculate() {
  const config = settings();
  lastConditionResults = conditions.map((condition) => calculateCondition(condition, config.wellVolume));
  lastPreparationResults = calculatePreparation(lastConditionResults, config);
  renderPlate(config);
  renderPreparation(config);
  renderErrors(config);
  renderSummary(config);
  element("hero-replicates").textContent = config.replicates;
  element("hero-plates").textContent = config.plates;
}

function calculatePreparation(results, config) {
  return compounds.map((compound) => {
    const volumePerPlate = results.reduce((sum, result) => sum + result.additions.filter((addition) => addition.compound.id === compound.id).reduce((inner, addition) => inner + addition.volume, 0), 0);
    const needed = volumePerPlate * config.replicates * config.plates * (1 + config.overage / 100);
    const prepare = needed > 0 ? Math.max(100, Math.ceil((needed - 1e-9) / 50) * 50) : 0;
    const stockVolume = compound.stock > 0 ? compound.working * prepare / compound.stock : NaN;
    const mediumVolume = prepare - stockVolume;
    let assessment = "Not used";
    let level = "ok";
    if (needed > 0 && (!(compound.stock > 0) || compound.working > compound.stock || mediumVolume < -1e-9)) {
      assessment = "Working concentration exceeds stock";
      level = "warning";
    } else if (needed > 0 && stockVolume < 0.5) {
      assessment = "Intermediate dilution required";
      level = "warning";
    } else if (needed > 0 && stockVolume < 1) {
      assessment = "Intermediate dilution recommended";
      level = "caution";
    } else if (needed > 0) {
      assessment = "Can prepare directly";
    }
    return { compound, volumePerPlate, needed, prepare, stockVolume, mediumVolume, assessment, level };
  });
}

function renderPlate(config) {
  const rows = "ABCDEFGH";
  element("plate-plan-grid").innerHTML = [...rows].map((row, rowIndex) => {
    const cards = [0, 1, 2, 3].map((blockIndex) => {
      const index = rowIndex * 4 + blockIndex;
      return renderConditionCard(index, row, blockIndex, conditions[index], lastConditionResults[index], config.replicates);
    }).join("");
    return `<div class="plate-plan-row"><div class="plate-row-label">${row}</div>${cards}</div>`;
  }).join("");
}

function renderConditionCard(index, row, blockIndex, condition, result, replicates) {
  const firstColumn = blockIndex * 3 + 1;
  const usedColumns = Array.from({ length: Math.min(Math.max(replicates, 0), 3) }, (_, offset) => firstColumn + offset);
  const wellLabel = usedColumns.length ? `${row}${usedColumns[0]}${usedColumns.length > 1 ? `–${row}${usedColumns.at(-1)}` : ""}` : "No wells";
  const title = conditionTitle(condition);
  const volumes = result.additions.map((addition) => `<span>${escapeHtml(addition.compound.name)}: ${formatNumber(addition.volume, 2)} µL</span>`).join("");
  const colors = result.additions.map((addition) => addition.compound.color);
  const background = condition.type === "treatment" && colors.length ? conditionBackground(colors) : "";
  const classes = ["condition-card", condition.type, result.error ? "invalid" : ""].filter(Boolean).join(" ");
  return `<button type="button" class="${classes}" data-condition-index="${index}" style="${background ? `background:${background}` : ""}"><span class="well-range">${wellLabel} · EDIT ↗</span><strong>${escapeHtml(title)}</strong><span class="condition-volumes">${result.error ? escapeHtml(result.error) : volumes}</span></button>`;
}

function conditionTitle(condition) {
  if (condition.type === "medium") return "Medium";
  if (condition.type === "blank") return "Blank";
  return condition.components.filter((component) => component.compoundId && Number(component.final) > 0).map((component) => {
    const compound = compounds.find((item) => item.id === component.compoundId);
    return `${compound?.name || "Unknown"} ${formatConcentration(Number(component.final))}`;
  }).join(" + ") || "Empty treatment";
}

function conditionBackground(colors) {
  if (colors.length === 1) return colors[0];
  return `linear-gradient(135deg,${colors[0]} 0%,${colors[0]} 48%,${colors[1]} 52%,${colors[1]} 100%)`;
}

function renderPreparation() {
  const active = lastPreparationResults.filter((row) => row.needed > 0);
  element("working-body").innerHTML = active.map((row) => `
    <tr>
      <td><span style="display:inline-block;width:9px;height:9px;background:${row.compound.color};margin-right:8px"></span>${escapeHtml(row.compound.name)}</td>
      <td>${formatNumber(row.compound.working, 4)}</td>
      <td>${formatNumber(row.needed, 2)}</td>
      <td>${formatNumber(row.prepare, 2)}</td>
      <td>${formatNumber(row.stockVolume, 3)}</td>
      <td>${formatNumber(row.mediumVolume, 3)}</td>
      <td class="prep-${row.level}">${escapeHtml(row.assessment)}</td>
    </tr>`).join("") || `<tr><td colspan="7">No compounds are currently used.</td></tr>`;
}

function renderErrors(config) {
  const messages = [];
  if (!(config.wellVolume > 0)) messages.push("Medium volume in each well must be above zero.");
  if (!(config.plates >= 1)) messages.push("Number of plates must be at least 1.");
  if (!(config.replicates >= 1 && config.replicates <= 3)) messages.push("Replicates must be between 1 and 3 for each three-well block.");
  if (!(config.overage >= 0)) messages.push("Extra volume cannot be negative.");
  lastConditionResults.forEach((result, index) => {
    if (result.error) messages.push(`${conditionPosition(index)}: ${result.error}`);
  });
  lastPreparationResults.filter((row) => row.level === "warning").forEach((row) => messages.push(`${row.compound.name}: ${row.assessment}.`));
  element("plate-errors").innerHTML = messages.map((message) => `<div class="plate-error">${escapeHtml(message)}</div>`).join("");
  setStatus(messages.length ? `${messages.length} CHECK${messages.length === 1 ? "" : "S"} NEED ATTENTION` : "CALCULATIONS UPDATED", messages.length > 0);
}

function renderSummary(config) {
  const active = lastPreparationResults.filter((row) => row.needed > 0).length;
  const treatments = conditions.filter((condition) => condition.type === "treatment").length;
  element("active-compounds").textContent = active;
  element("treatment-count").textContent = treatments;
  element("planned-wells").textContent = 32 * Math.max(config.replicates, 0) * Math.max(config.plates, 0);
}

function openConditionEditor(index) {
  editingConditionIndex = index;
  const condition = conditions[index];
  element("condition-dialog-title").textContent = conditionPosition(index);
  element("condition-type").value = condition.type;
  const [first, second] = condition.components;
  element("condition-compound-1").value = first?.compoundId || compounds[0]?.id || "";
  element("condition-final-1").value = first?.final ?? "";
  element("condition-compound-2").value = second?.compoundId || "";
  element("condition-final-2").value = second?.final ?? "";
  updateConditionEditor();
  element("condition-dialog").showModal();
}

function updateConditionEditor() {
  const treatmentMode = element("condition-type").value === "treatment";
  element("treatment-editor").hidden = !treatmentMode;
  updateConditionPreview();
}

function editorCondition() {
  const type = element("condition-type").value;
  if (type !== "treatment") return { type, components: [] };
  const components = [];
  const firstId = element("condition-compound-1").value;
  const firstFinal = Number(element("condition-final-1").value);
  const secondId = element("condition-compound-2").value;
  const secondFinal = Number(element("condition-final-2").value);
  if (firstId && firstFinal > 0) components.push({ compoundId: firstId, final: firstFinal });
  if (secondId && secondFinal > 0) components.push({ compoundId: secondId, final: secondFinal });
  return { type, components };
}

function updateConditionPreview() {
  const condition = editorCondition();
  const result = calculateCondition(condition, settings().wellVolume);
  const lines = [`<strong>${escapeHtml(conditionTitle(condition))}</strong>`];
  if (result.error) lines.push(`<span class="prep-warning">${escapeHtml(result.error)}</span>`);
  else result.additions.forEach((addition) => lines.push(`<span>${escapeHtml(addition.compound.name)}: add ${formatNumber(addition.volume, 2)} µL per well</span>`));
  if (!result.error && result.additions.length) lines.push(`<span>Final well volume: ${formatNumber(result.finalVolume, 2)} µL</span>`);
  element("condition-preview").innerHTML = lines.join("<br>");
}

function saveCondition(event) {
  event.preventDefault();
  if (editingConditionIndex === null) return;
  const condition = editorCondition();
  const result = calculateCondition(condition, settings().wellVolume);
  if (condition.type === "treatment" && result.error) {
    element("condition-preview").innerHTML += `<br><span class="prep-warning">Fix this condition before saving.</span>`;
    return;
  }
  conditions[editingConditionIndex] = condition;
  element("condition-dialog").close();
  recalculate();
}

function resetExample() {
  compounds = clone(defaultCompounds);
  conditions = clone(defaultConditions);
  element("well-volume").value = 100;
  element("plate-count").value = 2;
  element("replicate-count").value = 3;
  element("plate-overage").value = 15;
  renderCompoundRows();
  renderConditionSelects();
  recalculate();
}

function conditionPosition(index) {
  const row = "ABCDEFGH"[Math.floor(index / 4)];
  const block = index % 4;
  const first = block * 3 + 1;
  return `${row}${first}–${row}${first + 2}`;
}

function formatConcentration(value) {
  if (value > 0 && value < 1) return `${formatNumber(value * 1000, 3)} nM`;
  return `${formatNumber(value, 4)} µM`;
}

function formatNumber(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function setStatus(message, error = false) {
  const status = element("plate-status");
  status.textContent = message;
  status.classList.toggle("error", error);
}

function downloadPlateCsv() {
  const config = settings();
  const rows = [["Plate", "Well", "Condition", "Compound 1", "Final 1 [uM]", "Add 1 [uL]", "Compound 2", "Final 2 [uM]", "Add 2 [uL]", "Medium already in well [uL]", "Final volume [uL]"]];
  for (let plate = 1; plate <= config.plates; plate += 1) {
    conditions.forEach((condition, index) => {
      const row = "ABCDEFGH"[Math.floor(index / 4)];
      const block = index % 4;
      const result = lastConditionResults[index];
      for (let replicate = 0; replicate < Math.min(config.replicates, 3); replicate += 1) {
        const well = `${row}${block * 3 + replicate + 1}`;
        rows.push([plate, well, conditionTitle(condition), result.additions[0]?.compound.name || "", result.additions[0]?.final ?? "", result.additions[0]?.volume ?? "", result.additions[1]?.compound.name || "", result.additions[1]?.final ?? "", result.additions[1]?.volume ?? "", config.wellVolume, result.finalVolume]);
      }
    });
  }
  downloadCsv("plate-dilution-plan.csv", rows);
}

function downloadPreparationCsv() {
  const rows = [["Compound", "Stock [uM]", "Working [uM]", "Needed + extra [uL]", "Prepare [uL]", "Take stock [uL]", "Add medium [uL]", "Assessment"]];
  lastPreparationResults.filter((row) => row.needed > 0).forEach((row) => rows.push([row.compound.name, row.compound.stock, row.compound.working, row.needed, row.prepare, row.stockVolume, row.mediumVolume, row.assessment]));
  downloadCsv("working-solution-preparation.csv", rows);
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}
