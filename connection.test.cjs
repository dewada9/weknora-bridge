const {test}=require('node:test');const assert=require('node:assert/strict');
const {resolveConnection}=require('./connection');
test('connection uses the native vault secret after a fresh process',async()=>{
 const settings=JSON.parse(JSON.stringify({base:'https://example.org',kb:'kb',secretName:'weknora-api'}));
 const c=await resolveConnection({secretStorage:{getSecret:n=>n==='weknora-api'?'secret':null}},settings);
 assert.deepEqual(c,{base:'https://example.org',kb:'kb',key:'secret'});assert.ok(!JSON.stringify(settings).includes('"secret"'));
});
test('missing secret gives an actionable settings error',async()=>{
 await assert.rejects(()=>resolveConnection({secretStorage:{getSecret:()=>null}},{base:'https://example.org',kb:'kb',secretName:'missing'}),/设置/);
});
test('rejects credentials embedded in URL and empty knowledge scope',async()=>{
 const app={secretStorage:{getSecret:()=> 'secret'}};
 await assert.rejects(()=>resolveConnection(app,{base:'https://user:pass@example.org',kb:'kb',secretName:'x'}));
 await assert.rejects(()=>resolveConnection(app,{base:'https://example.org',kb:'',secretName:'x'}));
});
