const {test}=require('node:test');
const assert=require('node:assert/strict');
const remoteHash=b=>require('crypto').createHash('md5').update(b).digest('hex');
let core={}; try { core=require('./core.js'); } catch(e) { if(e.code!=='MODULE_NOT_FOUND')throw e; }
test('auto sync requires explicit flag and excludes templates',()=>{
 assert.equal(typeof core.autoEligible,'function');
 assert.equal(core.autoEligible('02-项目/a.md',{weknora_sync:true},true),true);
 for(const [p,f,g] of [['02-项目/a.md',{},true],['90-模板/a.md',{weknora_sync:true},true],['a.md',{weknora_sync:'true'},true],['a.md',{weknora_sync:true},false]]) assert.equal(core.autoEligible(p,f,g),false);
});
test('generated library never automatically uploads even when flagged',()=>{
 assert.equal(core.autoEligible('06-自动知识库/资料/a.md',{weknora_sync:true},true),false);
});

test('intake folder publishes supported files but ordinary drafts stay local',()=>{
 for(const ext of ['md','txt','pdf','docx','doc','png','jpg','jpeg','webp'])assert.equal(core.autoEligible('01-收件箱/待入库/a.'+ext,{},true),true,ext);
 assert.equal(core.autoEligible('01-收件箱/a.md',{},true),false);
 assert.equal(core.autoEligible('99-附件/a.pdf',{},true),false);
 assert.equal(core.autoEligible('01-收件箱/待入库/a.xlsm',{},true),false);
 assert.equal(core.autoEligible('01-收件箱/待入库/a.md',{weknora_sync:false},true),false);
 assert.equal(core.autoEligible('01-收件箱/待入库/a.pdf',{},true,{},false),false);
});
test('automatic retries back off but changed content is retried promptly',()=>{
 assert.equal(typeof core.retryReady,'function');assert.equal(typeof core.recordFailure,'function');
 const r={};core.recordFailure(r,'offline',123,1000);
 assert.equal(core.retryReady(r,123,1001),false);
 assert.equal(core.retryReady(r,124,1001),true);
 assert.equal(core.retryReady(r,123,61000),true);
 for(let i=0;i<20;i++)core.recordFailure(r,'offline',123,1000);
 assert.equal(r.nextRetryAt,1000+30*60000);
});
test('published attachments keep syncing after move; generated and conflict files never do',()=>{
 assert.equal(core.autoEligible('04-资料索引/资料/a.pdf',{},true,{autoManaged:true}),true);
 for(const path of ['05-WeKnora图谱/实体/a.md','06-自动知识库/a.md','98-归档/a.md','90-模板/a.md','01-收件箱/待入库/.hidden/a.md','01-收件箱/待入库/a.sync-conflict-20260929-101000-PC.md'])assert.equal(core.autoEligible(path,{weknora_sync:true},true,{autoManaged:true}),false,path);
});
function harness(){
 const state={records:{}};let seq=0;const rows=new Map();
 const api={async create(path,bytes,source){const row={id:String(++seq),file_hash:remoteHash(bytes),parse_status:'completed',metadata:{obsidian_source:source}};rows.set(row.id,row);return row;},async get(id){return rows.get(id);},async replace(id,path,bytes,expected,source){assert.equal(rows.get(id).file_hash,expected);const row={id,file_hash:remoteHash(bytes),parse_status:'completed',metadata:{obsidian_source:source}};rows.set(id,row);return row;},async find(source){return [...rows.values()].filter(r=>r.metadata.obsidian_source===source);}};
 return {state,api,rows,engine:()=>new core.SyncEngine(state,api,async()=>{})};
}
test('upload edit and restart retain one remote document',async()=>{
 assert.equal(typeof core.SyncEngine,'function');const h=harness();
 await h.engine().sync('a.md',Buffer.from('first'));
 await h.engine().sync('a.md',Buffer.from('second'));
 assert.equal(h.rows.size,1);assert.equal(h.state.records['a.md'].id,'1');
 assert.equal((await h.engine().sync('a.md',Buffer.from('second'))).action,'unchanged');
});
test('remote edits are not overwritten; interrupted create reconciles by identity',async()=>{
 assert.equal(typeof core.SyncEngine,'function');const h=harness();
 await h.engine().sync('a.md',Buffer.from('first'));
 h.rows.get('1').file_hash='someone-else';
 await assert.rejects(h.engine().sync('a.md',Buffer.from('second')),/远端/);
 const j=harness();const original=j.api.create;j.api.create=async(...args)=>{await original(...args);throw Error('timeout');};
 await assert.rejects(j.engine().sync('a.md',Buffer.from('first')));
 j.api.create=original;await j.engine().sync('a.md',Buffer.from('first'));
 assert.equal(j.rows.size,1);
});
test('rename retains mapping; pending parse cannot be replaced',async()=>{
 assert.equal(typeof core.SyncEngine,'function');const h=harness();const e=h.engine();
 await e.sync('a.md',Buffer.from('a'));await e.rename('a.md','b.md');
 assert.equal(h.state.records['b.md'].id,'1');assert.equal(h.state.records['a.md'],undefined);
 h.rows.get('1').parse_status='processing';
 await assert.rejects(e.sync('b.md',Buffer.from('b')),/解析/);
});
test('folder rename preserves all child identities',async()=>{const h=harness();const e=h.engine();await e.sync('dir/a.md',Buffer.from('a'));await e.rename('dir','moved');assert.equal(h.state.records['moved/a.md'].id,'1');assert.equal(h.state.records['dir/a.md'],undefined);});

