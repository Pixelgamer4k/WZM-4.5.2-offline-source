#!/bin/zsh
# Terminal-only 3P/1P toggle for the active WZM session. No on-screen button.
set -eu
cd "${0:A:h}"
exec ../../frida_venv/bin/python3 tp_terminal_controller.py "${@:-status}"
