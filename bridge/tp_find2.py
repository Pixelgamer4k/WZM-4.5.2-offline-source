"""tp_find2.py: search the dvar command tables + live memory for third-person camera names."""
import re, subprocess, sys
D='PHONE_IP:5555'; P='com.activision.callofduty.warzone'
pid=subprocess.check_output(['adb','-s',D,'shell','su','-c',f'pidof {P}']).decode().split()[0]
for pat in ['thirdperson','third_person','third-person','third person','sv_thirdperson','cg_thirdperson','camera_third']:
    out=subprocess.run(['adb','-s',D,'shell',f"su -c \"grep -a -o -m5 -E '[a-zA-Z0-9_]*{pat}[a-zA-Z0-9_]*' /proc/{pid}/maps 2>/dev/null | head -3\""],capture_output=True,text=True).stdout
    print(pat, '->', out.strip()[:200] or 'none')
