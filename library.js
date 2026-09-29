const {createHash}=require('crypto');
const PREFIX='06-自动知识库';
const digest=s=>createHash('sha256').update(s).digest('hex');
const id=s=>digest(String(s)).slice(0,20);
const plain=s=>String(s??'').replace(/[\r\n]/g,' ').replace(/\[/g,'［').replace(/\]/g,'］').replace(/\|/g,'｜').replace(/</g,'＜').replace(/>/g,'＞').replace(/[*`#]/g,'');
const wiki=(p,t)=>`[[${p}|${plain(t)}]]`;
const cardPath=kg=>`${PREFIX}/资料/${id(kg)}.md`;
const canvasPath=kg=>`${PREFIX}/简图/${id(kg)}.canvas`;
const nodePath=n=>`${PREFIX}/实体/${id(n.kg)}/${id(n.id)}.md`;
function note(props,body){return '---\nweknora_sync: false\nautomatic_library: true\n'+Object.entries(props).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\n\n'+body+'\n';}
function category(title){
 if(/每日技术简报|长读推荐|日报/.test(title))return '技术简报与长读';
 if(/BQ79731|sluucl9|sluucm0/i.test(title))return 'BQ79731器件资料';
 if(/催眠|睡前/.test(title))return '个人资料';
 if(/README|TRIGGERS|connection-test|Hermes/i.test(title))return '运维与同步';
 if(/安全|HIL|FMEDA/i.test(title))return '功能安全与验证';
 if(/BMS|SOC|SOH|电池|均衡|Pack/i.test(title))return 'BMS架构与算法';
 return '待分类';
}
function validate(s,c){
 if(s?.schema_version!==1||s.kb_id!==c.kb||!s.documents||Array.isArray(s.documents)||!Array.isArray(s.nodes)||!Array.isArray(s.relations))throw Error('自动目录：图谱格式或知识库范围不匹配');
 const age=Date.now()-Date.parse(s.generated_at);if(!Number.isFinite(age)||age>24*3600000||age< -300000)throw Error('自动目录：服务器图谱过期，保留上次结果');
 const ids=new Set();for(const n of s.nodes){if(typeof n.id!=='string'||ids.has(n.id)||!Object.hasOwn(s.documents,n.kg))throw Error('自动目录：实体范围异常');ids.add(n.id);}
 for(const r of s.relations)if(!ids.has(r.source)||!ids.has(r.target)||typeof r.type!=='string')throw Error('自动目录：关系缺少来源实体');
}
function render(s,c){
 validate(s,c);const files={},groups=new Map(),nodes=new Map(s.nodes.map(n=>[n.id,n])),adj=new Map(s.nodes.map(n=>[n.id,[]])),byCategory=new Map();
 for(const n of s.nodes){if(!groups.has(n.kg))groups.set(n.kg,[]);groups.get(n.kg).push(n);}
 for(const r of s.relations){adj.get(r.source).push(r);if(r.source!==r.target)adj.get(r.target).push(r);}
 let graphs=0,isolated=s.nodes.filter(n=>!adj.get(n.id).length).length;
 for(const [kg,d]of Object.entries(s.documents).sort((a,b)=>String(a[1].title).localeCompare(String(b[1].title),'zh-CN'))){
  const title=d.title||'未命名资料',cat=category(title),ns=groups.get(kg)||[],url=c.base+'/platform/knowledge-bases/'+encodeURIComponent(c.kb)+'?knowledge_id='+encodeURIComponent(kg),ready=d.parse_status==='completed';
  if(!byCategory.has(cat))byCategory.set(cat,[]);byCategory.get(cat).push(wiki(cardPath(kg),title));
  const lines=[`# ${plain(title)}`,'',`[在 WeKnora 查看原文](${url})`,'',`- 自动分类：${cat}`,`- 解析状态：${plain(d.parse_status)}`,`- 文档 ID：\`${kg}\``,`- 当前导出包含 ${ns.length} 个实体。`,''];
  if(ready&&ns.length)lines.push(wiki(canvasPath(kg),'打开精简关系图'),'', '简图显示一个中心及最多六个邻居；点击实体查看属性、关系和来源分块。');
  else lines.push(ready?'本次导出没有实体：需核对文档是否适合抽取、图谱配置与处理结果。':'文档尚未完成解析，本轮不更新其简图，保留已有本地内容。');
  lines.push('','> 自动抽取未独立复核；工程结论需要回到原文。分类依据标题规则，无法确定的进入“待分类”。','',wiki(PREFIX+'/00-自动知识库.md','返回自动资料导航'));
  files[cardPath(kg)]=note({title,source_document_id:kg,领域:cat,parse_status:d.parse_status||'unknown',验证状态:'自动生成，待核对'},lines.join('\n'));
  if(!ready||!ns.length)continue;
  const degree=n=>adj.get(n.id).filter(r=>nodes.get(r.source).kg===kg&&nodes.get(r.target).kg===kg).length;
  const meaningful=ns.filter(n=>/\p{L}/u.test(n.name||'')&&! /^(table|figure|图\s*\d|表\s*\d)/i.test(n.name||'')&&String(n.name).length<100);
  const center=[...(meaningful.length?meaningful:ns)].sort((a,b)=>degree(b)-degree(a)||a.id.localeCompare(b.id))[0];
  const neighborEdges=new Map();
  for(const r of adj.get(center.id)){const other=r.source===center.id?r.target:r.source;if(other!==center.id&&nodes.get(other).kg===kg){if(!neighborEdges.has(other))neighborEdges.set(other,[]);neighborEdges.get(other).push(r);}}
  const chosen=[...neighborEdges.keys()].sort((a,b)=>degree(nodes.get(b))-degree(nodes.get(a))||a.localeCompare(b)).slice(0,6);
  const selected=[center.id,...chosen],positions=new Map([[center.id,[800,340]]]);const slots=[[0,0],[1600,0],[0,340],[1600,340],[0,680],[1600,680]];chosen.forEach((nid,i)=>positions.set(nid,slots[i]));
  const cn=[{id:'header',type:'text',text:`# ${plain(title)}\n自动抽取 · 未独立复核 · 显示 ${selected.length} / ${ns.length} 个实体\n`+wiki(cardPath(kg),'来源与解析状态'),x:0,y:-250,width:2000,height:180,color:'5'}];
  for(const nid of selected){const n=nodes.get(nid),xy=positions.get(nid);cn.push({id:id(nid),type:'text',text:`### ${plain(n.name)}\n\n`+(nid===center.id?'**中心实体**\n\n':'')+wiki(nodePath(n),'查看关系与来源'),x:xy[0],y:xy[1],width:400,height:210,color:nid===center.id?'4':'5'});
   const nl=[`# ${plain(n.name)}`,'',wiki(cardPath(kg),title),'','> WeKnora 自动抽取，未独立复核。请在另一篇普通笔记中撰写自己的结论。','','## 属性','',...[...(n.attributes||[])].sort().map(x=>'- '+plain(x)),'','## 原始关系',''];
   for(const r of [...adj.get(nid)].sort((a,b)=>a.source.localeCompare(b.source)||a.type.localeCompare(b.type)||a.target.localeCompare(b.target)))nl.push(`- ${plain(nodes.get(r.source).name)} → **${plain(r.type)}** → ${plain(nodes.get(r.target).name)}`);
   nl.push('','## 来源分块','',...[...(n.chunks||[])].sort().map(x=>'- `'+plain(x)+'`'));
   files[nodePath(n)]=note({title:n.name||'未命名实体',source_document_id:kg,source_entity_id:nid,验证状态:'模型抽取，待核对'},nl.join('\n'));
  }
  const ce=chosen.map((nid,i)=>{const r=[...neighborEdges.get(nid)].sort((a,b)=>a.type.length-b.type.length||a.type.localeCompare(b.type)||a.source.localeCompare(b.source))[0];const right=positions.get(r.source)[0]<positions.get(r.target)[0];return {id:'edge'+i,fromNode:id(r.source),fromSide:right?'right':'left',toNode:id(r.target),toSide:right?'left':'right',toEnd:'arrow',label:plain(r.type)};});
  cn.push({id:'footer',type:'text',text:'沿箭头读“实体 → 关系 → 实体”。中心按连接数量选择，不代表已核对的系统架构。\n每个邻居只展示一条原始关系；其他关系在实体笔记中。',x:0,y:990,width:2000,height:150});
  files[canvasPath(kg)]=JSON.stringify({nodes:cn,edges:ce},null,2);graphs++;
 }
 const index=['# 自动知识库','',`当前 ${Object.keys(s.documents).length} 份资料 · ${graphs} 张简图 · ${s.nodes.length} 个远端实体`,'','本页随插件自动刷新。先按分类打开资料，再查看带名称和箭头的简图。', '', '## 按领域找资料',''];
 for(const [cat,links]of byCategory){index.push(`### ${cat}`,'',...links.map(x=>'- '+x),'');}
 index.push('## 更新与质量','',`- 图谱中有 ${isolated} 个无连线实体，未据此推断关联。`,'- 服务器每 10 分钟导出；Obsidian 打开时启动检查，之后每 15 分钟拉取。','- 无变化不重写；手工修改过的自动文件保留并列入冲突。','- 网络失败保留已有资料。状态与重试入口：命令面板 → WeKnora → 查看自动整理状态。','- 自动分类与图谱未独立复核；不会自动合并同名工程概念。','- 自动目录只生成阅读入口及简图，原文件、向量索引和问答仍由 WeKnora 管理。');
 files[PREFIX+'/00-自动知识库.md']=note({类型:'自动导航'},index.join('\n'));
 return files;
}
function canonical(x){return Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;}
function hash(path,text){if(path.endsWith('.canvas')){try{text=JSON.stringify(canonical(JSON.parse(text)));}catch{}}return digest(text.replace(/\r\n/g,'\n'));}
async function refresh(snapshot,config,state,io,persist){
 const desired=render(snapshot,config);state.files??={};state.docs??={};const conflicts=[];let written=0;
 // Remote disappearance is reversible: keep source notes, change only owned unchanged notes.
 for(const [kg,rec]of Object.entries(state.docs))if(!Object.hasOwn(snapshot.documents,kg))desired[cardPath(kg)]=note({title:rec.title,source_document_id:kg,parse_status:'removed'},`# ${plain(rec.title)}\n\n远端已移出当前知识库；保留本地记录与之前的简图。\n\n`+wiki(PREFIX+'/00-自动知识库.md','当前资料目录'));
 try{
  for(const [path,text]of Object.entries(desired)){
   const current=await io.read(path),wanted=hash(path,text),previous=state.files[path];
   if(current!==null&&hash(path,current)===wanted){state.files[path]=wanted;continue;}
   if(current!==null&&(!previous||hash(path,current)!==previous)){conflicts.push(path);continue;}
   await io.write(path,text,current);state.files[path]=wanted;written++;
  }
  for(const [kg,d]of Object.entries(snapshot.documents))state.docs[kg]={title:d.title||'未命名资料'};
  state.lastSuccess=new Date().toISOString();state.snapshotAt=snapshot.generated_at;state.conflicts=conflicts;state.documents=Object.keys(snapshot.documents).length;state.error=null;
 }finally{await persist();}
 return {written,conflicts,documents:Object.keys(snapshot.documents).length};
}
module.exports={render,refresh,hash,PREFIX};
