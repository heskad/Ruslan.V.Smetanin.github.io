# Ruslan Smetanin — Scientific Workbench

A static personal scientific toolbox for protocols, research utilities, scripts, reference notes and selected work.

The site is built with plain HTML, CSS and JavaScript and is published through GitHub Pages. The interactive molecular viewer uses a local copy of 3Dmol.js and five locally stored PDB structures.

The homepage includes a curated publications section sourced from Ruslan Smetanin's Google Scholar profile, with links back to the live Scholar records for current citation information.

The expanded Who I Am section presents Ruslan's scientific journey, mentors and future direction, and includes the original CV as a downloadable PDF.

The dedicated `ctb-assay.html` workspace imports SoftMax Excel files, detects outliers, performs blank correction and control normalization, exposes treatment/plate/audit views, and exports figures and processed data. The separate `ctb-dose-calculator.html` designs a 96-well treatment plate and calculates per-well additions plus working-solution preparation volumes. Assay data and calculations stay in the browser.

SheetJS and Plotly are stored locally under `assets/js` so the analyzer does not depend on a CDN at runtime. Their license files are kept beside the bundled scripts.
