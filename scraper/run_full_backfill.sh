#!/usr/bin/env bash
# run_full_backfill.sh — Run all backfill scripts in order.
# Uses caffeinate to prevent the Mac from sleeping mid-run.
#
# Usage:
#   cd scraper
#   bash run_full_backfill.sh
#   bash run_full_backfill.sh 2>&1 | tee backfill_$(date +%Y%m%d_%H%M).log

set -euo pipefail

cd "$(dirname "$0")"

START=$(date +%s)
FAILED=()

run_step() {
    local label="$1"
    shift
    echo ""
    echo "============================================================"
    echo "  [$(date '+%H:%M:%S')] $label"
    echo "============================================================"
    if python3 "$@"; then
        echo "  ✓ $label done"
    else
        echo "  ✗ $label FAILED (exit $?)"
        FAILED+=("$label")
    fi
}

echo "============================================================"
echo "  Full backfill — started at $(date '+%Y-%m-%d %H:%M:%S')"
echo "  caffeinate is keeping the Mac awake"
echo "============================================================"

run_step "Education (congresistas missing)"  backfill_education_missing.py --cargo congresista
run_step "Education (senadores missing)"     backfill_education_missing.py --cargo senador
run_step "Cargo de elección + partidario"    backfill_cargo_eleccion.py
run_step "Experience (all)"                  backfill_experience.py --cargo all
run_step "Bienes"                            backfill_bienes.py
run_step "Ingresos"                          backfill_ingresos.py
run_step "Fix regions (congresistas)"        backfill_fix_regions.py

ELAPSED=$(( $(date +%s) - START ))
MINS=$(( ELAPSED / 60 ))
SECS=$(( ELAPSED % 60 ))

echo ""
echo "============================================================"
echo "  Finished in ${MINS}m ${SECS}s"
if [ ${#FAILED[@]} -eq 0 ]; then
    echo "  All steps completed successfully."
else
    echo "  Failed steps: ${FAILED[*]}"
fi
echo "============================================================"
