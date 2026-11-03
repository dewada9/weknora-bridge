const {createHash}=require('crypto'),{inflateRawSync}=require('zlib');
const PREFIX='06-自动知识库/原文插图',ASSETS='99-附件/WeKnora原文',LIMIT=25*1024*1024;
const hash=b=>createHash('sha256').update(b).digest('hex'),md5=b=>createHash('md5').update(b).digest('hex');
const label=s=>Array.from(String(s||'原文').replace(/[\\/:*?"<>|\[\]#^\x00-\x1f]/g,'-')).slice(0,64).join('').replace(/[ .]+$/,'')||'原文';
function validImage(b,ext){return ext==='png'?b.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')):/jpe?g/.test(ext)?b[0]===255&&b[1]===216:ext==='webp'?b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP':ext==='gif'?b.toString('ascii',0,3)==='GIF':ext==='bmp'?b.toString('ascii',0,2)==='BM':false;}
function docxImages(b,limit=10*1024*1024){
 if(!Buffer.isBuffer(b)||b.length<22||b.length>LIMIT)throw Error('DOCX ZIP格式无效');let e=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50&&i+22+b.readUInt16LE(i+20)===b.length){e=i;break;}
 if(e<0)throw Error('DOCX ZIP格式无效');const count=b.readUInt16LE(e+10),start=b.readUInt32LE(e+16),size=b.readUInt32LE(e+12);if(count>4096||b.readUInt16LE(e+4)||b.readUInt16LE(e+6)||start+size!==e)throw Error('ZIP目录过大或格式不支持');
 const entries=new Map();let p=start,total=0;
 for(let i=0;i<count;i++){
  if(p+46>e||b.readUInt32LE(p)!==0x02014b50)throw Error('ZIP目录无效');const flags=b.readUInt16LE(p+8),method=b.readUInt16LE(p+10),compressed=b.readUInt32LE(p+20),raw=b.readUInt32LE(p+24),nl=b.readUInt16LE(p+28),extra=b.readUInt16LE(p+30),comment=b.readUInt16LE(p+32),local=b.readUInt32LE(p+42);if(p+46+nl+extra+comment>e)throw Error('ZIP目录截断');const name=b.toString('utf8',p+46,p+46+nl);p+=46+nl+extra+comment;
  if(name.includes('\\')||name.startsWith('/')||name.split('/').includes('..')||name.includes('\0'))throw Error('ZIP路径无效');if(entries.has(name))throw Error('ZIP重复文件');if(flags&1)throw Error('不支持加密ZIP');entries.set(name,{method,compressed,raw,local});
 }
 function read(name){const x=entries.get(name);if(!x)return null;if(x.raw>limit||total+x.raw>20*1024*1024)throw Error('DOCX图片或XML过大');if(x.local+30>start||b.readUInt32LE(x.local)!==0x04034b50)throw Error('ZIP文件头无效');const nl=b.readUInt16LE(x.local+26),el=b.readUInt16LE(x.local+28),at=x.local+30+nl+el;if(b.toString('utf8',x.local+30,x.local+30+nl)!==name||at+x.compressed>start)throw Error('ZIP数据越界');const part=b.subarray(at,at+x.compressed),out=x.method===0?Buffer.from(part):x.method===8?inflateRawSync(part,{maxOutputLength:limit}):null;if(!out||out.length!==x.raw)throw Error('ZIP压缩格式无效');total+=out.length;return out;}
 const rels=(read('word/_rels/document.xml.rels')||Buffer.alloc(0)).toString(),xml=(read('word/document.xml')||Buffer.alloc(0)).toString(),byId=new Map();
 for(const m of rels.matchAll(/<Relationship\b([^>]+)>/g)){const attrs=Object.fromEntries([...m[1].matchAll(/([\w:]+)="([^"]*)"/g)].map(x=>[x[1],x[2]]));if(attrs.TargetMode!=='External'&&/^media\/[^/]+$/.test(attrs.Target||''))byId.set(attrs.Id,'word/'+attrs.Target);}
 const ordered=[...xml.matchAll(/r:embed="([^"]+)"/g)].map(x=>byId.get(x[1])).filter(Boolean);for(const name of entries.keys())if(/^word\/media\/[^/]+$/.test(name)&&!ordered.includes(name))ordered.push(name);
 let unsupported=0;const images=[];for(const name of new Set(ordered)){const ext=name.split('.').pop().toLowerCase();if(!/^(png|jpe?g|webp|gif|bmp)$/.test(ext)){unsupported++;continue;}const bytes=read(name);if(!validImage(bytes,ext)){unsupported++;continue;}images.push({ext,bytes,referenced:[...xml.matchAll(/r:embed="([^"]+)"/g)].some(x=>byId.get(x[1])===name)});if(images.length>200)throw Error('DOCX图片数量过多');}
 return {images,unsupported};
}
async function syncDocuments(documents,{kb,state,api,io,save,guard=()=>true}){
 if(state.kb&&state.kb!==kb)throw Error('原文缓存知识库范围不匹配');state.kb=kb;state.docs??={};state.files??={};const errors=[],conflicts=[];let updated=0,visited=0;const started=Date.now(),offset=Number.isInteger(state.cursor)?state.cursor%Math.max(1,documents.length):0;documents=[...documents.slice(offset),...documents.slice(0,offset)];
 const write=async(path,bytes)=>{bytes=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);const current=await io.read(path),wanted=hash(bytes);if(current!==null){if(hash(current)===wanted){state.files[path]=wanted;return;}if(!state.files[path]||hash(current)!==state.files[path])throw Error('保留手工修改：'+path);}if(!guard())throw Error('同步已暂停');await io.write(path,bytes,current);state.files[path]=wanted;};
 for(const d of documents){
  const ext=String(d.file_type||d.title?.split('.').pop()||'').toLowerCase();if(d.knowledge_base_id!==kb||d.parse_status!=='completed'||! /^[a-zA-Z0-9-]{1,80}$/.test(d.id)||! /^[a-f0-9]{32}$/i.test(d.file_hash)||! /^(pdf|docx|png|jpe?g|webp|gif|bmp)$/.test(ext))continue;
  if(visited>=20||Date.now()-started>60000)break;visited++;state.cursor=(offset+documents.indexOf(d)+1)%Math.max(1,documents.length);
  try{
   if(!guard())break;if(d.file_size>LIMIT)throw Error('原文超过25MiB，保留网页入口');
   const folder=ASSETS+'/'+d.id+'/'+d.file_hash,original=folder+'/原文件.'+ext;let bytes=await io.read(original);
   if(bytes!==null&&md5(bytes)!==d.file_hash)throw Error('缓存原文已修改，保留本地内容');if(bytes===null)bytes=await api.download(d.id,LIMIT);
   if(!Buffer.isBuffer(bytes)||bytes.length>LIMIT||md5(bytes)!==d.file_hash)throw Error('原文校验失败，未生成预览');
   const now=await api.get(d.id);if(now.id!==d.id||now.knowledge_base_id!==kb||now.file_hash!==d.file_hash||now.parse_status!=='completed')throw Error('原文发生变化，稍后重试');
   let extracted={images:[],unsupported:0};if(ext==='docx')extracted=docxImages(bytes);else if(ext==='pdf'){if(bytes.toString('ascii',0,5)!=='%PDF-')throw Error('PDF格式无效');}else if(!validImage(bytes,ext))throw Error('图片格式无效');
   await write(original,bytes);const assets=[original],note=PREFIX+'/'+label(d.title)+' - '+d.id.slice(0,8)+'.md';const lines=['---','weknora_sync: false','automatic_library: true','source_document_id: '+JSON.stringify(d.id),'source_file_hash: '+JSON.stringify(d.file_hash),'---','','# '+label(d.title),'','> 原始文件及内嵌图片；未经模型重绘。这里只负责显示原图，不代表已完成图片OCR或向量检索。','','[['+original+'|打开原始文件]]',''];
   if(ext==='pdf')lines.push('## 原文预览','','PDF保留原有页码、矢量框图和截图，可在预览中翻页。','','![['+original+'#page=1]]');
   else if(ext==='docx'){lines.push('## 原文插图','','先按正文首次引用顺序展示，每张图片仅显示一次；Word重排后页码可能变化，因此不推测页码或图题。未在正文中引用的内嵌图会单独标明。','');for(const [i,image]of extracted.images.entries()){const path=folder+'/插图-'+String(i+1).padStart(3,'0')+'.'+image.ext;await write(path,image.bytes);assets.push(path);lines.push('### 插图 '+(i+1)+(image.referenced?'':'（其他内嵌图片，未找到正文引用）'),'','![['+path+']]','');}if(!extracted.images.length)lines.push('原文没有可直接显示的内嵌栅格图片。');if(extracted.unsupported)lines.push('另有 '+extracted.unsupported+' 个图片对象格式不支持直接显示，请打开原始Word核对。');}
   else lines.push('![['+original+']]');
   await write(note,lines.join('\n')+'\n');state.docs[d.id]={title:d.title,hash:d.file_hash,original,note,assets,images:extracted.images.length};updated++;await save();
  }catch(e){errors.push({id:d.id,error:e.message});if(/手工|修改/.test(e.message))conflicts.push(d.id);if(e.networkError||[401,403,429].includes(e.statusCode))break;}
 }
 const rows=Object.values(state.docs).filter(d=>d.note),index=PREFIX+'/00-原文插图.md';if(rows.length){try{await write(index,'---\nweknora_sync: false\nautomatic_library: true\n---\n\n# 原文与插图\n\nPDF直接预览，Word显示内嵌图片。图片与原文件保存在本机附件目录，使用原有密钥下载，不生成公开图片链接。\n\n'+rows.map(d=>'- [['+d.note+'|'+label(d.title)+']]').join('\n')+'\n');}catch(e){errors.push({error:e.message});}}
 state.lastSync=new Date().toISOString();state.errors=errors;state.conflicts=conflicts;await save();return {updated,errors,paths:Object.fromEntries(Object.entries(state.docs).map(([id,d])=>[id,d.note]))};
}
module.exports={docxImages,syncDocuments,LIMIT};
