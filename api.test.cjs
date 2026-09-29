const {test}=require('node:test');const assert=require('node:assert/strict');const http=require('http');const zlib=require('zlib');const {Api}=require('./api');
async function withServer(handler,run){const s=http.createServer(handler);await new Promise(r=>s.listen(0,'127.0.0.1',r));const a=new Api({base:'http://127.0.0.1:'+s.address().port,kb:'kb',key:'test-only'});try{await run(a);}finally{a.close?.();s.closeAllConnections();await new Promise(r=>s.close(r));}}
test('API requests accept compressed JSON and reuse one connection',async()=>{
 const ports=[];await withServer((q,r)=>{ports.push(q.socket.remotePort);assert.match(q.headers['accept-encoding']||'',/gzip/);r.writeHead(200,{'Content-Encoding':'gzip'});r.end(zlib.gzipSync(JSON.stringify({success:true,data:{id:'a'}})));},async a=>{
  assert.equal(typeof a.close,'function');assert.equal((await a.get('a')).id,'a');assert.equal((await a.get('a')).id,'a');assert.equal(ports[0],ports[1]);
 });
});
test('decoded response size remains bounded when using compression',async()=>{
 await withServer((q,r)=>{r.writeHead(200,{'Content-Encoding':'gzip'});r.end(zlib.gzipSync(JSON.stringify({data:'x'.repeat(9*1024*1024)})));},async a=>{
  await assert.rejects(a.get('a'),/返回内容过大/);
 });
});

test('lost response on a reused connection is not classified as definitely unsent',async()=>{
 let n=0;await withServer((q,r)=>{if(++n===1)r.end('{"success":true}');else q.socket.destroy();},async a=>{
  await a.request('GET','/api/v1/ping');
  await assert.rejects(a.request('POST','/api/v1/create',{text:'x'}),e=>e.definitelyNotSent===false);
 });
});
