const http=require('http');
const https=require('https');
const zlib=require('zlib');
const {randomBytes}=require('crypto');
function engineeringMetadata(path,bytes,parseYaml){
 let fm={};const front=/\.md$/i.test(path)&&bytes.toString('utf8').match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
 if(front&&parseYaml){try{fm=parseYaml(front[1])||{};}catch{throw Object.assign(Error('笔记属性格式错误，请修正 YAML 后重试'),{definitelyNotSent:true});}}
 const str=k=>typeof fm[k]==='string'?fm[k].trim().slice(0,200):'';
 const candidate=path.split('/').pop().match(/(?:^|[_ -])([RV]\d+(?:\.\d+)*)(?=[_ .-]|$)/i)?.[1]||'';
 const version=str('版本')||candidate||'待确认';
 const status=str('资料状态'),evidence=str('验证状态');
 return {engineering_schema:'1',engineering_project:str('项目')||(path.startsWith('02-项目/')&&path.split('/').length>2?path.split('/')[1]:'未分类'),engineering_version:version,engineering_version_origin:str('版本')?'declared':candidate?'filename':'unknown',engineering_status:['草稿','待确认','现行','已废止'].includes(status)?status:'待确认',engineering_evidence:['待确认','待验证','有来源','已有实测'].includes(evidence)?evidence:'待确认',engineering_date:str('日期'),engineering_source:str('来源')};
}
class Api {
 constructor(config,parseYaml){this.parseYaml=parseYaml;this.config=config;const u=new URL(config.base);if(u.username||u.password||u.pathname!=='/'||u.search||u.hash||!['http:','https:'].includes(u.protocol))throw Error('服务地址格式错误');this.base=u.origin;this.kb=encodeURIComponent(config.kb);this.agent=new (u.protocol==='https:'?https:http).Agent({keepAlive:true,maxSockets:2,maxFreeSockets:1,timeout:30000});}
 close(){this.agent.destroy();}
 request(method,path,body,headers={}){
  if(!path.startsWith('/api/v1/'))throw Error('接口路径无效');
  const data=body===undefined?null:Buffer.isBuffer(body)?body:Buffer.from(JSON.stringify(body));
  return new Promise((resolve,reject)=>{
   let connected=false;
   const req=(this.base.startsWith('https:')?https:http).request(this.base+path,{method,agent:this.agent,headers:{'X-API-Key':this.config.key,'Accept-Encoding':'gzip',...(data?{'Content-Type':'application/json','Content-Length':data.length}:{}),...headers}},res=>{
    const stream=res.headers['content-encoding']==='gzip'?res.pipe(zlib.createGunzip()):res;
    let size=0;const chunks=[];stream.on('data',chunk=>{size+=chunk.length;if(size>8*1024*1024){reject(Error('返回内容过大'));stream.destroy();req.destroy();return;}chunks.push(chunk);});res.on('error',reject);stream.on('error',()=>reject(Error('服务器返回内容解码失败')));stream.on('end',()=>{
     let json;try{json=JSON.parse(Buffer.concat(chunks).toString());}catch{reject(Error('服务器返回格式错误（HTTP '+res.statusCode+'）'));return;}
     if(res.statusCode===409&&json.code==='duplicate_file'&&json.data){resolve(json);return;}
     if(res.statusCode<200||res.statusCode>=300||json.success===false){reject(Object.assign(Error('请求失败（HTTP '+res.statusCode+'），请检查网络、权限或远端文档状态'),{definitelyNotSent:[400,401,403,404,413,415].includes(res.statusCode)}));return;}
     resolve(json);
    });
   });
   const timer=setTimeout(()=>req.destroy(Error('连接超时；请检查 Tailscale 后重试')),90000);
   req.on('socket',socket=>{if(!socket.connecting)connected=true;else socket.once('connect',()=>{connected=true;});});
   req.on('close',()=>clearTimeout(timer));req.on('error',e=>reject(Object.assign(Error('连接失败；请检查 Tailscale 后重试'),{definitelyNotSent:!connected})));req.end(data);
  });
 }
 async get(id){return (await this.request('GET','/api/v1/knowledge/'+encodeURIComponent(id))).data;}
 async updateTitle(id,title){return (await this.request('PUT','/api/v1/knowledge/'+encodeURIComponent(id),{title})).data;}
 async find(source){let found=[];for(let page=1;page<=100;page++){const r=await this.request('GET',`/api/v1/knowledge-bases/${this.kb}/knowledge?page=${page}&page_size=100`);const rows=r.data;if(!Array.isArray(rows))throw Error('文件列表格式错误');found.push(...rows.filter(x=>x.metadata?.obsidian_source===source));if(page*100>=r.total||rows.length<100)return found;}throw Error('文档过多，请在网页核对上传状态');}
 async upload(method,url,path,bytes,source,expected,attempt){
  const boundary='weknora'+randomBytes(18).toString('hex');const clean=path.replace(/[\r\n"\\]/g,'_');const filename=clean.split('/').pop();
  const fields={fileName:'Obsidian/'+clean,channel:'obsidian',metadata:JSON.stringify({...engineeringMetadata(path,bytes,this.parseYaml),obsidian_source:source,obsidian_path:path,...(attempt?{obsidian_attempt:attempt}:{})})};
  const chunks=[];for(const [k,v]of Object.entries(fields))chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`),bytes,Buffer.from(`\r\n--${boundary}--\r\n`));
  return (await this.request(method,url,Buffer.concat(chunks),{'Content-Type':'multipart/form-data; boundary='+boundary,...(expected?{'If-Match':expected}:{})})).data;
 }
 create(path,bytes,source){return this.upload('POST',`/api/v1/knowledge-bases/${this.kb}/knowledge/file`,path,bytes,source);}
 replace(id,path,bytes,expected,source,attempt){return this.upload('PUT','/api/v1/knowledge/'+encodeURIComponent(id)+'/file',path,bytes,source,expected,attempt);}
 async search(query){return (await this.request('POST',`/api/v1/knowledge-bases/${this.kb}/hybrid-search`,{query_text:query.slice(0,4000),match_count:8,vector_threshold:0.35})).data;}
}
module.exports={Api};
