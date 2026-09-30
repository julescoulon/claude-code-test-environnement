#!/usr/bin/env bash
# Refait tout le rendu de « Graine 0 » : ./render.sh            (film 1080p24 → out/)
#                                        ./render.sh --preview  (maquette 480p12 → preview/)
# Reprise automatique : les images et plans déjà rendus ne sont pas recalculés.
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules/three ] || npm ci
python3 -c "import bpy, numpy, PIL, fontTools, brotli" 2>/dev/null || pip install -r requirements.txt
exec python3 pipeline/render_all.py "$@"
