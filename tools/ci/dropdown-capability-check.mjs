#!/usr/bin/env node
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Lua} from 'wasmoon-lua5.1';
const root=join(dirname(fileURLToPath(import.meta.url)),'../..');
const lua=await Lua.create();
lua.ctx.source=readFileSync(join(root,'modules/dropdowns/dropdowns.lua'),'utf8');
try {
 lua.doStringSync(`
  RGXFramework={RegisterModule=function(self,_,module)self.dropdown=module end,Debug=function()end}
  UIParent={}
  local modernCalls=0
  function CreateFrame(_,_,_,template)
    error('No selection dropdown template available: '..tostring(template))
  end
  MenuUtil={CreateContextMenu=function(owner,generator)
    modernCalls=modernCalls+1
    local root={}
    function root:CreateButton(text,callback)self.text=text self.callback=callback return {} end
    generator(owner,root)
    return root
  end}
  assert(loadstring(source))('RGX-Framework',{})
  local clicked=false
  local menu=RGXFramework.dropdown:CreateContextMenu({parentFrame=UIParent,
    items={{text='Select',func=function()clicked=true end}}})
  assert(modernCalls==1 and menu,'available context menu was discarded because selection template is absent')
  assert(menu.text=='Select' and type(menu.callback)=='function')
  menu.callback(); assert(clicked)
  -- A client without MenuUtil still receives its existing legacy menu.
  MenuUtil=nil
  local added,opened={},false
  function UIDropDownMenu_Initialize(_,generator)generator(nil,1)end
  function UIDropDownMenu_CreateInfo()return {}end
  function UIDropDownMenu_AddButton(info)added[#added+1]=info end
  function ToggleDropDownMenu()opened=true end
  function CreateFrame(_,_,_,template)
    assert(template=='UIDropDownMenuTemplate','unexpected legacy template')
    return {}
  end
  clicked=false
  local legacy=RGXFramework.dropdown:CreateContextMenu({items={{text='Legacy',func=function()clicked=true end}}})
  assert(legacy and opened and #added==1)
  added[1].func(); assert(clicked)
  ToggleDropDownMenu=nil
  assert(RGXFramework.dropdown:CreateContextMenu({items={}})==nil,'partial legacy API was advertised as usable')
  -- Programmatic restores must not emit selection callbacks or retain stale text.
  MenuUtil={CreateContextMenu=function()end}
  local radios={}
  local function widget()
    local w={}
    function w:SetPoint()end function w:SetSize()end function w:SetWidth()end
    function w:SetText(text)self.text=text end
    function w:SetDefaultText(text)self.default=text end
    function w:OverrideText(text)self.override=text end
    function w:CreateFontString()return widget()end
    function w:SetupMenu(generator)
      local root={CreateRadio=function(_,text,selected,callback,value)
        radios[value]=function()callback(value)end return {}
      end}
      generator(self,root)
    end
    return w
  end
  CreateFrame=function()return widget()end
  local changes=0
  local holder=RGXFramework.dropdown:CreateNestedDropdown(UIParent,{value=1,
    items={{text='One',value=1},{text='Two',value=2}},onChange=function()changes=changes+1 end})
  holder:SetValue(2)
  assert(holder.value==2 and holder.dropdown.override=='Two' and changes==0)
  radios[1]()
  assert(holder.value==1 and holder.dropdown.override=='One' and changes==1)
 `);
 console.log('PASS modern context menu works without selection-dropdown templates or legacy globals');
 console.log('PASS complete legacy menu path and rejection of missing toggle capability');
 console.log('PASS modern selection restores silently and updates its visible label after user selection');
} finally {lua.global.close();}
