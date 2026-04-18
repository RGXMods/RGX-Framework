--[[
    RGX-Framework - Commands
    
    Minimal slash commands for debugging
--]]

local _, RGX = ...

SLASH_RGX1 = "/rgx"
SlashCmdList["RGX"] = function(msg)
	local cmd = msg:lower()
	
	if cmd == "modules" then
		local mods = RGX:GetLoadedModules()
		print("|cFF00A2FF[RGX]|r Modules:", table.concat(mods, ", "))
		
	elseif cmd == "fonts" then
		local Fonts = RGX:GetModule("fonts")
		if Fonts then
			local list = Fonts:ListAvailable()
			print("|cFF00A2FF[RGX]|r Fonts:", #list, "available")
		end
		
	elseif cmd == "debug" then
		RGX.debugMode = not RGX.debugMode
		print("|cFF00A2FF[RGX]|r Debug:", RGX.debugMode and "ON" or "OFF")
		
	else
		print("|cFF00A2FF[RGX]|r Commands: modules, fonts, debug")
	end
end
