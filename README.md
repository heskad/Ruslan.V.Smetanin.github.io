# Ruslan Smetanin — Scientific Workbench

A static personal scientific toolbox for protocols, research utilities, scripts, reference notes and selected work.

The site is built with plain HTML, CSS and JavaScript and is published through GitHub Pages. The interactive molecular viewer uses a local copy of 3Dmol.js and five locally stored PDB structures.

The dedicated `ctb-assay.html` workspace imports SoftMax Excel files, detects outliers, performs blank correction and control normalization, exposes treatment/plate/audit views, and exports figures and processed data. The separate `ctb-dose-calculator.html` prepares plate-ready drug master mixes with optional vehicle equalization. Assay data and calculations stay in the browser.

SheetJS and Plotly are stored locally under `assets/js` so the analyzer does not depend on a CDN at runtime. Their license files are kept beside the bundled scripts.
