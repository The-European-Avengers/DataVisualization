#!/usr/bin/env bash
#
# Compile the report.
#
#   ./compile.sh            build main.pdf
#   ./compile.sh -o         build, then open the PDF
#   ./compile.sh -w         watch the sources and rebuild on every save
#   ./compile.sh -c         remove build artefacts (keeps main.pdf)
#   ./compile.sh -C         remove build artefacts and main.pdf
#
set -euo pipefail

MAIN=main
cd "$(dirname "$0")"

open_after=false
mode=build

while getopts ":owcCh" opt; do
  case $opt in
    o) open_after=true ;;
    w) mode=watch ;;
    c) mode=clean ;;
    C) mode=cleanall ;;
    h) sed -n '3,9p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    \?) echo "unknown option: -$OPTARG (try -h)" >&2; exit 2 ;;
  esac
done

# TeX Live on macOS installs here but GUI/editor shells often miss it.
[ -d /Library/TeX/texbin ] && PATH="/Library/TeX/texbin:$PATH"

if ! command -v latexmk >/dev/null 2>&1; then
  echo "error: latexmk not found." >&2
  echo "Install a TeX distribution (MacTeX: brew install --cask mactex)." >&2
  exit 1
fi

case $mode in
  clean)    latexmk -c; echo "Build artefacts removed ($MAIN.pdf kept)."; exit 0 ;;
  cleanall) latexmk -C; echo "Build artefacts and $MAIN.pdf removed.";    exit 0 ;;
  watch)    exec latexmk -pdf -pvc -interaction=nonstopmode "$MAIN.tex" ;;
esac

echo "Compiling $MAIN.tex ..."
log=$(mktemp)
trap 'rm -f "$log"' EXIT

# An interrupted build leaves a half-written .aux/.bcf behind, which makes the
# next run die with a confusing "Missing \\begin{document}". So on failure,
# throw away the intermediate files and try once more before giving up.
build() { latexmk -pdf -interaction=nonstopmode -halt-on-error "$MAIN.tex" >"$log" 2>&1; }

rm -f "$MAIN".*-SAVE-ERROR

if ! build; then
  echo "First attempt failed; clearing intermediate files and retrying ..."
  rm -f "$MAIN".aux "$MAIN".toc "$MAIN".out "$MAIN".bcf "$MAIN".bbl \
        "$MAIN".run.xml "$MAIN".fdb_latexmk "$MAIN".fls "$MAIN".*-SAVE-ERROR
  rm -f sections/*.aux
  if ! build; then
    echo >&2
    echo "Compilation FAILED. Errors:" >&2
    grep -E '^!|^l\.[0-9]+' "$log" | head -20 | sed 's/^/  /' >&2
    echo >&2
    echo "Full log: $(pwd)/$MAIN.log" >&2
    exit 1
  fi
fi

# Surface problems that do not stop the build but do break the final PDF.
warnings=$(grep -cE 'Reference .* undefined|Citation .* undefined' "$MAIN.log" || true)
if [ "$warnings" -gt 0 ]; then
  echo
  echo "warning: $warnings undefined reference(s)/citation(s):"
  grep -oE "(Reference|Citation) \`[^']*' (on page [0-9]+ )?undefined" "$MAIN.log" | sort -u | sed 's/^/  /'
fi

# latexmk prints nothing when the PDF is already up to date, so read the page
# count out of main.log. TeX hard-wraps that line, hence the newline stripping.
n=$(tr -d '\n' < "$MAIN.log" | grep -oE 'Output written on [^(]*\([0-9]+ pages' \
      | tail -1 | grep -oE '[0-9]+ pages$' | cut -d' ' -f1 || true)
echo
if [ -n "$n" ]; then
  echo "Built $MAIN.pdf ($n pages)."
  # The guidelines require 12-15 pages including the front page.
  if   [ "$n" -lt 12 ]; then echo "note: below the 12-page minimum."
  elif [ "$n" -gt 15 ]; then echo "note: ABOVE the 15-page maximum."
  fi
else
  echo "Built $MAIN.pdf."
fi

if $open_after; then
  open "$MAIN.pdf"
fi
