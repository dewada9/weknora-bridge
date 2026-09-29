const {Plugin,Modal,Setting,PluginSettingTab,FuzzySuggestModal,TFile,Notice,parseYaml,SecretComponent}=require('obsidian');
const {SyncEngine,autoEligible,supported,INBOX,generated,retryReady,recordFailure}=require('./core');
const {Api}=require('./api');
const {resolveConnection}=require('./connection');
const {archiveCompleted,recoverMoves,validFolders}=require('./archive');
const library=require('./library');
class LibraryStatus extends Modal{
 constructor(plugin){super(plugin.app);this.plugin=plugin;}
 onOpen(){const p=this.plugin,s=p.data.library||{};this.contentEl.createEl('h2',{text:'自动目录与图谱'});
  this.contentEl.createEl('p',{text:'服务器每 10 分钟导出；Obsidian 打开时每 15 分钟检查。关闭 Obsidian 时暂停本地刷新，下次打开补上。'});
  for(const text of ['自动刷新：'+(p.data.autoLibrary?'开启':'暂停'),'最近成功：'+(s.lastSuccess?new Date(s.lastSuccess).toLocaleString():'尚未成功'),'服务端图谱：'+(s.snapshotAt?new Date(s.snapshotAt).toLocaleString():'尚未获取'),'当前资料：'+(s.documents??'未知'),'状态：'+(s.error||'正常')])this.contentEl.createEl('p',{text});
  this.contentEl.createEl('button',{text:'立即刷新'}).onclick=async()=>{await p.refreshLibrary(true);this.close();new LibraryStatus(p).open();};
  this.contentEl.createEl('button',{text:'打开自动知识库'}).onclick=()=>{const f=p.app.vault.getAbstractFileByPath(library.PREFIX+'/00-自动知识库.md');if(f)p.app.workspace.getLeaf(false).openFile(f);this.close();};
  if(s.conflicts?.length){this.contentEl.createEl('h3',{text:'保留了手工修改的文件'});for(const name of s.conflicts)this.contentEl.createEl('p',{text:name});}
 }
 onClose(){this.contentEl.empty();}
}
class FilePicker extends FuzzySuggestModal {
 constructor(plugin){super(plugin.app);this.plugin=plugin;this.setPlaceholder('选择要上传或更新的 Markdown / PDF / Word 文件');}
 getItems(){return this.app.vault.getFiles().filter(f=>supported(f.path)&&!generated(f.path));}
 getItemText(f){return f.path;}
 onChooseItem(f){this.plugin.upload(f);}
}
class SearchModal extends Modal{
 constructor(plugin){super(plugin.app);this.plugin=plugin;}
 onOpen(){
  const root=this.contentEl;root.createEl('h2',{text:'检索 WeKnora 知识库'});
  const input=root.createEl('input',{type:'search',placeholder:'输入问题或关键词',cls:'wk-search'});
  const run=root.createEl('button',{text:'检索',cls:'mod-cta'});const results=root.createDiv();
  const search=async()=>{const q=input.value.trim();if(!q||run.disabled)return;run.disabled=true;results.setText('正在检索…');
   try{if(!this.plugin.api)throw Error('请先在设置中连接 WeKnora');const rows=await this.plugin.api.search(q);results.empty();if(!rows?.length)results.setText('未找到匹配资料。新上传的文件需要等待解析完成。');
    for(const row of rows||[]){const card=results.createDiv({cls:'wk-result'});card.createEl('h3',{text:row.knowledge_title||row.knowledge_filename||'文档'});card.createEl('p',{text:String(row.content||'').slice(0,3000)});
     card.createEl('button',{text:'打开来源'}).onclick=()=>this.plugin.openSource(row.knowledge_id);
    }
   }catch(e){results.setText(e.message);}finally{run.disabled=false;}
  };run.onclick=search;input.onkeydown=e=>{if(e.key==='Enter')search();};input.focus();
 }
 onClose(){this.contentEl.empty();}
}
class StatusModal extends Modal{
 constructor(plugin){super(plugin.app);this.plugin=plugin;}
 onOpen(){this.render();}
 render(){const p=this.plugin;this.contentEl.empty();this.contentEl.createEl('h2',{text:'上传与同步状态'});
  this.contentEl.createEl('p',{text:'草稿留在本地；待入库文件自动上传。已发布文件修改后更新原文档。删除本地文件不会删除远端文档。'});
  this.contentEl.createEl('button',{text:'导入电脑文件'}).onclick=()=>p.pickExternalFiles();
  this.contentEl.createEl('button',{text:'重试待处理任务'}).onclick=async()=>{for(const r of Object.values(p.data.records))delete r.nextRetryAt;await p.persist();p.scan();new Notice('已安排重试');};
  const refresh=this.contentEl.createEl('button',{text:'刷新解析状态'});refresh.onclick=async()=>{refresh.disabled=true;try{for(const rec of Object.values(p.data.records)){if(rec.id)rec.status=(await p.api.get(rec.id)).parse_status;}await p.persist();this.render();}catch(e){new Notice(e.message);refresh.disabled=false;}};
  const paths=new Set([...Object.keys(p.data.records),...p.app.vault.getFiles().filter(f=>p.eligible(f)).map(f=>f.path)]);
  for(const path of paths){const r=p.data.records[path]||{};const d=this.contentEl.createDiv({cls:'wk-result'});d.createEl('strong',{text:path});d.createEl('p',{text:r.error||({completed:'已入库，可检索',pending:'等待解析',processing:'正在解析',running:'正在解析',finalizing:'解析收尾中，请等待',failed:'解析失败，请在网页查看详情'}[r.status]||r.status||'待上传')});if(r.error&&r.nextRetryAt)d.createEl('small',{text:'下次重试：'+new Date(r.nextRetryAt).toLocaleTimeString()});if(r.id)d.createEl('button',{text:'打开来源'}).onclick=()=>p.openSource(r.id);}
 }
}
class Settings extends PluginSettingTab{
 constructor(app,plugin){super(app,plugin);this.plugin=plugin;}
 display(){const p=this.plugin;this.containerEl.empty();this.containerEl.createEl('h2',{text:'WeKnora 知识库'});
  this.containerEl.createEl('p',{text:p.connectionError||'密钥使用 Obsidian 原生密钥存储；插件配置只保存密钥名称。'});
  const connection={...(p.data.connection||{})};
  new Setting(this.containerEl).setName('服务地址').setDesc('WeKnora 根地址；仅向此地址发送所选密钥和发布的文件。').addText(t=>t.setPlaceholder('https://knowledge.example.org').setValue(connection.base||'').onChange(v=>connection.base=v.trim()));
  new Setting(this.containerEl).setName('知识库 ID').addText(t=>t.setValue(connection.kb||'').onChange(v=>connection.kb=v.trim()));
  if(SecretComponent)new Setting(this.containerEl).setName('API 密钥').setDesc('选择已有密钥，或在此创建新密钥。更换电脑后需要在该电脑重新配置。').addComponent(el=>new SecretComponent(this.app,el).setValue(connection.secretName||'').onChange(v=>connection.secretName=v||''));
  new Setting(this.containerEl).setName('保存并测试连接').setDesc('连接失败时菜单仍然可用。已有同步记录时禁止直接切换知识库。').addButton(b=>b.setButtonText('保存并连接').onClick(async()=>{b.setDisabled(true);try{await p.connect(connection,true);new Notice('连接成功，配置已保存');this.display();}catch(e){new Notice(e.message,10000);}finally{b.setDisabled(false);}}));
  new Setting(this.containerEl).setName('解析完成后移到已入库').setDesc('仅移动待入库中已解析且正文未变的文件；保留文档 ID 和笔记链接，同名不覆盖。').addToggle(t=>t.setValue(!!p.data.autoMove).onChange(async v=>{p.data.autoMove=v;await p.persist();p.scan();}));
  const folders={inbox:p.data.inboxFolder,done:p.data.completedFolder};
  new Setting(this.containerEl).setName('待入库目录').addText(t=>t.setValue(folders.inbox).onChange(v=>folders.inbox=v.trim()));
  new Setting(this.containerEl).setName('已入库目录').addText(t=>t.setValue(folders.done).onChange(v=>folders.done=v.trim()));
  new Setting(this.containerEl).setName('保存目录').addButton(b=>b.setButtonText('保存目录').onClick(async()=>{if(!validFolders(folders.inbox,folders.done))return new Notice('目录必须是库内相对路径，且互不包含');p.data.inboxFolder=folders.inbox;p.data.completedFolder=folders.done;await p.persist();p.scan();new Notice('目录已保存');}));
  new Setting(this.containerEl).setName('自动上传与更新').setDesc('处理待入库文件、已发布文件及 weknora_sync: true 的笔记。保存后等待 15 秒；失败逐步延迟重试。Obsidian 关闭时暂停。').addToggle(t=>t.setValue(p.data.autoSync).onChange(async v=>{p.data.autoSync=v;await p.persist();if(v)p.scan();}));
  new Setting(this.containerEl).setName('待入库目录自动上传').setDesc(p.data.inboxFolder+'；普通草稿不上传，weknora_sync: false 可单篇退出。').addToggle(t=>t.setValue(p.data.autoInbox).onChange(async v=>{p.data.autoInbox=v;await p.persist();if(v)p.scan();}));
  new Setting(this.containerEl).setName('自动整理远端目录和图谱').setDesc('每 15 分钟检查一次，只更新自动目录中的未修改文件；不额外调用模型。').addToggle(t=>t.setValue(p.data.autoLibrary).onChange(async v=>{p.data.autoLibrary=v;await p.persist();if(v)p.refreshLibrary();}));
  new Setting(this.containerEl).setName('自动整理状态').addButton(b=>b.setButtonText('查看状态').onClick(()=>new LibraryStatus(p).open()));
  new Setting(this.containerEl).setName('文件上传 / 更新').addButton(b=>b.setButtonText('选择文件').onClick(()=>new FilePicker(p).open()));
  new Setting(this.containerEl).setName('查看任务和解析状态').addButton(b=>b.setButtonText('查看状态').onClick(()=>new StatusModal(p).open()));
 }
}
module.exports=class WeKnoraPlugin extends Plugin{
 async onload(){
  this.data=Object.assign({autoSync:false,autoInbox:false,autoLibrary:false,autoMove:false,inboxFolder:INBOX,completedFolder:'04-资料索引/已入库',connection:{},library:{},records:{}},await this.loadData());this.saveTail=Promise.resolve();this.timers=new Map();this.inflight=new Set();this.managedMoves=new Set();this.closed=false;this.movesReady=false;
  for(const rec of Object.values(this.data.records))if(rec.id&&rec.source&&rec.autoManaged===undefined)rec.autoManaged=true;
  this.addSettingTab(new Settings(this.app,this));this.status=this.addStatusBarItem();this.status.setText('WeKnora 待连接');this.status.onclick=()=>new StatusModal(this).open();
  this.addCommand({id:'connection-settings',name:'配置连接 / 修复密钥',callback:()=>this.openSettings()});
  this.addRibbonIcon('upload-cloud','导入电脑文件到待入库',()=>this.pickExternalFiles());this.addRibbonIcon('database','检索 WeKnora',()=>new SearchModal(this).open());
  this.addCommand({id:'import-files',name:'导入电脑文件到待入库',callback:()=>this.pickExternalFiles()});
  this.addCommand({id:'new-draft',name:'新建本地草稿',callback:()=>this.newDraft()});
  this.addCommand({id:'upload-current',name:'上传 / 更新当前文件',callback:()=>this.upload(this.app.workspace.getActiveFile())});
  this.addCommand({id:'choose-upload',name:'选择本地文件上传',callback:()=>new FilePicker(this).open()});
  this.addCommand({id:'search',name:'检索知识库',callback:()=>new SearchModal(this).open()});
  this.addCommand({id:'status',name:'查看上传状态',callback:()=>new StatusModal(this).open()});
  this.addCommand({id:'library-status',name:'查看自动整理状态',callback:()=>new LibraryStatus(this).open()});
  this.addCommand({id:'library-refresh',name:'立即刷新自动目录与图谱',callback:()=>this.refreshLibrary(true)});
  this.addCommand({id:'mark-auto',name:'开启当前笔记自动同步',callback:async()=>{const f=this.app.workspace.getActiveFile();if(f?.extension!=='md')return new Notice('请先打开 Markdown 笔记');await this.app.fileManager.processFrontMatter(f,fm=>{fm.weknora_sync=true;});new Notice('已标记自动同步；可在插件设置中整体暂停');this.schedule(f);}});
  this.addCommand({id:'unmark-auto',name:'关闭当前笔记自动同步',callback:async()=>{const f=this.app.workspace.getActiveFile();if(f?.extension==='md'){await this.app.fileManager.processFrontMatter(f,fm=>{fm.weknora_sync=false;});new Notice('已关闭此笔记自动同步');}}});
  this.registerEvent(this.app.workspace.on('file-menu',(menu,file)=>{if(file instanceof TFile&&supported(file.path))menu.addItem(i=>i.setTitle('上传 / 更新到 WeKnora').setIcon('upload-cloud').onClick(()=>this.upload(file)));}));
  this.registerEvent(this.app.metadataCache.on('changed',file=>this.schedule(file)));
  this.registerEvent(this.app.vault.on('create',file=>this.schedule(file)));
  this.registerEvent(this.app.vault.on('modify',file=>this.schedule(file)));
  this.registerEvent(this.app.vault.on('rename',(file,old)=>{if(this.managedMoves.has(old))return;if(this.engine)this.engine.rename(old,file.path).then(()=>this.schedule(file)).catch(e=>new Notice(e.message));else{const engine=new SyncEngine(this.data,null,()=>this.persist());engine.rename(old,file.path).catch(e=>new Notice(e.message));}}));
  this.registerEvent(this.app.vault.on('delete',file=>{clearTimeout(this.timers.get(file.path));this.timers.delete(file.path);}));
  this.registerInterval(window.setInterval(()=>{if(!this.api)this.connect().catch(()=>{});else this.scan();},60000));this.app.workspace.onLayoutReady(()=>this.connect().catch(()=>{}));
  this.libraryStatus=this.addStatusBarItem();this.libraryStatus.setText('知识目录待刷新');this.libraryStatus.onclick=()=>new LibraryStatus(this).open();
  this.registerInterval(window.setInterval(()=>this.refreshLibrary(),15*60000));
  await this.connect().catch(e=>new Notice('WeKnora：'+e.message,10000));
 }
 openSettings(){this.app.setting.open();this.app.setting.openTabById(this.manifest.id);}
 async connect(settings=this.data.connection,probe=false){
  if(this.connecting)throw Error('连接处理中，请稍后重试');if(this.closed)throw Error('插件已关闭');if(this.inflight.size||this.libraryRunning)throw Error('请等待当前同步完成后重连');this.connecting=true;
  let candidate;
  try{
   if(Object.keys(this.data.records).length&&this.data.connection?.kb&&settings.kb!==this.data.connection.kb)throw Error('已有同步关联，不能直接切换知识库；请在独立笔记库配置');
   const config=await resolveConnection(this.app,settings);candidate=new Api(config,parseYaml);
   if(probe){await candidate.request('GET','/api/v1/knowledge-bases/'+encodeURIComponent(config.kb)+'/knowledge?page=1&page_size=1');const r=Object.values(this.data.records).find(r=>r.id);if(r){const remote=await candidate.get(r.id);if(remote.metadata?.obsidian_source!==r.source)throw Error('目标服务器的原文档关联不匹配');}}
   if(this.closed){candidate.close();return;}
   if(this.engine)await this.engine.tail;
   this.api?.close();this.api=candidate;candidate=null;this.config=config;this.engine=new SyncEngine(this.data,this.api,()=>this.persist());
   this.data.connection={base:config.base,kb:config.kb,secretName:settings.secretName};await this.persist();
   if(!this.movesReady){await recoverMoves(this.archiveOptions());this.movesReady=true;}
   this.connectionError=null;this.status.setText('WeKnora 已配置');this.scan();if(this.data.autoLibrary)this.refreshLibrary();
  }catch(e){candidate?.close();this.connectionError=e.message;this.status.setText('WeKnora 连接待修复');throw e;}finally{this.connecting=false;if(this.api&&this.movesReady){this.scan();if(this.data.autoLibrary)this.refreshLibrary();}}
 }
 archiveOptions(){return {state:this.data,save:()=>this.persist(),inbox:this.data.inboxFolder,destination:this.data.completedFolder,enabled:this.data.autoMove,io:{exists:p=>this.app.vault.adapter.exists(p),read:async p=>Buffer.from(await this.app.vault.adapter.readBinary(p)),rename:async(a,b)=>{await this.ensureFolder(b.slice(0,b.lastIndexOf('/')));const f=this.app.vault.getAbstractFileByPath(a);if(!(f instanceof TFile))throw Error('文件缓存尚未就绪');this.managedMoves.add(a);try{await this.app.fileManager.renameFile(f,b);}finally{this.managedMoves.delete(a);}}}};}
 async finishIntake(file){
  if(!this.data.autoMove)return;const path=file.path,mtime=file.stat.mtime;
  const run=this.engine.tail.then(()=>archiveCompleted(path,{...this.archiveOptions(),guard:()=>!this.closed&&this.data.autoMove&&this.eligible(file)&&file.path===path&&file.stat.mtime===mtime}));this.engine.tail=run.catch(()=>{});
  try{const target=await run;if(target)this.schedule(file);}catch(e){if(Object.values(this.data.records).some(r=>r.moveTo))this.movesReady=false;throw e;}
 }
 async refreshLibrary(manual=false){
  if(this.closed||this.connecting||!this.api||this.libraryRunning||(!manual&&!this.data.autoLibrary))return;this.libraryRunning=true;this.libraryStatus?.setText('知识目录刷新中…');
  const state=this.data.library||(this.data.library={});const previous=JSON.stringify([state.error,state.conflicts]);
  try{
   const snapshot=await this.api.request('GET','/api/v1/obsidian/graph');if(this.closed)return;
   const vault=this.app.vault;
   const io={read:async path=>{const f=vault.getAbstractFileByPath(path);if(f instanceof TFile)return vault.read(f);if(await vault.adapter.exists(path))return vault.adapter.read(path);return null;},write:async(path,text,expected)=>{
    if(this.closed)throw Error('插件已暂停');
    const parts=path.split('/');parts.pop();let folder='';for(const part of parts){folder=folder?folder+'/'+part:part;if(!vault.getAbstractFileByPath(folder)&&!(await vault.adapter.exists(folder)))await vault.createFolder(folder);}
    const f=vault.getAbstractFileByPath(path);if(f instanceof TFile)await vault.process(f,current=>{if(current!==expected)throw Error('文件正在编辑，稍后重试');return text;});
    else if(expected===null)await vault.create(path,text);else throw Error('文件缓存尚未就绪，稍后重试');
   }};
   const result=await library.refresh(snapshot,{base:this.api.base,kb:this.config.kb},state,io,()=>this.persist());
   this.libraryStatus?.setText(result.conflicts.length?'知识目录有冲突':'知识目录 '+result.documents+' 份');
   if(manual)new Notice('自动目录已刷新：'+result.documents+' 份资料，更新 '+result.written+' 个文件，冲突 '+result.conflicts.length+' 个');
   else if(result.conflicts.length&&previous!==JSON.stringify([state.error,state.conflicts]))new Notice('自动目录保留了手工修改，请在「查看自动整理状态」中核对。',8000);
  }catch(e){state.error=e.message;await this.persist();this.libraryStatus?.setText('知识目录待重试');if(manual||previous!==JSON.stringify([state.error,state.conflicts]))new Notice('自动整理：'+e.message,8000);}
  finally{this.libraryRunning=false;}
 }
 persist(){this.saveTail=this.saveTail.catch(()=>{}).then(()=>this.saveData(this.data));return this.saveTail;}
 eligible(f){return f instanceof TFile&&autoEligible(f.path,this.app.metadataCache.getFileCache(f)?.frontmatter,this.data.autoSync,this.data.records[f.path],this.data.autoInbox,this.data.inboxFolder||INBOX);}
 schedule(f){if(!this.eligible(f)||this.closed)return;clearTimeout(this.timers.get(f.path));this.timers.set(f.path,setTimeout(()=>{this.timers.delete(f.path);if(this.eligible(f))this.upload(f,true);},15000));}
 scan(){if(this.closed||this.connecting||!this.data.autoSync||this.movesReady===false)return;for(const f of this.app.vault.getFiles()){if(this.eligible(f)&&!this.inflight.has(f.path)){const r=this.data.records[f.path];if(retryReady(r,f.stat.mtime)&&(!r||r.mtime!==f.stat.mtime||r.error||r.uploadedPath&&r.uploadedPath!==f.path||['pending','processing','running','finalizing'].includes(r.status)||this.data.autoMove&&f.path.startsWith(this.data.inboxFolder+'/')))this.schedule(f);}}}
 async ensureFolder(path){let current='';for(const part of path.split('/')){current=current?current+'/'+part:part;if(!this.app.vault.getAbstractFileByPath(current))await this.app.vault.createFolder(current);}}
 pickExternalFiles(){const input=document.createElement('input');input.type='file';input.multiple=true;input.accept='.md,.txt,.pdf,.docx,.doc,.png,.jpg,.jpeg,.webp';input.onchange=()=>this.importFiles([...input.files]).catch(e=>new Notice(e.message));input.click();}
 async importFiles(files){const inbox=this.data.inboxFolder||INBOX;await this.ensureFolder(inbox);let count=0,skipped=0;for(const source of files){
  if(!supported(source.name)||!source.size||source.size>20*1024*1024){skipped++;continue;}
  const name=source.name.replace(/[\\/:*?"<>|\x00-\x1f]/g,'_');if(name.startsWith('.')||generated(name)){skipped++;continue;}
  let target=inbox+'/'+name;const dot=name.lastIndexOf('.');let n=2;while(this.app.vault.getAbstractFileByPath(target))target=inbox+'/'+name.slice(0,dot)+' ('+(n++)+')'+name.slice(dot);
  const f=await this.app.vault.createBinary(target,await source.arrayBuffer());this.schedule(f);count++;
 }new Notice('已导入 '+count+' 个文件'+(skipped?'；跳过 '+skipped+' 个不支持或超过 20 MiB 的文件':'')+(this.data.autoSync&&this.data.autoInbox?'，稍后自动上传':'；自动上传已暂停'),8000);}
 async newDraft(){await this.ensureFolder('01-收件箱');const path='01-收件箱/草稿-'+new Date().toISOString().replace(/[:.]/g,'-')+'.md';const f=await this.app.vault.create(path,'---\n类型: 草稿\n---\n\n# 新笔记\n\n');await this.app.workspace.getLeaf(false).openFile(f);}
 async upload(file,automatic=false){
  if(this.connecting||this.movesReady===false){if(!automatic)new Notice('连接或归档恢复尚未完成，请查看设置和同步状态');return;}
  if(!this.engine){if(!automatic){new Notice('请先在 WeKnora 设置中配置连接');this.openSettings();}return;}
  if(!(file instanceof TFile)||!supported(file.path)||generated(file.path))return new Notice('请选择笔记或支持的文档；自动生成的目录与图谱不上传');
  const path=file.path;if(this.inflight.has(path)||this.closed)return;this.inflight.add(path);this.status.setText('WeKnora 正在上传…');
  const mtime=file.stat.mtime;
  try{const bytes=Buffer.from(await this.app.vault.readBinary(file));const guard=()=>!this.closed&&file.path===path&&file.stat.mtime===mtime&&this.app.vault.getAbstractFileByPath(path)===file&&(!automatic||this.eligible(file));const r=await this.engine.sync(path,bytes,guard);if(r.action==='deferred'){if(automatic){this.status.setText('WeKnora 等待文件稳定');this.schedule(file);}else{this.status.setText('WeKnora 本次上传已取消');if(!this.closed)new Notice('文件已修改或移动，本次手动上传已取消；请稳定后重新执行上传。',8000);}return;}const rec=this.data.records[path]||Object.values(this.data.records).find(x=>x.id===r.id);if(!rec)throw Error("同步记录暂不可用，请刷新状态");rec.mtime=mtime;rec.autoManaged=true;for(const key of ['error','errorMtime','nextRetryAt','failures'])delete rec[key];await this.persist();await this.finishIntake(file);this.status.setText('WeKnora '+(r.parse_status==='completed'?'已入库':'等待解析'));if(!automatic)new Notice(r.action==='unchanged'?'原文未变化；当前状态：'+r.parse_status:'已上传到 NAS，服务器正在解析。可在「查看上传状态」中刷新。',7000);
  }catch(e){if(file.path!==path||this.closed){this.schedule(file);return;}const rec=this.data.records[path]||(this.data.records[path]={});recordFailure(rec,e.message,mtime);await this.persist().catch(()=>{});this.status.setText('WeKnora 待处理');if(!automatic)new Notice(e.message,10000);}finally{this.inflight.delete(path);}
 }
 openSource(id){const local=Object.entries(this.data.records).find(([,r])=>r.id===id);if(local){const file=this.app.vault.getAbstractFileByPath(local[0]);if(file instanceof TFile){this.app.workspace.getLeaf(false).openFile(file);return;}}
  window.open(this.api.base+'/platform/knowledge-bases/'+encodeURIComponent(this.config.kb)+'?knowledge_id='+encodeURIComponent(id||''),'_blank');
 }
 onunload(){this.closed=true;for(const timer of this.timers?.values()||[])clearTimeout(timer);this.api?.close();this.config=null;}
};
