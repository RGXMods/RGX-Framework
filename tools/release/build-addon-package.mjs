#!/usr/bin/env node
// Source-only packer for thin consumers: TOC/XML load graph plus runtime assets.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,lstatSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,relative,isAbsolute,join,dirname,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url));
const {zipSync,unzipSync}=createRequire(join(here,'../ci/package.json'))('fflate');
const [input,tocName,outDir]=process.argv.slice(2);
assert(input && tocName && outDir,'usage: build-addon-package <checkout> <toc> <output>');
const root=resolve(input),out=resolve(outDir),folder=basename(tocName,'.toc');
const files=new Map();
const excluded=new Set(['.git','.github','.gitlab','.reference','.agents','.claude','.opencode','graphify-out','node_modules','tools','docs','artifacts','.release']);
function add(file) {
 const full=resolve(root,file.replaceAll('\\','/')),key=relative(root,full).replaceAll('\\','/');
 assert(!isAbsolute(key) && !key.split('/').includes('..') && !key.split('/').some(x=>excluded.has(x)),'unsafe runtime path: '+file);
 assert(!lstatSync(full).isSymbolicLink(),'runtime symlinks are not packaged');
 if(files.has(key))return;
 const bytes=readFileSync(full);files.set(key,bytes);
 if(key.endsWith('.xml'))for(const m of bytes.toString('utf8').replace(/<!--[\s\S]*?-->/g,'').matchAll(/<(?:Script|Include)\b[^>]*\bfile\s*=\s*["']([^"']+)["']/gi))add(join(dirname(key),m[1]));
}
add(tocName);
const toc=files.get(tocName.replaceAll('\\','/')).toString('utf8');
const version=toc.match(/^## Version:\s*(\S+)/m)?.[1]?.replace(/^v/,'');
assert(version,'TOC Version missing');
for(const line of toc.split(/\r?\n/)) {
 const file=line.trim().replace(/^\[AllowLoadGameType[^\]]*\]\s*/,'');
 if(file && !file.startsWith('#'))add(file);
}
function assets(dir='') {
 for(const entry of readdirSync(join(root,dir),{withFileTypes:true})) {
  if(excluded.has(entry.name) || entry.name.startsWith('.'))continue;
  const file=join(dir,entry.name);
  assert(!entry.isSymbolicLink(),'runtime asset symlinks are not packaged');
  if(entry.isDirectory())assets(file);
  else if(/\.(tga|blp|ttf|otf|ogg|mp3|wav)$/i.test(file))add(file);
 }
}
assets();
for(const file of readdirSync(root))if(/^LICENSE(?:\..*)?$/.test(file))add(file);
const entries={},manifest=[];
for(const [file,bytes]of [...files].sort(([a],[b])=>a.localeCompare(b))) {
 entries[`${folder}/${file}`]=bytes;
 manifest.push({file,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const archive=zipSync(entries,{level:6,mtime:new Date('2000-01-01T00:00:00Z')});
const decoded=unzipSync(archive);
assert(Object.keys(decoded).length===manifest.length);
for(const row of manifest)assert(createHash('sha256').update(decoded[folder+'/'+row.file]).digest('hex')===row.sha256);
mkdirSync(out,{recursive:true});
const name=`${folder}-v${version}`;
writeFileSync(join(out,name+'.zip'),archive);
writeFileSync(join(out,name+'.manifest.json'),JSON.stringify({folder,version,runtimeFiles:manifest.length,files:manifest},null,2)+'\n');
console.log(`CONSUMER PACKAGE OK ${name}.zip — ${manifest.length} allowlisted runtime/media/license files`);
