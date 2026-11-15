local L = rawget(_G, 'WZM_BLOG') or {}
return 'n=' .. #L .. '\n' .. table.concat(L, '\n')
