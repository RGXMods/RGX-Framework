// Execute the real panel visibility methods with explicit hosting seams.
import {readFileSync} from 'node:fs';
import {Lua} from 'wasmoon-lua5.1';
const source=readFileSync(new URL('../../modules/ui/options.lua',import.meta.url),'utf8');
const start=source.indexOf('    -- Visibility must include the host:');
const end=source.indexOf('    -- ── Open',start);
if(start<0 || end<0)throw new Error('Options visibility methods not found');
const lua=await Lua.create();
lua.ctx.methods=source.slice(start,end);
try {
 lua.doStringSync(`
 local function frame()return {shown=false,IsShown=function(self)return self.shown end}end
 SettingsPanel=frame()
 InterfaceOptionsFrame=frame()
 RGX={SafeHide=function(_,f)f.shown=false end}
 panel=frame()
 function panel:IsVisible()
   return self.shown and (not self._settingsEmbedded or SettingsPanel.shown or InterfaceOptionsFrame.shown)
 end
 function panel:Open()self.shown=true if self._settingsEmbedded then SettingsPanel.shown=true end end
 assert(loadstring(methods))()
 panel:Toggle()assert(panel.shown,'floating options did not open')
 panel:Toggle()assert(not panel.shown,'floating options did not close')
 panel._settingsEmbedded=true
 panel:Toggle()assert(panel:IsVisible(),'embedded options did not open')
 panel:Toggle()assert(not SettingsPanel.shown and panel.shown,'toggle must close host, not leave empty settings canvas')
 panel:Toggle()assert(SettingsPanel.shown,'shown child in hidden host blocked reopening')
 `);
 console.log('OPTIONS TOGGLE OK floating close/open and hidden Settings host reopening');
}finally{lua.global.close();}
