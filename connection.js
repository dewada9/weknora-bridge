function serviceUrl(base){
 let url;try{url=new URL(base.trim());}catch{throw Error('服务地址无效，请在设置中修正');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('服务地址应为 HTTP(S) 根地址，不包含账户、路径或查询参数');
 const h=url.hostname.toLowerCase(),ip=h.split('.').map(Number);
 const privateHost=h==='localhost'||h==='[::1]'||/^\[(?:fc|fd)[0-9a-f]{2}:|^\[fe[89ab][0-9a-f]:/.test(h)||(/^\d+\.\d+\.\d+\.\d+$/.test(h)&&(ip[0]===127||ip[0]===10||ip[0]===192&&ip[1]===168||ip[0]===172&&ip[1]>=16&&ip[1]<=31||ip[0]===100&&ip[1]>=64&&ip[1]<=127||ip[0]===169&&ip[1]===254));
 if(url.protocol==='http:'&&!privateHost)throw Error('公网服务地址请使用 HTTPS，避免明文发送 API 密钥和文件');
 return url;
}
async function resolveConnection(app,settings={}){
 if(!app.secretStorage?.getSecret)throw Error('请升级 Obsidian 至 1.11.4 或更高版本，在设置中配置密钥');
 if(!settings.base||!settings.kb?.trim()||!settings.secretName)throw Error('请在设置 → WeKnora 知识库中填写服务地址、知识库 ID 并选择 API 密钥');
 const url=serviceUrl(settings.base);
 const key=await app.secretStorage.getSecret(settings.secretName);
 if(!key?.trim())throw Error('API 密钥不可用，请在设置 → WeKnora 知识库中重新选择或创建密钥');
 return {base:url.origin,kb:settings.kb.trim(),key:key.trim()};
}
module.exports={resolveConnection,serviceUrl};
