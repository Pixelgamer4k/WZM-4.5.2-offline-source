#!/usr/bin/env python3
"""ffpack: unpack / repack WZM 4.5.2 fastfiles (container v25: IWffn100 header, TAFF, IWC blocks).

Repacking writes every block as an Oodle literal chunk ('cc0a' + raw bytes), the same form the game
already uses for 80 of Nuketown's 639 blocks, so no compressor is needed.
  unpack: ffpack.py unpack <in.ff> <out_dir>   -> prefix.bin (header+TAFF), decoded.bin
  pack:   ffpack.py pack <prefix.bin> <decoded.bin> <out.ff>
"""
import struct, subprocess, sys, hashlib
from pathlib import Path
HERE=Path(__file__).resolve().parent
DEC=HERE.parent/'map_import_20261104/deps/ooz_block_driver'
BLOCK=65536
LITERAL=bytes.fromhex('cc0a')

def iwc_offset(d):
    for i in range(224,4096,4):
        if d[i:i+4]==b'\x02IWC':return i
    raise ValueError('no IWC header')

def blocks(d):
    off=iwc_offset(d);pos=off+12;out=[]
    while pos<len(d):
        c,s,r=struct.unpack_from('<III',d,pos);out.append((d[pos+12:pos+12+c],s));pos=(pos+12+c+3)&~3
    return off,out

def decode(d):
    off,bl=blocks(d)
    parts=[struct.pack('<I',len(bl))]+[struct.pack('<II',len(p),s)+p for p,s in bl]
    r=subprocess.run([str(DEC)],input=b''.join(parts),capture_output=True,timeout=300)
    if r.returncode:raise RuntimeError(r.stderr[:500])
    return d[:off],r.stdout

def pack(prefix,decoded):
    off=len(prefix)
    body=bytearray(b'\x02IWC'+struct.pack('<I',len(decoded))+bytes.fromhex('0000010f'))
    for i in range(0,len(decoded),BLOCK):
        chunk=decoded[i:i+BLOCK];payload=LITERAL+chunk
        body+=struct.pack('<III',len(payload),len(chunk),0)+payload
        while (off+len(body))%4:body+=b'\0'
    hdr=bytearray(prefix)
    struct.pack_into('<I',hdr,0x14,len(body))        # bytes from IWC start to EOF
    struct.pack_into('<Q',hdr,0x38,len(decoded))     # decoded stream size
    return bytes(hdr)+bytes(body)

if __name__=='__main__':
    cmd=sys.argv[1]
    if cmd=='unpack':
        d=Path(sys.argv[2]).read_bytes();prefix,dec=decode(d);o=Path(sys.argv[3]);o.mkdir(parents=True,exist_ok=True)
        (o/'prefix.bin').write_bytes(prefix);(o/'decoded.bin').write_bytes(dec)
        print('prefix',len(prefix),'decoded',len(dec),hashlib.sha256(dec).hexdigest()[:16])
    elif cmd=='pack':
        out=pack(Path(sys.argv[2]).read_bytes(),Path(sys.argv[3]).read_bytes());Path(sys.argv[4]).write_bytes(out)
        print('wrote',len(out))
