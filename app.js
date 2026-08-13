const structures = [
  { id: "1IGT", name: "Immunoglobulin G", source: "assets/pdb/1IGT.pdb" },
  { id: "6U9V", name: "P2X7 receptor", source: "assets/pdb/6U9V.pdb" },
  { id: "1TUP", name: "p53 DNA-binding domain", source: "assets/pdb/1TUP.pdb" },
  { id: "3MXF", name: "BRD4 bromodomain", source: "assets/pdb/3MXF.pdb" },
  { id: "1TIM", name: "Triosephosphate isomerase", source: "assets/pdb/1TIM.pdb" },
];

const svgNamespace = "http://www.w3.org/2000/svg";
let lastCtbResults = [];
let lastDoseResults = [];

window.addEventListener("DOMContentLoaded", () => {
  [initCtbGraphBuilder, initDoseCalculator, initMoleculeViewer].forEach((initialize) => {
    try {
      initialize();
    } catch (error) {
      console.error(`${initialize.name} failed`, error);
    }
  });
});

function initMoleculeViewer() {
  const mount = document.getElementById("molecule-viewer");
  const status = document.getElementById("viewer-status");
  const spinButton = document.getElementById("toggle-spin");
  const resetButton = document.getElementById("reset-view");
  const structureButtons = [...document.querySelectorAll("[data-structure]")];
  let spinning = true;
  let requestNumber = 0;

  if (!mount || !status || !spinButton || !resetButton || !window.$3Dmol) {
    if (status) status.textContent = "VIEWER UNAVAILABLE";
    return;
  }

  const viewer = window.$3Dmol.createViewer(mount, { backgroundColor: "#071014", antialias: true });

  async function loadStructure(index) {
    const structure = structures[index];
    const currentRequest = ++requestNumber;
    status.textContent = `LOADING ${structure.id}`;
    structureButtons.forEach((button, buttonIndex) => button.classList.toggle("active", buttonIndex === index));

    try {
      const response = await fetch(structure.source);
      if (!response.ok) throw new Error("PDB request failed");
      const pdb = await response.text();
      if (currentRequest !== requestNumber) return;
      viewer.removeAllModels();
      viewer.addModel(pdb, "pdb");
      viewer.setStyle({}, { cartoon: { color: "spectrum", thickness: 0.42 } });
      viewer.zoomTo();
      viewer.zoom(1.05);
      viewer.render();
      viewer.spin(spinning ? "y" : false, 0.32);
      mount.setAttribute("aria-label", `Interactive 3D structure: ${structure.name}`);
      status.textContent = `${structure.id} \u00b7 ${structure.name} \u00b7 READY`;
    } catch {
      if (currentRequest === requestNumber) status.textContent = "STRUCTURE UNAVAILABLE";
    }
  }

  structureButtons.forEach((button) => button.addEventListener("click", () => loadStructure(Number(button.dataset.structure))));
  spinButton.addEventListener("click", () => {
    spinning = !spinning;
    viewer.spin(spinning ? "y" : false, 0.32);
    spinButton.textContent = spinning ? "PAUSE" : "AUTOROTATE";
  });
  resetButton.addEventListener("click", () => { viewer.zoomTo(); viewer.zoom(1.05); viewer.render(); });
  window.addEventListener("resize", () => viewer.resize());
  loadStructure(Math.floor(Math.random() * structures.length));
}

function initCtbGraphBuilder() {
  const buildButton = document.getElementById("build-ctb-chart");
  const csvButton = document.getElementById("download-ctb-csv");
  const svgButton = document.getElementById("download-ctb-svg");
  if (!buildButton || !csvButton || !svgButton) return;

  buildButton.addEventListener("click", buildCtbChart);
  csvButton.addEventListener("click", downloadCtbCsv);
  svgButton.addEventListener("click", downloadCtbSvg);
  buildCtbChart();
}

