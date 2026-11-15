#!/usr/bin/env python3
"""Crash2 TDM session-only native camera toggle via Unix socket, no phone UI.

Server: python3 tp_terminal_controller.py serve [1p|3p]
Client: python3 tp_terminal_controller.py 3p|1p|toggle|status|stop

The server keeps its Frida hook alive only while the game/process is alive.
Socket is local to the Mac; commands never reattach or alter the APK.
"""
import contextlib
import json
import os
from pathlib import Path
import signal
import socket
import socketserver
import subprocess
import sys
import time

import frida
from device_pid import resolve_game_pid

HERE=Path(__file__).resolve().parent
RUNTIME=HERE.parent.parent/'runtime'/'thirdperson_20261104'
SOCK=Path('/tmp')/('wzm_tp_'+str(os.getuid())+'.sock')
AGENT=HERE/'tp_terminal_agent.js'
ADB='PHONE_IP:5555'

class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        cmd=self.rfile.readline(256).decode('ascii','replace').strip().lower()
        agent=self.server.agent
        try:
            if cmd in ('3p','3','on','enable'):
                result=agent.exports_sync.enable()
            elif cmd in ('1p','1','off','disable'):
                result=agent.exports_sync.disable()
            elif cmd in ('toggle','t'):
                result=agent.exports_sync.toggle()
            elif cmd in ('status','s',''):
                result=agent.exports_sync.state()
            elif cmd in ('stop','quit'):
                result=agent.exports_sync.stop()
                self.server.running=False
            else:
                result={'error':'Unknown command; use 3p, 1p, toggle, status or stop'}
        except Exception as exc:
            result={'error':str(exc)}
        self.wfile.write((json.dumps(result,separators=(',',':'))+'\n').encode())

class CameraServer(socketserver.UnixStreamServer):
    allow_reuse_address=False

def send_command(cmd):
    if not SOCK.is_socket():
        print('No live third-person controller. Start `tp_terminal.sh serve`.',file=sys.stderr)
        return 2
    try:
        with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as sock:
            sock.settimeout(10)
            sock.connect(str(SOCK))
            sock.sendall((cmd+'\n').encode())
            sock.shutdown(socket.SHUT_WR)
            raw=b''
            while not raw.endswith(b'\n'):
                part=sock.recv(4096)
                if not part:break
                raw+=part
        reply=json.loads(raw)
    except (OSError,ValueError) as exc:
        print('Controller disconnected: '+str(exc),file=sys.stderr)
        return 2
    if reply.get('error'):
        print('Error:',reply['error'],file=sys.stderr)
        return 1
    if reply.get('stopped'):
        print('Camera controller stopped. Player camera restored.')
        return 0
    print('Camera:',reply.get('mode','unknown'), '| game PID:',reply.get('pid','?'),
          '| local player ready:',reply.get('ready','?'), '| override calls:',reply.get('overrideCalls','?'))
    return 0

def serve(default):
    RUNTIME.mkdir(exist_ok=True,parents=True)
    # A live socket must never be overwritten; this prevents competing hooks.
    if SOCK.exists():
        if SOCK.is_socket():
            try:
                with socket.socket(socket.AF_UNIX,socket.SOCK_STREAM) as check:
                    check.settimeout(1)
                    check.connect(str(SOCK))
                    raise RuntimeError('A camera controller is already running. Use tp_terminal.sh 3p/1p/toggle.')
            except (ConnectionRefusedError,FileNotFoundError,OSError):
                SOCK.unlink(missing_ok=True)
        else:
            raise RuntimeError('Refusing to overwrite a non-socket: '+str(SOCK))
    subprocess.run(['adb','-s',ADB,'forward','tcp:27042','tcp:27042'],check=True,
                   stdout=subprocess.DEVNULL)
    pid=resolve_game_pid()
    session=frida.get_device_manager().add_remote_device('127.0.0.1:27042').attach(pid)
    script=session.create_script(AGENT.read_text())
    dead=False
    def detached(*args):
        nonlocal dead
        dead=True
    session.on('detached',detached)
    script.on('destroyed',lambda: detached())
    script.on('message',lambda msg,data: print('Agent:',str(msg.get('payload',msg))[:400],flush=True))
    script.load()
    # Wait until current camera callsite has supplied the local player state.
    for _ in range(60):
        if dead:break
        try:
            ready=script.exports_sync.state().get('ready')
        except frida.InvalidOperationError:
            break
        if ready:break
        time.sleep(0.3)
    if default=='3p' and not dead:
        print('Initial mode:',script.exports_sync.enable(),flush=True)
    with CameraServer(str(SOCK),Handler) as server:
        os.chmod(SOCK,0o600)
        server.agent=script
        server.running=True
        server.timeout=0.5
        print('Terminal camera toggle ready. Commands: ./tp_terminal.sh 3p | 1p | toggle | status | stop',flush=True)
        try:
            while server.running and not dead:
                server.handle_request()
        except KeyboardInterrupt:
            pass
        finally:
            if not dead:
                with contextlib.suppress(Exception):print('Restore:',script.exports_sync.stop(),flush=True)
            with contextlib.suppress(Exception):script.unload()
            with contextlib.suppress(Exception):session.detach()
    SOCK.unlink(missing_ok=True)
    print('Camera controller exited; no APK or gameplay scripts changed.',flush=True)
    return 0

if __name__=='__main__':
    cmd=sys.argv[1].lower() if len(sys.argv)>1 else 'status'
    if cmd=='serve':
        try:sys.exit(serve(sys.argv[2].lower() if len(sys.argv)>2 else '3p'))
        except Exception as exc:
            print('Controller error:',exc,file=sys.stderr)
            sys.exit(1)
    else:
        sys.exit(send_command(cmd))
