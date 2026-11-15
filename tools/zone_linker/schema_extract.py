#!/usr/bin/env python3
import os
"""schema_extract.py <loader_fn_va> [depth]: derive a struct schema from a generated WZM 4.5.2 Load_* function.
Tracks simple dataflow inside the function: struct base register (x19/x20/... = arg1 copy), field loads,
constant/shift/mul size expressions. Reports, in order:
  ROOT read size, then for each pointer field: ptr offset, count expr, element size, child loader calls."""
import sys,struct,capstone
from capstone.arm64 import *
LIB=os.environ.get('WZM_LIBGAME', 'input/libgame.so')
data=open(LIB,'rb').read();TEXT_DELTA=0x1000
READ=0x1aaf74c;ALIGN=0x19a4bcc;PUSH=0x19b5c2c;POP=0x19b5cb4
md=capstone.Cs(capstone.CS_ARCH_ARM64,capstone.CS_MODE_ARM);md.detail=True
def insns(va,maxn=6000):
    out=[];off=va-TEXT_DELTA
    for ins in md.disasm(data[off:off+maxn*4],va):
        out.append(ins)
        if ins.mnemonic=='ret' and len(out)>4:
            # stop at first ret only if no branch targets beyond (approximate: continue scanning 64 more)
            pass
    return out
def fn_end(ins_list):
    # end at the first ret after which the next instruction starts a new prologue
    for i,ins in enumerate(ins_list):
        if ins.mnemonic in('ret',) or (ins.mnemonic=='b' and ins.op_str.startswith('#0x') and False):
            nxt=ins_list[i+1] if i+1<len(ins_list) else None
            if nxt is None or nxt.mnemonic in('stp','sub','paciasp') : return i+1
    return len(ins_list)
def N(r):
    return ('x'+r[1:]) if r and r[0]=='w' and r[1:].isdigit() else ('xzr' if r=='wzr' else r)
def reg(ins,i):return N(ins.reg_name(ins.operands[i].reg))
def analyze(va):
    L=insns(va);L=L[:fn_end(L)]
    base=None;env={};lastptr=None;events=[]
    for ins in L:
        m=ins.mnemonic;ops=ins.operands
        try:
            if m=='mov' and len(ops)==2:
                d=reg(ins,0)
                if ops[1].type==ARM64_OP_REG:
                    s=reg(ins,1)
                    if s in('x1',) and base is None and d not in('x0','x1','x2'): base=d
                    env[d]=env.get(s,s)
                elif ops[1].type==ARM64_OP_IMM: env[d]=ops[1].imm
            elif m in('ldr','ldrh','ldrb','ldrsw','ldur','ldurh','ldurb') and ops[1].type==ARM64_OP_MEM:
                d=reg(ins,0);bm=N(ins.reg_name(ops[1].mem.base));disp=ops[1].mem.disp
                dn=ins.reg_name(ops[0].reg);w={'ldr':4 if dn.startswith('w') else 8,'ldur':4 if dn.startswith('w') else 8,'ldrh':2,'ldurh':2,'ldrb':1,'ldurb':1,'ldrsw':4}[m]
                if base and (bm==base or env.get(bm,bm) in (base,'x1')): env[d]=f'f{disp:#x}:{w}'
                elif bm.startswith('x') and str(env.get(bm,'')).startswith('elem'): env[d]=f'{env[bm]}+{disp:#x}:{w}'
                else: env[d]=f'mem({bm},{disp:#x})'
            elif m in('lsl','ubfiz') and ops[1].type==ARM64_OP_REG:
                s=env.get(reg(ins,1),reg(ins,1));sh=ops[2].imm
                env[reg(ins,0)]=f'({s})*{1<<sh}'
            elif m in('umull','smull','mul','madd','umaddl') and len(ops)>=3:
                a=env.get(reg(ins,1),reg(ins,1));b=env.get(reg(ins,2),reg(ins,2))
                env[reg(ins,0)]=f'({a})*({b})'
            elif m=='sub' and len(ops)==3 and ops[2].type==ARM64_OP_REG:
                env[reg(ins,0)]=f'({env.get(reg(ins,1),reg(ins,1))})-({env.get(reg(ins,2),reg(ins,2))})'
            elif m=='cbz' and ops[0].type==ARM64_OP_REG:
                v=env.get(reg(ins,0),'');
                if isinstance(v,str) and v.startswith('f'): lastptr=v
            elif m=='bl':
                t=ops[0].imm
                if t==READ: events.append(('READ',lastptr,env.get('x2','?'),hex(ins.address+4)))
                elif t==ALIGN: events.append(('ALIGN',env.get('x0','?')))
                elif t in(PUSH,POP): pass
                elif 0x16b0000<=t<0x17b0000: events.append(('CALL',hex(t),lastptr,env.get('x1','?'),env.get('x0','?')))
                for r in('x0','x1','x2','x3','x4','x5','x6','x7','x8','x9','x10','x11','x12','x13','x14','x15','x16','x17'):env.pop(r,None)
        except Exception as e: pass
    return base,events
if __name__=='__main__':
    va=int(sys.argv[1],16);base,ev=analyze(va)
    print('loader',hex(va),'struct base reg',base)
    for e in ev:print('  ',e)
