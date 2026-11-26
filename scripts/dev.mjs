import {spawn} from 'node:child_process';
await import('./build.mjs');
const option=(name,fallback)=>process.argv.includes(name)?process.argv[process.argv.indexOf(name)+1]:fallback;
const server=spawn('python3',['-m','http.server','--bind',option('--host','127.0.0.1'),'--directory','dist',option('--port','3000')],{stdio:'inherit'});
server.on('exit',code=>process.exit(code??0));
