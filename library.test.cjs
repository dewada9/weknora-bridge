const {test}=require('node:test');const assert=require('node:assert/strict');
let lib={};try{lib=require('./library');}catch(e){if(e.code!=='MODULE_NOT_FOUND')throw e;}
const fixture=()=>({schema_version:1,kb_id:'kb',generated_at:new Date().toISOString(),documents:{d:{title:'BMS [[bad]]',parse_status:'completed',file_hash:'1'}},nodes:[{id:'a',kg:'d',name:'BCU',chunks:['c']},{id:'b',kg:'d',name:'CAN',chunks:['c']}],relations:[{source:'b',target:'a',type:'连接'}]});
function harness(){const files=new Map(),state={};return {files,state,io:{read:async p=>files.get(p)??null,write:async(p,s)=>{files.set(p,s);},rename:async(a,b)=>{if(files.has(b))throw Error('collision');files.set(b,files.get(a));files.delete(a);for(const [p,t]of files)files.set(p,t.split(a).join(b));}},run:async function(s=fixture()){return lib.refresh(s,{base:'http://localhost:9122',kb:'kb'},this.state,this.io,async()=>{});}};}
test('automatic graph keeps source direction, stable paths across title changes, and no upload flag',()=>{
 assert.equal(typeof lib.render,'function');const a=lib.render(fixture(),{base:'http://localhost:9122',kb:'kb'});const s=fixture();s.documents.d.title='renamed';const b=lib.render(s,{base:'http://localhost:9122',kb:'kb'});
 assert.equal(Object.keys(a).length,Object.keys(b).length);
 assert.match(Object.keys(b).find(p=>p.endsWith('.canvas')),/renamed/);
 const c=JSON.parse(Object.entries(a).find(([p])=>p.endsWith('.canvas'))[1]);assert.equal(c.edges.length,1);assert.equal(c.edges[0].toEnd,'arrow');assert.notEqual(c.edges[0].fromNode,c.edges[0].toNode);
 for(const [p,v]of Object.entries(a))if(p.endsWith('.md'))assert.match(v,/weknora_sync: false/);
});
test('refresh is idempotent and preserves manual edits',async()=>{
 assert.equal(typeof lib.refresh,'function');const h=harness();const a=await h.run();assert.ok(a.written>0);
 assert.equal((await h.run()).written,0);const p=[...h.files.keys()].find(x=>x.includes('/资料/'));h.files.set(p,'manual note');
 const s=fixture();s.documents.d.title='changed';const b=await h.run(s);const retained=[...h.files.entries()].find(([,text])=>text==='manual note');assert.ok(retained);assert.ok(b.conflicts.includes(retained[0]));
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
test('canvas filenames lead with readable titles, sanitize paths and distinguish duplicate titles',()=>{
 const s=fixture();s.documents.d.title='电池内阻/SOH: 概览?';s.documents.e={title:s.documents.d.title,parse_status:'completed'};s.nodes.push({id:'e1',kg:'e',name:'电池'});
 const paths=Object.keys(lib.render(s,{base:'https://example.org',kb:'kb'})).filter(p=>p.endsWith('.canvas'));
 assert.equal(paths.length,2);assert.notEqual(paths[0],paths[1]);for(const p of paths){assert.match(p,/简图\/电池内阻-SOH- 概览-/);assert.equal(p.split('/').length,3);}
});
function makeLegacy(h){const p=[...h.files.keys()].find(p=>p.endsWith('.canvas'));const old='06-自动知识库/简图/'+require('crypto').createHash('sha256').update('d').digest('hex').slice(0,20)+'.canvas';h.files.set(old,h.files.get(p));h.files.delete(p);h.state.files[old]=h.state.files[p];delete h.state.files[p];h.state.docs.d={title:'BMS [[bad]]'};for(const [k,t]of h.files){const text=t.split(p).join(old);h.files.set(k,text);h.state.files[k]=lib.hash(k,text);}return old;}
test('legacy canvases migrate through native rename and update owned backlinks idempotently',async()=>{
 const h=harness();await h.run();const old=makeLegacy(h);let renamed=0;const rename=h.io.rename;h.io.rename=async(...args)=>{renamed++;return rename(...args);};const r=await h.run();
 assert.equal(renamed,1);assert.equal(h.files.has(old),false);assert.equal(r.conflicts.length,0);assert.equal((await h.run()).written,0);assert.equal(renamed,1);
});
test('hand edited legacy canvas and destination collisions are preserved without duplicates',async()=>{
 for(const collision of [false,true]){const h=harness();await h.run();const old=makeLegacy(h);if(collision){const dest=Object.keys(lib.render(fixture(),{base:'http://localhost:9122',kb:'kb'})).find(p=>p.endsWith('.canvas'));h.files.set(dest,'unrelated');}else h.files.set(old,'manual graph');const before=h.files.get(old);const r=await h.run();assert.equal(h.files.get(old),before);assert.ok(r.conflicts.includes(old));}
});
test('rename journal recovers after an interrupted native rename',async()=>{
 const h=harness();await h.run();const old=makeLegacy(h);const rename=h.io.rename;h.io.rename=async(a,b)=>{await rename(a,b);throw Error('interrupted after rename');};await assert.rejects(h.run());h.io.rename=rename;const r=await h.run();assert.equal(r.conflicts.length,0);assert.equal(h.files.has(old),false);assert.equal(Object.keys(h.state.canvasMoves||{}).length,0);
});
test('interrupted rename can recover when the remote title changes again',async()=>{
 const h=harness();await h.run();makeLegacy(h);const rename=h.io.rename;h.io.rename=async(a,b)=>{await rename(a,b);throw Error('interrupted');};await assert.rejects(h.run());h.io.rename=rename;const s=fixture();s.documents.d.title='新的资料标题';await h.run(s);const graphs=[...h.files.keys()].filter(p=>p.endsWith('.canvas'));assert.equal(graphs.length,1);assert.match(graphs[0],/新的资料标题/);
});
test('native shortest-link rewriting is reconciled without false manual-edit conflicts',async()=>{
 const h=harness();await h.run();makeLegacy(h);h.io.rename=async(a,b)=>{h.files.set(b,h.files.get(a));h.files.delete(a);for(const [p,t]of h.files)h.files.set(p,t.split(a).join(b.split('/').pop()));};const r=await h.run();assert.equal(r.conflicts.length,0);assert.equal((await h.run()).conflicts.length,0);
});
test('retained graphs still get readable names after remote removal or empty extraction',async()=>{
 for(const removed of [false,true]){const h=harness();await h.run();const old=makeLegacy(h);const s=fixture();s.nodes=[];s.relations=[];if(removed)s.documents={};await h.run(s);assert.equal(h.files.has(old),false);assert.equal([...h.files.keys()].filter(p=>p.endsWith('.canvas')).length,1);}
});
test('source cards and entity folders and files have readable unique names',()=>{
 const f=lib.render(fixture(),{base:'https://example.org',kb:'kb'});const card=Object.keys(f).find(p=>p.includes('/资料/'));assert.match(card,/资料\/BMS/);
 const entities=Object.keys(f).filter(p=>p.includes('/实体/'));assert.equal(entities.length,2);for(const p of entities)assert.match(p,/实体\/BMS[^/]+\/(BCU|CAN) - /);
});
function legacyNotes(h){const changes=[];for(const [p,t]of h.files){if(!p.endsWith('.md')||!/(\/资料\/|\/实体\/)/.test(p))continue;const kg=JSON.parse(t.match(/^source_document_id: (.+)$/m)[1]),nid=t.match(/^source_entity_id: (.+)$/m);const hx=x=>require('crypto').createHash('sha256').update(x).digest('hex').slice(0,20);const old=nid?'06-自动知识库/实体/'+hx(kg)+'/'+hx(JSON.parse(nid[1]))+'.md':'06-自动知识库/资料/'+hx(kg)+'.md';changes.push([p,old,t]);}for(const [p,old,t]of changes){h.files.delete(p);delete h.state.files[p];h.files.set(old,t);}for(const [p,t]of h.files){let text=t;for(const [newPath,old]of changes)text=text.split(newPath).join(old);h.files.set(p,text);h.state.files[p]=lib.hash(p,text);}h.state.notePaths={};return changes;}
test('legacy cards and entities migrate with their links and remain idempotent',async()=>{
 const h=harness();await h.run();const old=legacyNotes(h);const r=await h.run();assert.equal(r.conflicts.length,0);for(const [,p]of old)assert.equal(h.files.has(p),false);assert.equal((await h.run()).written,0);assert.equal(Object.keys(h.state.noteMoves||{}).length,0);
});
test('manually edited source card is renamed without replacing its body',async()=>{
 const h=harness();await h.run();const changes=legacyNotes(h),entry=changes.find(([,p])=>p.includes('/资料/'));h.files.set(entry[1],h.files.get(entry[1])+'\nMY MANUAL NOTE');const r=await h.run();const p=[...h.files.keys()].find(p=>p.includes('/资料/'));assert.match(p,/资料\/BMS/);assert.match(h.files.get(p),/MY MANUAL NOTE/);assert.ok(r.conflicts.includes(p));
});
test('note rename journals recover native shortest-link updates after interruption',async()=>{
 const h=harness();await h.run();legacyNotes(h);const rename=h.io.rename;h.io.rename=async(a,b)=>{await rename(a,b);throw Error('crash');};await assert.rejects(h.run());h.io.rename=rename;const r=await h.run();assert.equal(r.conflicts.length,0);assert.equal(Object.keys(h.state.noteMoves||{}).length,0);
});
test('native Markdown links without extensions migrate without false conflicts',async()=>{
 const h=harness();await h.run();legacyNotes(h);h.io.rename=async(a,b)=>{h.files.set(b,h.files.get(a));h.files.delete(a);for(const [p,t]of h.files)h.files.set(p,t.split(a).join(b.split('/').pop().replace(/\.md$/,'')));};assert.equal((await h.run()).conflicts.length,0);assert.equal((await h.run()).written,0);
});
test('existing note destinations are not overwritten or duplicated',async()=>{
 const h=harness();await h.run();const changes=legacyNotes(h),entry=changes.find(([,p])=>p.includes('/资料/'));h.files.set(entry[0],'unrelated destination');const r=await h.run();assert.equal(h.files.get(entry[0]),'unrelated destination');assert.ok(h.files.has(entry[1]));assert.ok(r.conflicts.includes(entry[1]));
});
test('manual edits arriving during native note rename never become owned content',async()=>{
 const h=harness();await h.run();legacyNotes(h);const rename=h.io.rename;let edited;h.io.rename=async(a,b)=>{await rename(a,b);if(!edited){edited=b;h.files.set(b,h.files.get(b)+'\nUSER EDIT DURING RENAME');}};const r=await h.run();assert.match(h.files.get(edited),/USER EDIT DURING RENAME/);assert.ok(r.conflicts.includes(edited));
});
test('interrupted rename followed by manual destination edit does not recreate the old note',async()=>{
 const h=harness();await h.run();legacyNotes(h);const rename=h.io.rename;let from,to;h.io.rename=async(a,b)=>{await rename(a,b);from=a;to=b;h.files.set(b,'USER EDIT AFTER CRASH');throw Error('crash');};await assert.rejects(h.run());h.io.rename=rename;await h.run();assert.equal(h.files.get(to),'USER EDIT AFTER CRASH');assert.equal(h.files.has(from),false);await h.run();assert.equal(h.files.has(from),false);
});
