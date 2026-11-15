local out={};for i,v in pairs((PRIVATE_MATCH or {}).BotDifficultyLabels or {}) do out[#out+1]=tostring(i)..'='..tostring(v) end
return table.concat(out,'\n')
