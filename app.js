const structures = [
  { id: "1IGT", name: "Immunoglobulin G", source: "assets/pdb/1IGT.pdb" },
  { id: "6U9V", name: "P2X7 receptor", source: "assets/pdb/6U9V.pdb" },
  { id: "1TUP", name: "p53 DNA-binding domain", source: "assets/pdb/1TUP.pdb" },
  { id: "3MXF", name: "BRD4 bromodomain", source: "assets/pdb/3MXF.pdb" },
  { id: "1TIM", name: "Triosephosphate isomerase", source: "assets/pdb/1TIM.pdb" },
];

window.addEventListener("DOMContentLoaded", () => {
  const mount = document.getElementById("molecule-viewer");
  const status = document.getElementById("viewer-status");
  const spinButton = document.getElementById("toggle-spin");
  const resetButton = document.getElementById("reset-view");
  const structureButtons = [...document.querySelectorAll("[data-structure]")];
  let spinning = true;
  let requestNumber = 0;

  if (!mount || !window.$3Dmol) {
    status.textContent = "VIEWER UNAVAILABLE";
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
      status.textContent = `${structure.id} · ${structure.name} · READY`;
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
});