function parsePlateData(text) {
  const lines = text.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const grouped = new Map();

  lines.forEach((line, lineIndex) => {
    const cells = line.split(/[\t,;]/).map((cell) => cell.trim());
    const dose = Number(cells[0]);
    if (!Number.isFinite(dose)) {
      if (lineIndex === 0) return;
      throw new Error(`Dose is not numeric on row ${lineIndex + 1}.`);
    }
    if (dose < 0) throw new Error(`Dose cannot be negative on row ${lineIndex + 1}.`);
    const replicates = cells.slice(1).filter((cell) => cell !== "").map(Number).filter(Number.isFinite);
    if (!replicates.length) throw new Error(`No numeric RFU values on row ${lineIndex + 1}.`);
    grouped.set(dose, [...(grouped.get(dose) || []), ...replicates]);
  });

  if (grouped.size < 2) throw new Error("Add at least two dose rows.");
  return [...grouped.entries()].map(([dose, replicates]) => ({ dose, replicates })).sort((a, b) => a.dose - b.dose);
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleSd(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / (values.length - 1));
}

function buildCtbChart() {
  const status = document.getElementById("ctb-chart-status");
  const body = document.getElementById("ctb-results-body");
  const chart = document.getElementById("ctb-chart");
  const csvButton = document.getElementById("download-ctb-csv");
  const svgButton = document.getElementById("download-ctb-svg");
  status.classList.remove("error");

  try {
    const blank = numberFromInput("ctb-blank", "Blank RFU", { min: 0 });
    const controlDose = numberFromInput("ctb-control-dose", "Control dose");
    const parsed = parsePlateData(document.getElementById("ctb-data").value);
    const control = parsed.find((row) => approximatelyEqual(row.dose, controlDose));
    if (!control) throw new Error(`Control dose ${controlDose} µM is not present in the data.`);

    const controlCorrectedMean = mean(control.replicates.map((value) => value - blank));
    if (controlCorrectedMean <= 0) throw new Error("Corrected control mean must be greater than zero. Check blank RFU.");

    lastCtbResults = parsed.map((row) => {
      const rawMean = mean(row.replicates);
      const corrected = row.replicates.map((value) => value - blank);
      const correctedMean = mean(corrected);
      return {
        dose: row.dose,
        n: row.replicates.length,
        rawMean,
        correctedMean,
        viability: correctedMean / controlCorrectedMean * 100,
        viabilitySd: sampleSd(corrected) / controlCorrectedMean * 100,
        isControl: approximatelyEqual(row.dose, controlDose),
      };
    });

    renderCtbChart(chart, lastCtbResults);
    body.replaceChildren(...lastCtbResults.map((row) => tableRow([
      formatNumber(row.dose, 4),
      row.n,
      formatNumber(row.rawMean, 1),
      formatNumber(row.correctedMean, 1),
      formatNumber(row.viability, 1),
      formatNumber(row.viabilitySd, 1),
    ], row.isControl ? "control-row" : "")));

    const measurementCount = parsed.reduce((sum, row) => sum + row.replicates.length, 0);
    status.textContent = `${parsed.length} doses \u00b7 ${measurementCount} measurements \u00b7 control normalized to 100%`;
    csvButton.disabled = false;
    svgButton.disabled = false;
  } catch (error) {
    lastCtbResults = [];
    body.replaceChildren();
    chart.replaceChildren(svgText(410, 235, error.message, "chart-label", "middle"));
    status.textContent = error.message;
    status.classList.add("error");
    csvButton.disabled = true;
    svgButton.disabled = true;
  }
}

