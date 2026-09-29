const {test}=require('node:test');const assert=require('node:assert/strict');
let lib={};try{lib=require('./library');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const fixture=()=>({schema_version:1,kb_id:'kb',generated_at:new Date().toISOString(),documents:{d:{title:'BMS [[bad]]',parse_status:'completed',file_hash:'1'}},nodes:[{id:'a',kg:'d',name:'BCU',chunks:['c']},{id:'b',kg:'d',name:'CAN',chunks:['c']}],relations:[{source:'b',target:'a',type:'连接'}]});
function harness(){const files=new Map(),state={};return {files,state,io:{read:async p=>files.get(p)??null,write:async(p,s)=>{files.set(p,s);}},run:async function(s=fixture()){return lib.refresh(s,{base:'http://localhost:9122',kb:'kb'},this.state,this.io,async()=>{});}};}
test('automatic graph keeps source direction, stable paths across title changes, and no upload flag',()=>{
 assert.equal(typeof lib.render,'function');const a=lib.render(fixture(),{base:'http://localhost:9122',kb:'kb'});const s=fixture();s.documents.d.title='renamed';const b=lib.render(s,{base:'http://localhost:9122',kb:'kb'});
 assert.deepEqual(Object.keys(a).sort(),Object.keys(b).sort());
 const c=JSON.parse(Object.entries(a).find(([p])=>p.endsWith('.canvas'))[1]);assert.equal(c.edges.length,1);assert.equal(c.edges[0].toEnd,'arrow');assert.notEqual(c.edges[0].fromNode,c.edges[0].toNode);
 for(const [p,v]of Object.entries(a))if(p.endsWith('.md'))assert.match(v,/weknora_sync: false/);
});
test('refresh is idempotent and preserves manual edits',async()=>{
 assert.equal(typeof lib.refresh,'function');const h=harness();const a=await h.run();assert.ok(a.written>0);
 assert.equal((await h.run()).written,0);const p=[...h.files.keys()].find(x=>x.includes('/资料/'));h.files.set(p,'manual note');
 const s=fixture();s.documents.d.title='changed';const b=await h.run(s);assert.equal(h.files.get(p),'manual note');assert.ok(b.conflicts.includes(p));
});
test('invalid scope, stale snapshots and dangling edges fail before writing',async()=>{
 assert.equal(typeof lib.refresh,'function');for(const mutate of [s=>s.kb_id='other',s=>s.generated_at='2000-01-01T00:00:00Z',s=>s.relations[0].target='missing']){const h=harness(),s=fixture();mutate(s);await assert.rejects(h.run(s));assert.equal(h.files.size,0);}
});
test('formatting-only Canvas changes are accepted, content changes are protected',async()=>{
 assert.equal(typeof lib.refresh,'function');const h=harness();await h.run();const p=[...h.files.keys()].find(x=>x.endsWith('.canvas'));h.files.set(p,JSON.stringify(JSON.parse(h.files.get(p)),null,4));
 assert.equal((await h.run()).conflicts.length,0);const c=JSON.parse(h.files.get(p));c.nodes[0].text='edited';h.files.set(p,JSON.stringify(c));assert.ok((await h.run()).conflicts.includes(p));
});
test('remote removal retains local files with explicit archived status',async()=>{
 assert.equal(typeof lib.refresh,'function');const h=harness();await h.run();const p=[...h.files.keys()].find(x=>x.includes('/资料/'));const s=fixture();s.documents={};s.nodes=[];s.relations=[];await h.run(s);assert.match(h.files.get(p),/远端已移出/);
});
test('partial runs resume without overwriting unowned existing files',async()=>{
 assert.equal(typeof lib.refresh,'function');const h=harness();const s=fixture();const files=lib.render(s,{base:'http://localhost:9122',kb:'kb'});const p=Object.keys(files).find(x=>x.includes('/资料/'));h.files.set(p,'existing unrelated');const r=await h.run(s);assert.ok(r.conflicts.includes(p));assert.equal(h.files.get(p),'existing unrelated');
});
test('Chinese central concept is not discarded as punctuation',()=>{
 const s=fixture();s.nodes=[{id:'a',kg:'d',name:'电池管理系统'},...['CAN','传感器','接触器'].map((name,i)=>({id:'n'+i,kg:'d',name}))];s.relations=s.nodes.slice(1).map(n=>({source:'a',target:n.id,type:'连接'}));
 const f=lib.render(s,{base:'http://localhost:9122',kb:'kb'});const c=JSON.parse(Object.entries(f).find(([p])=>p.endsWith('.canvas'))[1]);assert.equal(c.edges.length,3);assert.match(c.nodes.find(n=>n.color==='4').text,/电池管理系统/);
});
test('reordered equivalent graph does not rewrite generated notes',async()=>{
 const h=harness(),s=fixture();s.nodes.push({id:'c',kg:'d',name:'Power',attributes:['B','A'],chunks:['2','1']});s.relations.push({source:'a',target:'c',type:'使用'});await h.run(s);
 s.nodes.reverse();s.relations.reverse();s.nodes[0].attributes.reverse();s.nodes[0].chunks.reverse();assert.equal((await h.run(s)).written,0);
});
test('Canvas object key reordering alone is not a user edit',async()=>{
 const h=harness();await h.run();const p=[...h.files.keys()].find(x=>x.endsWith('.canvas'));const c=JSON.parse(h.files.get(p));h.files.set(p,JSON.stringify({edges:c.edges,nodes:c.nodes}));assert.equal((await h.run()).conflicts.length,0);
});
