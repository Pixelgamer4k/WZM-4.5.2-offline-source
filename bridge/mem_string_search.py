"""mem_string_search.py <pattern> [limit]: grep a process's readable memory for strings.

Usage: mem_string_search.py third_person 20
Read-only: maps the process's own readable regions and scans them for the pattern.
"""
import re, subprocess, sys

D = 'PHONE_IP:5555'
P = 'com.activision.callofduty.warzone'

def main():
    pat = sys.argv[1] if len(sys.argv) > 1 else 'third'
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 20
    pid = subprocess.check_output(
        ['adb', '-s', D, 'shell', 'su', '-c', f'pidof {P}']).decode().split()[0]
    js = f'''
const hits = [];
const ranges = Process.enumerateRanges('r--');
for (const r of ranges) {{
  try {{
    const s = r.base.readUtf8String(Math.min(r.size, 8 * 1024 * 1024));
    if (s && s.toLowerCase().includes('{pat.lower()}')) {{
      let i = s.toLowerCase().indexOf('{pat.lower()}');
      while (i !== -1 && hits.length < {limit}) {{
        hits.push(s.slice(Math.max(0, i - 40), i + 60).replace(/[^\\x20-\\x7e]/g, '.'));
        i = s.toLowerCase().indexOf('{pat.lower()}', i + 1);
      }}
    }}
  }} catch (e) {{}}
}}
send(hits);
'''
    open('/tmp/_memscan.js', 'w').write(js)
    subprocess.run(['adb', '-s', D, 'push', '/tmp/_memscan.js', '/data/local/tmp/_memscan.js'],
                   capture_output=True)
    # run inside the existing frida session instead of a new spawn
    import frida
    from device_pid import resolve_game_pid
    s = frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(resolve_game_pid())
    got = []
    sc = s.create_script(js)
    sc.on('message', lambda m, _: got.extend(m.get('payload') or []))
    sc.load()
    sc.unload(); s.detach()
    print(f'pattern={pat} hits={len(got)}')
    for h in got:
        print('|', h)

if __name__ == '__main__':
    main()
