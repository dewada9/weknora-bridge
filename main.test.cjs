const {test}=require('node:test');const assert=require('node:assert/strict');const Module=require('module');const fs=require('fs');const path=require('path');
class TFile{constructor(p){this.path=p;this.extension=p.split('.').pop();this.stat={mtime:123};}}
const source=new Module(path.join(__dirname,'main.js'),module);source.filename=path.join(__dirname,'main.js');source.paths=module.paths;
const notices=[];
source.require=id=>id==='obsidian'?{Plugin:class{},Modal:class{},Setting:class{},PluginSettingTab:class{},FuzzySuggestModal:class{},TFile,Notice:class{constructor(text){notices.push(text);}}}:id==='./credential'?{credential:async()=>{throw Error('test missing credential');}}:require(id);
source._compile(fs.readFileSync(source.filename,'utf8'),source.filename);const Plugin=source.exports;
function setup(){const p=new Plugin();p.data={autoSync:true,autoInbox:true,records:{}};p.inflight=new Set();p.timers=new Map();p.status={setText(){}};p.persist=async()=>{};p.app={metadataCache:{getFileCache:()=>({frontmatter:{}})},vault:{}};return p;}
test('missing credentials do not remove settings, commands or file context menu',async()=>{
 const p=setup(),events=[],commands=[],tabs=[];global.window={setInterval:()=>1};
 p.loadData=async()=>({});p.saveData=async()=>{};p.addSettingTab=x=>tabs.push(x);p.addStatusBarItem=()=>({setText(){}});p.addRibbonIcon=()=>{};p.addCommand=x=>commands.push(x.id);p.registerEvent=()=>{};p.registerInterval=()=>{};
 p.app.workspace={on:(event,fn)=>{events.push(event);return{};},onLayoutReady:()=>{}};p.app.metadataCache.on=()=>({});p.app.vault.on=()=>({});
 await p.onload();assert.equal(tabs.length,1);assert.ok(events.includes('file-menu'));assert.ok(commands.includes('connection-settings'));p.onunload();
});
test('plugin scans PDF intake and leaves unmarked drafts alone',()=>{
 const p=setup();const file=new TFile('01-收件箱/待入库/a.pdf');p.app.vault.getFiles=()=>[file,new TFile('01-收件箱/draft.md')];let found=[];p.schedule=f=>found.push(f.path);p.scan();assert.deepEqual(found,[file.path]);
 p.data.autoInbox=false;found=[];p.scan();assert.equal(found.length,0);
});
test('reconnection and unresolved move journals block upload including manual calls',async()=>{
 for(const flags of [{connecting:true},{movesReady:false}]){const p=setup(),f=new TFile('Published/a.md');Object.assign(p,flags);let submissions=0;p.engine={sync:async()=>{submissions++;return{};}};p.app.vault.readBinary=async()=>Buffer.from('note');await p.upload(f,false);assert.equal(submissions,0);}
});
test('successful manual publication remains managed for future edits',async()=>{
 const p=setup(),f=new TFile('02-项目/a.md');p.app.vault.readBinary=async()=>Buffer.from('note');p.engine={sync:async()=>{p.data.records[f.path]={id:'same'};return {id:'same',parse_status:'completed'};}};
 await p.upload(f);assert.equal(p.data.records[f.path].autoManaged,true);assert.equal(p.eligible(f),true);
});
test('move during file read does not submit stale path or duplicate original',async()=>{
 const p=setup(),f=new TFile('01-收件箱/待入库/a.md');let finishRead,submitted=0;
 p.app.vault.readBinary=()=>new Promise(r=>finishRead=r);p.app.vault.getAbstractFileByPath=k=>k===f.path?f:null;
 p.engine={sync:async(path,bytes,guard)=>{if(guard&&!guard())return {action:'deferred'};submitted++;return {id:'duplicate'};}};
 p.schedule=()=>{};const result=p.upload(f,true);f.path='02-项目/a.md';finishRead(Buffer.from('text'));await result;
 assert.equal(submitted,0);assert.deepEqual(p.data.records,{});
});
test('cancelled manual draft upload clearly asks to repeat rather than silently waiting',async()=>{
 const p=setup(),f=new TFile('01-收件箱/draft.md');p.app.vault.readBinary=async()=>Buffer.from('note');p.engine={sync:async()=>({action:'deferred'})};p.schedule=()=>{};notices.length=0;
 await p.upload(f,false);assert.ok(notices.some(n=>n.includes('重新执行')));
});
test('scan respects backoff and avoids retry loops until content changes',()=>{
 const p=setup(),f=new TFile('01-收件箱/待入库/a.pdf');p.app.vault.getFiles=()=>[f];p.data.records[f.path]={error:'offline',errorMtime:123,nextRetryAt:Date.now()+999999};let n=0;p.schedule=()=>n++;p.scan();assert.equal(n,0);f.stat.mtime++;p.scan();assert.equal(n,1);
});
test('external import preserves existing file, skips unsupported and oversized inputs',async()=>{
 const p=setup();const files=new Map([['01-收件箱/待入库/a.pdf',new TFile('01-收件箱/待入库/a.pdf')]]);const written=[];
 p.app.vault={getAbstractFileByPath:k=>files.get(k),createFolder:async k=>files.set(k,{}),createBinary:async(k,b)=>{written.push(k);files.set(k,new TFile(k));return files.get(k);}};p.schedule=()=>{};
 const input=name=>({name,size:2,arrayBuffer:async()=>new Uint8Array([1,2]).buffer});
 assert.equal(typeof p.importFiles,'function');await p.importFiles([input('a.pdf'),input('x.xlsm'),{...input('big.pdf'),size:21*1024*1024}]);
 assert.deepEqual(written,['01-收件箱/待入库/a (2).pdf']);
});