function renderCtbChart(chart, rows) {
  chart.replaceChildren();
  const width = 820;
  const height = 470;
  const margin = { top: 38, right: 30, bottom: 88, left: 72 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const lowerValue = Math.min(...rows.map((row) => row.viability - row.viabilitySd));
  const upperValue = Math.max(...rows.map((row) => row.viability + row.viabilitySd));
  const yMin = lowerValue < 0 ? Math.floor(lowerValue / 20) * 20 : 0;
  const yMax = Math.max(120, Math.ceil(upperValue / 20) * 20);
  const positiveDoses = rows.map((row) => row.dose).filter((dose) => dose > 0);
  const minLog = positiveDoses.length ? Math.log10(Math.min(...positiveDoses)) : 0;
  const maxLog = positiveDoses.length ? Math.log10(Math.max(...positiveDoses)) : 0;
  const hasNonPositive = rows.some((row) => row.dose <= 0);
  const positiveStart = margin.left + (hasNonPositive ? 64 : 0);
  const positiveWidth = width - margin.right - positiveStart;

  const xForDose = (dose) => {
    if (dose <= 0) return margin.left;
    if (minLog === maxLog) return positiveStart + positiveWidth / 2;
    return positiveStart + ((Math.log10(dose) - minLog) / (maxLog - minLog)) * positiveWidth;
  };
  const yForValue = (value) => margin.top + ((yMax - value) / (yMax - yMin)) * plotHeight;

  for (let index = 0; index <= 5; index += 1) {
    const value = yMin + ((yMax - yMin) / 5) * index;
    const y = yForValue(value);
    chart.append(svgLine(margin.left, y, width - margin.right, y, "chart-grid"));
    chart.append(svgText(margin.left - 10, y + 4, formatNumber(value, 0), "chart-label", "end"));
  }

  chart.append(svgLine(margin.left, margin.top, margin.left, height - margin.bottom, "chart-axis"));
  chart.append(svgLine(margin.left, height - margin.bottom, width - margin.right, height - margin.bottom, "chart-axis"));
  chart.append(svgText(margin.left, 22, "CTB DOSE–RESPONSE · MEAN ± SD", "chart-title", "start"));
  chart.append(svgText(width / 2, height - 18, "Final drug concentration [µM] · logarithmic scale", "chart-label", "middle"));
  const yTitle = svgText(18, height / 2, "Viability [% of vehicle control]", "chart-label", "middle");
  yTitle.setAttribute("transform", `rotate(-90 18 ${height / 2})`);
  chart.append(yTitle);

  const points = rows.map((row) => `${xForDose(row.dose)},${yForValue(row.viability)}`).join(" ");
  const polyline = document.createElementNS(svgNamespace, "polyline");
  polyline.setAttribute("points", points);
  polyline.setAttribute("class", "chart-line");
  chart.append(polyline);

  rows.forEach((row) => {
    const x = xForDose(row.dose);
    const y = yForValue(row.viability);
    const errorTop = yForValue(Math.min(yMax, row.viability + row.viabilitySd));
    const errorBottom = yForValue(Math.max(yMin, row.viability - row.viabilitySd));
    chart.append(svgLine(x, errorTop, x, errorBottom, "chart-error"));
    chart.append(svgLine(x - 5, errorTop, x + 5, errorTop, "chart-error"));
    chart.append(svgLine(x - 5, errorBottom, x + 5, errorBottom, "chart-error"));
    const circle = document.createElementNS(svgNamespace, "circle");
    circle.setAttribute("cx", x);
    circle.setAttribute("cy", y);
    circle.setAttribute("r", row.isControl ? 6 : 5);
    circle.setAttribute("class", "chart-point");
    const title = document.createElementNS(svgNamespace, "title");
    title.textContent = `${row.isControl ? "Control" : `${formatNumber(row.dose, 4)} µM`}: ${formatNumber(row.viability, 1)} ± ${formatNumber(row.viabilitySd, 1)}%`;
    circle.append(title);
    chart.append(circle);

    const label = svgText(x, height - margin.bottom + 22, row.isControl ? "CTRL" : formatNumber(row.dose, 4), "chart-label", "end");
    label.setAttribute("transform", `rotate(-38 ${x} ${height - margin.bottom + 22})`);
    chart.append(label);
  });
}

function downloadCtbCsv() {
  if (!lastCtbResults.length) return;
  const header = "Dose_uM,n,Mean_RFU,Blank_corrected_RFU,Viability_percent,SD_percent";
  const rows = lastCtbResults.map((row) => [row.dose, row.n, row.rawMean, row.correctedMean, row.viability, row.viabilitySd].join(","));
  downloadBlob("ctb-normalized-results.csv", [header, ...rows].join("\n"), "text/csv;charset=utf-8");
}

function downloadCtbSvg() {
  const chart = document.getElementById("ctb-chart");
  if (!chart || !lastCtbResults.length) return;
  const clone = chart.cloneNode(true);
  clone.setAttribute("xmlns", svgNamespace);
  const source = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  downloadBlob("ctb-dose-response.svg", source, "image/svg+xml;charset=utf-8");
}

function initDoseCalculator() {
  const calculateButton = document.getElementById("calculate-doses");
  const downloadButton = document.getElementById("download-dose-csv");
  if (!calculateButton || !downloadButton) return;
  calculateButton.addEventListener("click", calculateDoses);
  downloadButton.addEventListener("click", downloadDoseCsv);
  calculateDoses();
}

function calculateDoses() {
  const summary = document.getElementById("dose-summary");
  const warningsBox = document.getElementById("dose-warnings");
  const body = document.getElementById("dose-results-body");
  const downloadButton = document.getElementById("download-dose-csv");
  body.replaceChildren();
  warningsBox.replaceChildren();

  try {
    const drugName = document.getElementById("dose-drug-name").value.trim() || "Compound";
    const stockMm = numberFromInput("dose-stock", "Stock concentration", { minExclusive: 0 });
    const finalVolume = numberFromInput("dose-final-volume", "Final well volume", { minExclusive: 0 });
    const additionVolume = numberFromInput("dose-addition-volume", "Dosing volume", { minExclusive: 0 });
    const wells = numberFromInput("dose-wells", "Wells per dose", { minExclusive: 0 });
    const overage = numberFromInput("dose-overage", "Extra volume", { min: 0 });
    const equalizeVehicle = document.getElementById("dose-equalize-vehicle").checked;
    if (!Number.isInteger(wells)) throw new Error("Wells per dose must be a whole number.");
    if (additionVolume >= finalVolume) throw new Error("Dosing volume must be smaller than final well volume.");

    const doses = parseDoseTargets(document.getElementById("dose-targets").value);
    if (!doses.some((dose) => approximatelyEqual(dose, 0))) doses.unshift(0);
    const stockUm = stockMm * 1000;
    const totalMixVolume = additionVolume * wells * (1 + overage / 100);
    const mixFactor = finalVolume / additionVolume;
    const preliminary = doses.map((dose) => {
      const dosingConcentration = dose * mixFactor;
      const stockVolume = dosingConcentration * totalMixVolume / stockUm;
      if (stockVolume > totalMixVolume + 1e-9) throw new Error(`${formatNumber(dose, 4)} µM cannot be prepared from a ${formatNumber(stockMm, 4)} mM stock with this dosing volume.`);
      return { dose, dosingConcentration, stockVolume };
    });
    const maxVehicleVolume = Math.max(...preliminary.map((row) => row.stockVolume));

    lastDoseResults = preliminary.map((row) => {
      const extraVehicle = equalizeVehicle ? Math.max(0, maxVehicleVolume - row.stockVolume) : 0;
      const mediumVolume = Math.max(0, totalMixVolume - row.stockVolume - extraVehicle);
      const vehicleFinalPercent = ((row.stockVolume + extraVehicle) / totalMixVolume) * (additionVolume / finalVolume) * 100;
      return {
        ...row,
        extraVehicle,
        mediumVolume,
        totalMixVolume,
        vehicleFinalPercent,
        pmolPerWell: row.dose * finalVolume,
      };
    });

    body.replaceChildren(...lastDoseResults.map((row) => tableRow([
      formatNumber(row.dose, 4),
      formatNumber(row.dosingConcentration, 4),
      formatNumber(row.totalMixVolume, 2),
      formatNumber(row.stockVolume, 3),
      formatNumber(row.extraVehicle, 3),
      formatNumber(row.mediumVolume, 3),
      formatNumber(row.vehicleFinalPercent, 3),
      formatNumber(row.pmolPerWell, 2),
    ], approximatelyEqual(row.dose, 0) ? "control-row" : "")));

    const maxVehiclePercent = Math.max(...lastDoseResults.map((row) => row.vehicleFinalPercent));
    summary.innerHTML = `<strong>${escapeHtml(drugName)}</strong> · ${doses.length} conditions · ${formatNumber(totalMixVolume, 2)} µL mix per condition · ${formatNumber(additionVolume, 2)} µL added per well · ${equalizeVehicle ? "vehicle equalized at" : "maximum vehicle"} ${formatNumber(maxVehiclePercent, 3)}%`;

    const warnings = [];
    lastDoseResults.filter((row) => row.dose > 0 && row.stockVolume < 1).forEach((row) => warnings.push(`${formatNumber(row.dose, 4)} µM requires only ${formatNumber(row.stockVolume, 3)} µL stock. Prepare a validated working stock or serial dilution for reliable pipetting.`));
    if (maxVehiclePercent > 0.1) warnings.push(`Maximum final vehicle is ${formatNumber(maxVehiclePercent, 3)}%. Confirm that this level is tolerated by your cells and assay.`);
    if (!warnings.length) warnings.push("Calculated stock additions are at least 1 µL and final vehicle is no higher than 0.1%.");
    warnings.forEach((message, index) => {
      const warning = document.createElement("p");
      warning.className = `dose-warning${warnings.length === 1 && index === 0 && message.startsWith("Calculated") ? " ok" : ""}`;
      warning.textContent = message;
      warningsBox.append(warning);
    });
    downloadButton.disabled = false;
  } catch (error) {
    lastDoseResults = [];
    summary.textContent = error.message;
    const warning = document.createElement("p");
    warning.className = "dose-warning";
    warning.textContent = "Check the highlighted inputs and calculate again.";
    warningsBox.append(warning);
    downloadButton.disabled = true;
  }
}

function parseDoseTargets(text) {
  const doses = text.split(/[\s,;]+/).filter(Boolean).map(Number);
  if (!doses.length || doses.some((dose) => !Number.isFinite(dose) || dose < 0)) throw new Error("Final doses must be zero or positive numbers separated by commas, spaces or semicolons.");
  return [...new Set(doses)].sort((a, b) => a - b);
}

function downloadDoseCsv() {
  if (!lastDoseResults.length) return;
  const header = "Final_uM,Dosing_mix_uM,Total_mix_uL,Stock_uL,Extra_vehicle_uL,Medium_uL,Final_vehicle_percent,pmol_per_well";
  const rows = lastDoseResults.map((row) => [row.dose, row.dosingConcentration, row.totalMixVolume, row.stockVolume, row.extraVehicle, row.mediumVolume, row.vehicleFinalPercent, row.pmolPerWell].join(","));
  downloadBlob("ctb-drug-dose-recipe.csv", [header, ...rows].join("\n"), "text/csv;charset=utf-8");
}

function numberFromInput(id, label, limits = {}) {
  const input = document.getElementById(id);
  const value = Number(input.value);
  const invalid = !Number.isFinite(value) || (limits.min !== undefined && value < limits.min) || (limits.minExclusive !== undefined && value <= limits.minExclusive);
  input.setAttribute("aria-invalid", String(invalid));
  if (invalid) throw new Error(`${label} has an invalid value.`);
  return value;
}

function approximatelyEqual(first, second) {
  return Math.abs(first - second) <= Math.max(1e-12, Math.abs(first) * 1e-9, Math.abs(second) * 1e-9);
}

function formatNumber(value, decimals) {
  if (!Number.isFinite(value)) return "—";
  if (value === 0) return "0";
  if (Math.abs(value) < 0.001) return value.toExponential(2);
  return Number(value.toFixed(decimals)).toString();
}

function tableRow(values, className = "") {
  const row = document.createElement("tr");
  row.className = className;
  values.forEach((value) => {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.append(cell);
  });
  return row;
}

function svgLine(x1, y1, x2, y2, className) {
  const line = document.createElementNS(svgNamespace, "line");
  line.setAttribute("x1", x1);
  line.setAttribute("y1", y1);
  line.setAttribute("x2", x2);
  line.setAttribute("y2", y2);
  line.setAttribute("class", className);
  return line;
}

function svgText(x, y, text, className, anchor) {
  const element = document.createElementNS(svgNamespace, "text");
  element.setAttribute("x", x);
  element.setAttribute("y", y);
  element.setAttribute("class", className);
  element.setAttribute("text-anchor", anchor);
  element.textContent = text;
  return element;
}

function downloadBlob(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
}
