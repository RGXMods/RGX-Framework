import assert from 'node:assert/strict';
import luaparse from 'luaparse';
import {createAuditLua} from '../../contract/engine/audit-lua.mjs';
const {auditLuaSource}=createAuditLua(luaparse.parse);
for(const text of ['Preview — disabled','Profile · Français','语言 프로필','Привет 😀']) {
 const source=`local caption = ${JSON.stringify(text)}\nlocal value = 1`;
 assert.deepEqual(auditLuaSource(source,'utf8.lua'),[],`valid UTF-8 rejected: ${text}`);
}
const unsafe=auditLuaSource('local caption = "语言 —"\nlocal aura = C_UnitAuras["GetAuraDataByIndex"]("target", 1)','unsafe.lua');
assert(unsafe.some(x=>x.detector==='raw_aura_plumbing' && x.line===2));
assert(!unsafe.some(x=>x.detector==='lua_parse_error'));
assert(auditLuaSource('local caption = "语言"\nif then','invalid.lua').some(x=>x.detector==='lua_parse_error' && x.line===2));
console.log('AUDIT ENCODING OK valid UTF-8, static API names, precise lines, invalid Lua fail-closed');
