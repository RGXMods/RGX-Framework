import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Lua} from 'wasmoon-lua5.1';
const root=join(dirname(fileURLToPath(import.meta.url)),'../..');
const lua=await Lua.create();
for(const [name,path]of Object.entries({database:'core/systems/database.lua',controls:'modules/ui/controls.lua',layout:'modules/ui/layout.lua',profiles:'modules/ui/profiles.lua'}))lua.ctx[name]=readFileSync(join(root,path),'utf8');
try {lua.doStringSync(`
 local function widget(kind,parent)
   local w={kind=kind,parent=parent,scripts={},width=300,height=20,enabled=true}
   function w:SetScript(key,fn)self.scripts[key]=fn end
   function w:HookScript(key,fn)local old=self.scripts[key];self.scripts[key]=function(...)if old then old(...)end fn(...)end end
   function w:SetText(text)self.text=text end
   function w:GetText()return self.text end
   function w:SetWidth(width)self.width=width end
   function w:SetHeight(height)self.height=height end
   function w:SetSize(width,height)self.width=width self.height=height end
   function w:GetWidth()return self.width end
   function w:GetHeight()return self.height end
   function w:SetEnabled(value)self.enabled=value end
   function w:Click()if self.enabled and self.scripts.OnClick then self.scripts.OnClick(self,'LeftButton')end end
   function w:CreateFontString()return widget('FontString',self)end
   function w:CreateTexture()return widget('Texture',self)end
   for _,key in ipairs({'SetPoint','ClearAllPoints','SetAllPoints','SetAutoFocus','SetMaxLetters','ClearFocus',
    'SetBackdrop','SetBackdropBorderColor','SetColorTexture','SetTextColor','SetFontObject','SetJustifyH','SetJustifyV','SetWordWrap'})do w[key]=function()end end
   return w
 end
 function CreateFrame(kind,_,parent)return widget(kind,parent)end
 function UnitName()return 'Tester'end function GetRealmName()return 'Realm'end
 local modules={}
 RGXFramework={errors=0,Print=function()end,Debug=function()end}
 function RGXFramework:GetModule(name)return modules[name]end
 function RGXFramework:RegisterModule(name,module)modules[name]=module end
 function RGXFramework:GetDesign()return {Unpack=function()return 1,1,1 end}end
 function RGXFramework:Error()self.errors=self.errors+1 end
 function RGXFramework:DeepCopy(value)
   local function copy(v)if type(v)~='table'then return v end local result={}for k,x in pairs(v)do result[k]=copy(x)end return result end
   return copy(value)
 end
 assert(loadstring(database))('RGX-Framework',RGXFramework)
 assert(loadstring(controls))('RGX-Framework',{})
 local UI=modules.ui
 assert(loadstring(layout))('RGX-Framework',UI)
 function UI:CreateSection()local card=widget('Frame');card.headerBand={}card.content=widget('Frame',card)return card end
 modules.dropdowns={CreateNestedDropdown=function(_,parent,opts)
   local picker=widget('Frame',parent);picker.opts=opts
   function picker:Refresh(value)self.value=value end
   return picker
 end}
 assert(loadstring(profiles))('RGX-Framework',UI)
 local db=RGXFramework:NewDatabase('ProfileUITestDB',{enabled=true,nested={amount=10}},{profileIsGlobal=true})
 local view=db.global
 local card=UI:CreateProfilesPanel(widget('Frame'),{db=db,onChange=function()error('expected observer failure')end})
 assert(not card.buttons.delete.enabled and not card.buttons.rename.enabled,'Default is not protected')
 card.input:SetText('Raid');card.buttons.create:Click()
 assert(db:GetActiveProfile()=='Raid' and card.dropdown.value=='Raid')
 view.enabled=false;view.nested.amount=42
 card.input:SetText('Quiet');card.buttons.copy:Click()
 assert(db:GetActiveProfile()=='Quiet' and view.enabled==false and view.nested.amount==42,'copy lost settings')
 view.nested.amount=9
 db:LoadProfile('Raid');assert(view.nested.amount==42,'copy aliased nested data')
 card:Refresh();card.input:SetText('Raid');card.buttons.create:Click()
 assert(view.enabled==false and card.status:GetText()=='That profile already exists.','duplicate overwrote profile')
 card.input:SetText('Renamed');card.buttons.rename:Click()
 assert(db:GetActiveProfile()=='Renamed' and view.enabled==false)
 card.buttons.reset:Click();assert(view.enabled==true and view.nested.amount==10)
 card.buttons.delete:Click();assert(db:GetActiveProfile()~='Renamed')
 card.dropdown.opts.onChange('Default');assert(db:GetActiveProfile()=='Default')
 assert(not card.buttons.delete.enabled and not card.buttons.rename.enabled)
 assert(RGXFramework.errors>0,'observer failures were not isolated')
 `);console.log('PROFILES UI OK real factories/DB CRUD, duplicate/protected names, deep copy, live settings view, callback isolation');}
finally{lua.global.close();}
