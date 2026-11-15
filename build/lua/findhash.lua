local want = {['xhash: #x07d5608f97ebabbe4'] = 'graphics', ['xhash: #x0401dbf6dbd8347b8'] = 'settings'}
local out = {}
local FM = LUI.FlowManager
for k, v in pairs(FM.FlowMenus or {}) do if want[tostring(k)] then out[#out + 1] = 'FlowMenus has ' .. want[tostring(k)] end end
local st = FM.GetMenuStack(0)
for i, m in ipairs(st or {}) do out[#out + 1] = 'stack ' .. tostring(m.name) end
return table.concat(out, '\n')
