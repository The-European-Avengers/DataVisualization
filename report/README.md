# Final project report

LaTeX sources for the Data Visualization (SDU, E26) final project report.

## Build

```sh
./compile.sh        # build main.pdf
./compile.sh -o     # build, then open the PDF
./compile.sh -w     # watch the sources, rebuild on every save
./compile.sh -c     # remove build artefacts (keeps main.pdf)
./compile.sh -C     # remove build artefacts and main.pdf
./compile.sh -h     # usage
```

The script adds `/Library/TeX/texbin` to `PATH` (editor shells often miss it),
prints only the real errors when a build fails, warns about undefined
references, reports the page count against the 12-15 page limit, and
automatically retries once after clearing intermediate files - an interrupted
build otherwise leaves a half-written `.aux` that fails with a misleading
`Missing \begin{document}`.

`make`, `make watch` and `make clean` still work if you prefer latexmk directly.

Requires a TeX distribution with `latexmk` and `biber` (MacTeX/TeX Live).

## Layout

| Path | Contents |
| --- | --- |
| `compile.sh` | Build script (see above) |
| `main.tex` | Preamble, document metadata, section includes |
| `sections/00-titlepage.tex` | Front page |
| `sections/01-team.tex` | Team info + Percent of Contribution table |
| `sections/02-abstract.tex` | Abstract |
| `sections/03-background.tex` | 1. Background and Motivation |
| `sections/04-objectives.tex` | 2. Project Objectives |
| `sections/05-data.tex` | 3. Data (source, variables, processing) |
| `sections/06-visualization.tex` | 4. Visualization/Dashboard, must-haves, the 9 graphs |
| `sections/07-story.tex` | 5. Story/Results |
| `sections/08-conclusion.tex` | 6. Conclusion/Discussion |
| `references.bib` | Bibliography |
| `figures/` | Images (`\graphicspath` points here) |

Edit the metadata commands at the top of `main.tex` (`\projecttitle`,
`\groupnumber`, `\semester`, `\dashboardurl`) rather than hard-coding
those values in the sections.

## Requirements from the guidelines

- Minimum 12, maximum 15 pages **including the front page**.
- At least 9 graphs, of at least three types, at least one animated.
- One AI-generated graph, documented with platform + prompts + the question it answers.
- One custom visualization not producible by a standard R/Python function.
- Link to the dashboard, and a download-as-manual option in the dashboard.
- Submit as `DV_E26_group03.zip` (report + dashboard code + 2-minute demo video).
