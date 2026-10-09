const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=__dirname;const types={'.css':'text/css; charset=utf-8','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{let file;try{file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));}catch{res.writeHead(400).end();return;}if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(file===root)file=path.join(root,'index.html');fs.readFile(file,(err,bytes)=>{if(err){res.writeHead(404).end('Not found');return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(bytes);});});
if(require.main===module)server.listen(8765,'127.0.0.1',()=>console.log('Open http://localhost:8765. Ctrl+C to stop.'));
module.exports=server;
