#!/usr/bin/env bash
set -euo pipefail

# A tiny shim so local dev can run DOCX/PPTX -> PDF conversions without
# installing LibreOffice natively. The backend calls this script exactly like it
# would call `soffice`.
#
# Expected args include:
#   --headless --nologo --nolockcheck --convert-to pdf --outdir <DIR> <INPUT>
#
# We infer the working directory from `--outdir` and mount it into Docker as
# /work, then rewrite any paths under that directory accordingly.

OUTDIR=""
ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --outdir)
      OUTDIR="${2:-}"
      ARGS+=("$1" "$OUTDIR")
      shift 2
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done

if [[ -z "$OUTDIR" ]]; then
  echo "soffice-docker: missing --outdir argument" >&2
  exit 2
fi

if [[ ! -d "$OUTDIR" ]]; then
  echo "soffice-docker: outdir not a directory: $OUTDIR" >&2
  exit 2
fi

# Rewrite any arg path under $OUTDIR to its /work equivalent.
REWRITTEN=()
for a in "${ARGS[@]}"; do
  if [[ "$a" == "$OUTDIR"* ]]; then
    REWRITTEN+=("/work${a#"$OUTDIR"}")
  else
    REWRITTEN+=("$a")
  fi
done

# LibreOffice CLI binary inside the image is `libreoffice`.
docker run --rm \
  -v "$OUTDIR:/work" \
  domnulnopcea/libreoffice-headless \
  libreoffice "${REWRITTEN[@]}"