test('finalizing document is never overwritten by an edit',async()=>{
 const h=harness();await h.engine().sync('a.md',Buffer.from('a'));h.rows.get('1').parse_status='finalizing';
 await assert.rejects(h.engine().sync('a.md',Buffer.from('b')),/解析/);
 assert.equal(h.rows.get('1').file_hash,remoteHash(Buffer.from('a')));
});
test('queued automatic work rechecks consent before creating or replacing',async()=>{
 const h=harness(),e=h.engine();let release;e.tail=new Promise(r=>release=r);let allowed=true;
 const pending=e.sync('a.md',Buffer.from('a'),()=>allowed);allowed=false;release();
 assert.equal((await pending).action,'deferred');assert.equal(h.rows.size,0);
 allowed=true;await e.sync('a.md',Buffer.from('a'));const get=h.api.get;h.api.get=async id=>{allowed=false;return get(id);};
 assert.equal((await e.sync('a.md',Buffer.from('changed'),()=>allowed)).action,'deferred');
 assert.equal(h.rows.get('1').file_hash,remoteHash(Buffer.from('a')));
});

test('file names rejected before multipart construction',async()=>{
 const h=harness();
 for(const path of ['../outside.md','/absolute.md','a\\b.md','a\r\nb.md','a\u0000b.md'])await assert.rejects(h.engine().sync(path,Buffer.from('a')),/路径/);
 assert.equal(h.rows.size,0);
});
test('ChatGPT title follows frontmatter on upload and unchanged retry without duplicate',async()=>{
 const h=harness();let updates=0;h.api.updateTitle=async(id,title)=>{updates++;h.rows.get(id).title=title;return h.rows.get(id);};
 const bytes=Buffer.from('---\nsource: "ChatGPT Tasks"\ntitle: "2026-09-28 BMS与工程AI（5则）"\n---\n正文');
 await h.engine().sync('brief.md',bytes);
 assert.equal(h.rows.get('1').title,'2026-09-28 BMS与工程AI（5则）');
 h.rows.get('1').title='wrong-title.md';
 assert.equal((await h.engine().sync('brief.md',bytes)).action,'unchanged');
 assert.equal(h.rows.get('1').title,'2026-09-28 BMS与工程AI（5则）');assert.equal(h.rows.size,1);assert.equal(updates,2);
});
test('failed title update retries the same document without replacing its file',async()=>{
 const h=harness();h.api.updateTitle=async()=>{throw Error('title timeout')};
 const bytes=Buffer.from('---\nsource: "ChatGPT Tasks"\ntitle: "BMS专题"\n---\n正文');
 await assert.rejects(h.engine().sync('brief.md',bytes),/title timeout/);
 assert.equal(h.state.records['brief.md'].id,'1');
 h.api.updateTitle=async(id,title)=>Object.assign(h.rows.get(id),{title});
 await h.engine().sync('brief.md',bytes);assert.equal(h.rows.size,1);
});
test('definitely unsent create can retry after network recovery',async()=>{const h=harness();const create=h.api.create;h.api.create=async()=>{throw Object.assign(Error('offline'),{definitelyNotSent:true});};await assert.rejects(h.engine().sync('a.md',Buffer.from('a')));h.api.create=create;await h.engine().sync('a.md',Buffer.from('a'));assert.equal(h.rows.size,1);});
test('committed replacement with dropped response reconciles by attempt token',async()=>{const h=harness();await h.engine().sync('a.md',Buffer.from('a'));const replace=h.api.replace;h.api.replace=async(...args)=>{const r=await replace(...args);r.metadata.obsidian_attempt=args[5];throw Error('timeout');};await assert.rejects(h.engine().sync('a.md',Buffer.from('b')));h.api.replace=replace;await h.engine().sync('a.md',Buffer.from('b'));assert.equal(h.state.records['a.md'].digest,core.hash(Buffer.from('b')));assert.equal(h.rows.size,1);});
test('retained attempt token cannot mask subsequent external modification',async()=>{const h=harness();await h.engine().sync('a.md',Buffer.from('a'));const replace=h.api.replace;h.api.replace=async(...args)=>{const r=await replace(...args);r.metadata.obsidian_attempt=args[5];throw Error('timeout');};await assert.rejects(h.engine().sync('a.md',Buffer.from('b')));h.rows.get('1').file_hash=remoteHash(Buffer.from('external edit'));h.api.replace=replace;await assert.rejects(h.engine().sync('a.md',Buffer.from('c')),/远端/);});

test('unchanged bytes moved to another project refresh path metadata under the same ID',async()=>{const h=harness(),e=h.engine();let replacements=0;const replace=h.api.replace;h.api.replace=async(...args)=>{replacements++;return replace(...args)};await e.sync('01-收件箱/待入库/a_R2.pdf',Buffer.from('content'));await e.rename('01-收件箱/待入库/a_R2.pdf','02-项目/示例项目/a_R3.pdf');await e.sync('02-项目/示例项目/a_R3.pdf',Buffer.from('content'));assert.equal(replacements,1);assert.equal(h.rows.size,1);assert.equal(h.state.records['02-项目/示例项目/a_R3.pdf'].uploadedPath,'02-项目/示例项目/a_R3.pdf');});
test('lost rename response reconciles uploaded path without a second replacement',async()=>{const h=harness(),e=h.engine();await e.sync('a.md',Buffer.from('a'));await e.rename('a.md','b.md');let calls=0;const replace=h.api.replace;h.api.replace=async(...args)=>{calls++;const r=await replace(...args);r.metadata.obsidian_attempt=args[5];throw Error('timeout');};await assert.rejects(e.sync('b.md',Buffer.from('a')));h.api.replace=async(...args)=>{calls++;return replace(...args)};await e.sync('b.md',Buffer.from('a'));assert.equal(calls,1);assert.equal(h.state.records['b.md'].uploadedPath,'b.md');});
