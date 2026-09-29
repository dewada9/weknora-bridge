const {hash,safePath,generated}=require('./core');
function validFolders(inbox,destination){return safePath(inbox)&&safePath(destination)&&!generated(destination)&&inbox!==destination&&!destination.startsWith(inbox+'/')&&!inbox.startsWith(destination+'/');}
async function recoverMoves({state,io,save}){
 for(const [old,rec]of Object.entries(state.records)){
  if(!rec.moveTo)continue;const target=rec.moveTo;
  if(!safePath(target)||generated(target))throw Error('归档路径无效');
  const sourceExists=await io.exists(old),targetExists=await io.exists(target);
  if(sourceExists&&!targetExists){delete rec.moveTo;await save();continue;}
  if(sourceExists||!targetExists||state.records[target]||hash(await io.read(target))!==rec.digest)throw Error('归档恢复冲突，请在同步状态中核对文件，未覆盖任何内容');
  state.records[target]=rec;delete state.records[old];delete rec.moveTo;await save();
 }
}
async function archiveCompleted(path,{state,io,save,inbox,destination,enabled,guard=()=>true}){
 const rec=state.records[path];
 if(!enabled||!rec?.id||rec.status!=='completed'||rec.error||!path.startsWith(inbox+'/'))return false;
 if(!validFolders(inbox,destination))throw Error('待入库和已入库目录必须有效且互不包含');
 if(!guard()||!await io.exists(path)||hash(await io.read(path))!==rec.digest)return false;
 const base=destination+'/'+path.slice(inbox.length+1);let target=base,n=2;const dot=base.lastIndexOf('.');
 while(await io.exists(target)||state.records[target]){target=base.slice(0,dot)+' ('+(n++)+')'+base.slice(dot);if(n>1000)throw Error('归档重名文件过多');}
 rec.moveTo=target;await save();
 if(!guard()||hash(await io.read(path))!==rec.digest){delete rec.moveTo;await save();return false;}
 await io.rename(path,target); // Vault fileManager preserves links and refuses overwrite.
 state.records[target]=rec;delete state.records[path];delete rec.moveTo;await save();
 return target;
}
module.exports={archiveCompleted,recoverMoves,validFolders};
