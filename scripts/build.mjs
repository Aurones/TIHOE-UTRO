import {cp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
const revision = createHash('sha256');
for (const name of ['index.html','app.js','style.css','api.js','calc.js','sw.js']) revision.update(await readFile('public/'+name));
const hash = revision.digest('hex').slice(0,16);
await writeFile('dist/sw.js',(await readFile('public/sw.js','utf8')).replace('development',hash));
