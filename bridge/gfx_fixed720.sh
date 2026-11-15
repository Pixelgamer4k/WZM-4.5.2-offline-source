#!/bin/zsh
# Legacy filename: fixed internal 1376x640 + dynamic-resolution level 0.
# play_offline.sh already enables the 640p profile by default.
set -eu
cd "${0:A:h}"
exec ../../frida_venv/bin/python3 gfx_fixed720_live.py
