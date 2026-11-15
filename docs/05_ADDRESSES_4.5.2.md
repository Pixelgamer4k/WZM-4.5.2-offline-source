# Engine addresses, hashes and offsets — Warzone Mobile 4.5.2 build 22729281

All offsets are into `libgame.so`, sha256 `c8f5e9df317b7442567e61255ac7894bbf1b6693c30fcfd3a6ee6cde6c04b7d7`.
**If your `libgame.so` sha256 differs, none of these apply** — re-find them with the methods in docs/06.
These are the values the source actually uses; they are also commented at each use site.

## Boot / UI Lua
| What | Address |
|---|---|
| UI Lua frame (the one hook) | `0x337c1c0` |
| UI reinit (called from the frame at `+0x337c14c`) | `0x33790e8` |
| Request UI restart | `0x337c03c` (entry `0x337c0a8`); flag at `0xb12f910` (setter `0x361dd1c`) |
| Lua load / pcall / tostring | `0x4490778` / `0x4486bc4` / `0x4483720` |
| Lua error callback table ptr | `0xae8c490` |

## Fences
| What | Address |
|---|---|
| Fence state query (table `Fences`, key `xhash #x0b06c6d08978b8c65`) | resolves to the per-controller fence objects |
| Fence state read helper | `0x36af83c` (reads `0xb2a6880 + ctrl*0x1f0 + 0x2d8 + idx*8`, then `[+0x40]`) |
| Fence pass check used by the frontend room | `0x36ae29c`, return sites `0x3aae2a0` / `0x3aae2b0` |
| Fence names table | base `0xb2a6880` |
| Fence indexes | NET_CONNECTION=0 … NETWORKING=2 … ONLINE=13 … CLIENT_CONNECT=42 … WEAPON_DEF=53 (full list in `bridge/` notes) |

## Weapon registry (Gear Up)
| What | Address |
|---|---|
| Weapon-def register callback | `0x28fe554` |
| Count u32 / entries | `0x6cb1ab0` / `0x6cb1ac0` |
| Match-load walk of entries | `0x1de939c` (null fault `0x1de93b4` when count/entry 0) |

## Host / match / server
| What | Address |
|---|---|
| Session-manager tick (host replaces this) | `0x1617e74` |
| Host start (party fn) | `0x1621ab0` |
| SV_SpawnServer | `0x3ce8cfc` |
| SV_Frame | `0x3cf10e0`; server-thread loop `0x3cf253c` / `0x3cbd0e8` |
| Client state setter | `0x15e4a58`; reset-to-menu `0x15e465c`; disconnect `0x15d6268` |
| Client "enter world" gate | `0x3cd0a00` |
| Fatal-error path | `0x12a1104` (writes to addr 0x13 at `0x12a1300`) |

## Frontend 3D room
| What | Address |
|---|---|
| Frontend manager | `0x3aae118` (state at `0xc115e60`, table `0x631584`) |
| "Local FrontEnd" server start | `0x3cc990c`; hostname fn `0x3ce83ac` |
| World render counter (ECS gate) | `0xbeb07f4` (read by `0x3a5579c`); ECS pass `0x3a04914` |

## Graphics (dvars)
| What | Address |
|---|---|
| Dvar table | `0x54bd7b8` → ptr → ptr; entry stride `0x58`; value `+0x28`/`+0x38`; type byte `+0x15` (1=float); reset `+0x48` |
| Resolution-preset clamp (patched to ret) | `0x2ef61f8` |
| Scene-size sizing call | `0x2eaf78c` |
| Reflection quality int | `0x835ed9c` |

**Dvar name hash** = FNV-1a 64 of the lowercased name, basis `0x7238A5E2001AEB8E`, prime `0x10000000233`.
Key enum dvar hashes (`cur`/options): resolution preset `19e76c718fbb7351`, AA `d2a2a59552643885` (None/SMAA/SGSR),
SMAA quality `7b374f8d8b8f7d8e`, temporal `5cd1f66da730bbca`, upscaler `fa96a2168c519506` (Off/CAS/FSR…),
fps cap `caa98f528ccd5f26`, CAS strength (float) `c56180de91339fec`, textures `791caebb225b800d`.
Mobile render size ints: `270baabe0eb3399e`, `0ba9243ff7e168cf` (game sets ~62%, 100 = full).

## Camera
| What | Address |
|---|---|
| 3P predicate (forced true for local player) | `0x1f6e840` |
| Camera callsite (local player state in x24) | `0x2326aac` |

## Asset types / zones (map porting)
| What | Address |
|---|---|
| Asset type name table (physicslibrary=index 0) | `0x53e3458`; `particlesystem`=61, `xmodel`=9 |
| Load_XAsset (4.5.2) | `0x17a7880` |
| DB_LoadXAssets / stream read / align | `0x1aafb68` / `0x199e98c` / `0x19a4bcc` |
| DB stream state | `0x6724ca0` (+0x100 cursor, +0x188 block) |
| 3.3.2 equivalents (old-map emulator) | DB_LoadXAssets `0xf3f1c4`, Load_XAsset `0x35c6f90`, stream state `0x5477f88` |

## Package / signing
| What | Value |
|---|---|
| Package | `com.activision.callofduty.warzone` |
| versionCode / versionName | `3953` / `4.5.2.22729281` |
| libgame.so sha256 | `c8f5e9df317b7442567e61255ac7894bbf1b6693c30fcfd3a6ee6cde6c04b7d7` |
| Offline base.apk sha256 (reference build) | `1a2065b43623364895892b73b5d0be7d42ad345f7742f6aed83fcd164994f6e9` |
