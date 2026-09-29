const fs=require('fs');const path=require('path');
function bundle(name,parents=[]){
 if(parents.includes(name))throw Error('Circular local module '+name);
 return fs.readFileSync(path.join(__dirname,name+'.js'),'utf8').replace(/require\('\.\/(\w+)'\)/g,(_,dep)=>`(()=>{const module={exports:{}};\n${bundle(dep,[...parents,name])}\nreturn module.exports;})()`);
}
const code=bundle('main');
const dir=path.join(__dirname,'dist');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'main.js'),code);
for(const f of ['manifest.json','styles.css'])fs.copyFileSync(path.join(__dirname,f),path.join(dir,f));
console.log('Built standalone Obsidian plugin');
