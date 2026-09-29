const {createHash,randomUUID}=require('crypto');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const INBOX='01-收件箱/待入库';
const supported=path=>/\.(md|txt|pdf|docx|doc|png|jpe?g|webp)$/i.test(path);
const safePath=path=>typeof path==='string'&&!/^[\/\\]|[\\\x00-\x1f]/.test(path)&&path.split('/').every(p=>p&&p!=='.'&&p!=='..');
const generated=path=>path.split('/').some(p=>p.startsWith('.')||['90-模板','05-WeKnora图谱','06-自动知识库','98-归档'].includes(p))||/\.sync-conflict-/i.test(path);
const autoEligible=(path,frontmatter,enabled,record={},inboxEnabled=true,inbox=INBOX)=>enabled===true&&safePath(path)&&supported(path)&&!generated(path)&&frontmatter?.weknora_sync!==false&&((/\.md$/i.test(path)&&frontmatter?.weknora_sync===true)||record.autoManaged===true||(inboxEnabled&&path.startsWith(inbox+'/')));
const retryReady=(record,mtime,now=Date.now())=>!record?.error||record.errorMtime!==mtime||!record.nextRetryAt||record.nextRetryAt<=now;
function recordFailure(record,message,mtime,now=Date.now()){
 if(!record.source)record.source=randomUUID();
 record.failures=record.errorMtime===mtime?(record.failures||0)+1:1;
 Object.assign(record,{error:message,errorMtime:mtime,nextRetryAt:now+Math.min(30*60000,60000*2**Math.min(record.failures-1,5))});
}
class SyncEngine {
 constructor(state,api,save){this.state=state;this.api=api;this.save=save;this.tail=Promise.resolve();}
 sync(path,bytes,guard=()=>true){const run=this.tail.then(()=>this.perform(path,bytes,guard));this.tail=run.catch(()=>{});return run;}
 rename(oldPath,newPath){const run=this.tail.then(async()=>{const paths=Object.keys(this.state.records).filter(p=>p===oldPath||p.startsWith(oldPath+'/'));for(const p of paths){if(this.state.records[newPath+p.slice(oldPath.length)])throw Error('新路径已有同步记录');}for(const p of paths){this.state.records[newPath+p.slice(oldPath.length)]=this.state.records[p];delete this.state.records[p];}await this.save();});this.tail=run.catch(()=>{});return run;}
 async syncTitle(remote,bytes,guard=()=>true){
  const front=bytes.toString('utf8').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if(!front||!/^source:\s*"ChatGPT Tasks"\s*$/m.test(front))return remote;
  let title;try{title=JSON.parse(front.match(/^title:\s*(.+)$/m)?.[1]);}catch{return remote;}
  if(typeof title!=='string'||!title.trim()||title.length>500||remote.title===title)return remote;
  if(!guard())return remote;
  const updated=await this.api.updateTitle(remote.id,title);return {...remote,...updated,title};
 }
 async perform(path,bytes,guard=()=>true){
  if(!guard())return {action:'deferred'};
  if(!safePath(path))throw Error('文件路径无效');
  if(!supported(path))throw Error('支持 Markdown、TXT、PDF、Word、PNG、JPEG、WebP');
  if(!bytes.length||bytes.length>20*1024*1024)throw Error('文件须非空，且不超过 20 MB');
  const digest=hash(bytes);let rec=this.state.records[path];
  if(!rec){rec=this.state.records[path]={source:randomUUID()};await this.save();}
  if(rec.uncertain&&!rec.id){
   const found=await this.api.find(rec.source);
   if(found.length>1)throw Error('远端存在多个相同来源，请人工核对');
   if(found.length===1){if(found[0].file_hash!==rec.attemptRemoteHash)throw Error('远端原文已发生变化，请人工核对');rec.id=found[0].id;rec.remoteHash=found[0].file_hash;rec.digest=rec.attemptDigest;if(rec.attemptPath)rec.uploadedPath=rec.attemptPath;await this.save();}
   else throw Error('上次上传结果未知，暂不重传以免重复。请稍后重试或在网页核对');
  }
  let remote;
  if(rec.id){
   remote=await this.api.get(rec.id);
   if(!remote)throw Error('远端文档不存在，请核对后重新关联');
   if(remote.metadata?.obsidian_source!==rec.source)throw Error('远端来源不匹配，已停止更新');
   if(rec.attempt&&remote.metadata?.obsidian_attempt===rec.attempt&&remote.file_hash===rec.attemptRemoteHash){rec.remoteHash=remote.file_hash;rec.digest=rec.attemptDigest;if(rec.attemptPath)rec.uploadedPath=rec.attemptPath;delete rec.attempt;await this.save();}
   if(remote.file_hash!==rec.remoteHash)throw Error('远端原文已被其他入口修改，已停止覆盖');
   if(!guard())return {action:'deferred'};
   if(rec.digest===digest&&(!rec.uploadedPath||rec.uploadedPath===path)){remote=await this.syncTitle(remote,bytes,guard);rec.status=remote.parse_status;await this.save();return {action:'unchanged',...remote};}
   if(['pending','processing','deleting','running','finalizing'].includes(remote.parse_status))throw Error('远端正在解析，请稍后重试');
   rec.attempt=randomUUID();rec.attemptPath=path;rec.attemptDigest=digest;rec.attemptRemoteHash=createHash('md5').update(bytes).digest('hex');await this.save();
   if(!guard()){delete rec.attempt;await this.save();return {action:'deferred'};}
   remote=await this.api.replace(rec.id,path,bytes,rec.remoteHash,rec.source,rec.attempt);
  }else{
   rec.uncertain=true;rec.attemptPath=path;rec.attemptDigest=digest;rec.attemptRemoteHash=createHash('md5').update(bytes).digest('hex');await this.save();
   if(!guard()){rec.uncertain=false;await this.save();return {action:'deferred'};}
   try{remote=await this.api.create(path,bytes,rec.source);}catch(e){if(e.definitelyNotSent){rec.uncertain=false;await this.save();}throw e;}
  }
  if(remote?.metadata?.obsidian_source!==rec.source)throw Error('文件与已有远端文档重复，未接管其更新权限');
  Object.assign(rec,{id:remote.id,uploadedPath:path,remoteHash:remote.file_hash,digest,status:remote.parse_status,uncertain:false,lastSync:new Date().toISOString()});
  delete rec.attempt;
  await this.save();remote=await this.syncTitle(remote,bytes,guard);return {action:'uploaded',...remote};
 }
}
module.exports={hash,supported,autoEligible,SyncEngine,INBOX,generated,safePath,retryReady,recordFailure};
