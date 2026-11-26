import {cp, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
const revision = createHash('sha256');
for (const name of (await readdir('public',{recursive:true,withFileTypes:true}))
   .filter(entry=>entry.isFile()).map(entry=>entry.parentPath+'/'+entry.name).sort()) {
  revision.update(name);
  revision.update(await readFile(name));
}
const hash = revision.digest('hex').slice(0,16);
await writeFile('dist/sw.js',(await readFile('public/sw.js','utf8')).replace('development',hash));
