const {test}=require('node:test');const assert=require('node:assert/strict');
const {archiveCompleted,recoverMoves}=require('./archive');const {hash}=require('./core');
function fixture(){
 const bytes=Buffer.from('note'),files=new Map([['Inbox/a.md',bytes]]),state={records:{'Inbox/a.md':{id:'existing',source:'s',status:'completed',digest:hash(bytes),autoManaged:true}}};
 const io={exists:async p=>files.has(p),read:async p=>files.get(p),rename:async(a,b)=>{assert.ok(!files.has(b));files.set(b,files.get(a));files.delete(a);}};
 return {bytes,files,state,io,save:async()=>{},inbox:'Inbox',destination:'Published',enabled:true};
}
test('only parsed unchanged intake moves; identity and nested path survive',async()=>{
 const f=fixture();await archiveCompleted('Inbox/a.md',f);assert.ok(f.files.has('Published/a.md'));assert.equal(f.state.records['Published/a.md'].id,'existing');assert.equal(f.state.records['Inbox/a.md'],undefined);
});
test('pending parse and edited bytes stay in intake',async()=>{
 for(const condition of ['pending','edited']){const f=fixture();if(condition==='pending')f.state.records['Inbox/a.md'].status='processing';else f.files.set('Inbox/a.md',Buffer.from('changed'));await archiveCompleted('Inbox/a.md',f);assert.ok(f.files.has('Inbox/a.md'));}
});
test('destination collision never overwrites existing data',async()=>{
 const f=fixture();f.files.set('Published/a.md',Buffer.from('other'));await archiveCompleted('Inbox/a.md',f);assert.equal(f.files.get('Published/a.md').toString(),'other');assert.ok(f.files.has('Published/a (2).md'));
});
test('crash after file rename recovers the existing ID instead of re-uploading',async()=>{
 const f=fixture();f.state.records['Inbox/a.md'].moveTo='Published/a.md';await f.io.rename('Inbox/a.md','Published/a.md');await recoverMoves(f);assert.equal(f.state.records['Published/a.md'].id,'existing');assert.equal(f.state.records['Inbox/a.md'],undefined);
});
test('recovery preserves ambiguous edits and does not adopt unknown target',async()=>{
 const f=fixture();f.state.records['Inbox/a.md'].moveTo='Published/a.md';f.files.delete('Inbox/a.md');f.files.set('Published/a.md',Buffer.from('different'));await assert.rejects(()=>recoverMoves(f),/冲突/);assert.equal(f.state.records['Inbox/a.md'].id,'existing');
});
