import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
const root=join(dirname(fileURLToPath(import.meta.url)),'../..');
const parent=process.platform==='win32'?join(tmpdir(),'opencode'):tmpdir();
const tmp=mkdtempSync(join(parent,'rgx-consumer-package-'));
const addon=join(tmp,'addon'),out=join(tmp,'out');
function file(path,contents){const full=join(addon,path);mkdirSync(dirname(full),{recursive:true});writeFileSync(full,contents);}
file('TestAddon.toc','## Interface: 16001\n## Version: 1.0.0-beta.1\nLoader.xml\n[AllowLoadGameType 1] Loader.xml\n');
file('Loader.xml','<Ui><Include file="ui/Widgets.xml"/></Ui>');
file('ui/Widgets.xml','<Ui><Script file="../code/main.lua"/></Ui>');
file('code/main.lua','local enabled = false');
file('media/icon.tga',Buffer.from([1,2,3,4]));
file('LICENSE','Fixture license');
file('.framework-source/media/embedded.tga',Buffer.from([5,6]));
file('tools/private.lua','error("not runtime")');
const command=()=>spawnSync(process.execPath,[join(root,'tools/release/build-addon-package.mjs'),addon,'TestAddon.toc',out],{encoding:'utf8'});
const first=command();assert.equal(first.status,0,first.stderr);
const archive=readFileSync(join(out,'TestAddon-v1.0.0-beta.1.zip'));
const entries=unzipSync(archive);
assert.equal(Object.keys(entries).length,6);
assert(entries['TestAddon/code/main.lua'] && entries['TestAddon/media/icon.tga'] && entries['TestAddon/LICENSE']);
assert(!Object.keys(entries).some(x=>x.includes('.framework-source')||x.includes('/tools/')));
assert.equal(command().status,0);
assert(archive.equals(readFileSync(join(out,'TestAddon-v1.0.0-beta.1.zip'))),'package is not deterministic');
file('TestAddon.toc','## Version: 1.0.0-beta.1\n../outside.lua\n');
const unsafe=command();assert.notEqual(unsafe.status,0);assert.match(unsafe.stderr,/unsafe runtime path/);
// A root Bindings.xml is loaded by the client from the addon folder without a TOC entry (live ab5cb850a3f6:
// Interface/AddOns/Blizzard_PingUI/Bindings.xml ships while Blizzard_PingUI.toc never lists it), so it is packaged,
// together with what it includes; other unlisted files are not.
{
  const keyed=join(tmp,'keyed'),keyedOut=join(tmp,'keyed-out');
  const put=(path,contents)=>{const full=join(keyed,path);mkdirSync(dirname(full),{recursive:true});writeFileSync(full,contents);};
  put('KeyAddon.toc','## Interface: 16001\n## Version: 2.0.0\nKeyAddon.lua\n');
  put('KeyAddon.lua','local x = 1');
  put('Bindings.xml','<Bindings><Binding name="KEYADDON_TOGGLE">KeyAddon_Toggle()</Binding></Bindings>');
  put('old/unused.lua','error("not loaded")');
  const r=spawnSync(process.execPath,[join(root,'tools/release/build-addon-package.mjs'),keyed,'KeyAddon.toc',keyedOut],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const keyedEntries=unzipSync(readFileSync(join(keyedOut,'KeyAddon-v2.0.0.zip')));
  assert(keyedEntries['KeyAddon/Bindings.xml'],'the root Bindings.xml is packaged');
  assert(!keyedEntries['KeyAddon/old/unused.lua'],'files the client never loads stay out');
}
// Include only the exact folder marker so a fresh install has a place for custom sounds.
{
  file('TestAddon.toc','## Version: 1.0.0-beta.1\nLoader.xml\n');
  file('sounds/user/README.txt','Put custom audio files here.');
  file('sounds/user/notes.txt','Not part of the release.');
  file('sounds/game/README.txt','Not the folder marker.');
  file('docs/README.txt','Internal documentation stays out.');
  file('old/sounds/user/README.txt','A nested copy is not the folder marker.');
  const marked=command();assert.equal(marked.status,0,marked.stderr);
  const markedArchive=readFileSync(join(out,'TestAddon-v1.0.0-beta.1.zip'));
  const markedEntries=unzipSync(markedArchive);
  assert.equal(Buffer.from(markedEntries['TestAddon/sounds/user/README.txt'] ?? []).toString(),'Put custom audio files here.');
  assert(!markedEntries['TestAddon/sounds/user/notes.txt'],'other text files stay out');
  assert(!markedEntries['TestAddon/sounds/game/README.txt'],'a README outside the user sound folder stays out');
  assert(!markedEntries['TestAddon/docs/README.txt'],'internal documentation stays out');
  assert(!markedEntries['TestAddon/old/sounds/user/README.txt'],'nested copies stay out');
  const manifest=JSON.parse(readFileSync(join(out,'TestAddon-v1.0.0-beta.1.manifest.json'),'utf8'));
  assert.equal(manifest.runtimeFiles,Object.keys(markedEntries).length);
  const marker=manifest.files.filter(row=>row.file==='sounds/user/README.txt');
  assert.equal(marker.length,1,'the marker has one manifest entry');
  assert.equal(marker[0].sha256,createHash('sha256').update(markedEntries['TestAddon/sounds/user/README.txt']).digest('hex'));
  assert.equal(command().status,0);
  assert(markedArchive.equals(readFileSync(join(out,'TestAddon-v1.0.0-beta.1.zip'))),'the folder marker preserves deterministic packaging');
}
console.log('CONSUMER PACKER OK recursive XML, conditional entries, assets/license, tooling exclusion, deterministic ZIP, escape rejection, root Bindings.xml, user-sound folder marker');
