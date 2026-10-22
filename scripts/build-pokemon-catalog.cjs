#!/usr/bin/env node
/* Compila Pokémon enviados ao Git; reutiliza a busca de moves da própria Pokédex. */
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const ROOT=path.resolve(__dirname,'..');
const TYPES=['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
const STATS=['hp','atk','def','spa','spd','spe'];
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/armour/g,'armor').replace(/[’']/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
const fail=message=>{throw Error(message);};
const text=(value,label,required=false)=>{if(value==null&&!required)return '';if(typeof value!=='string'||required&&!value.trim())fail(label+': informe um texto.');return value.trim();};

function stableId(key){
  const ns=Buffer.from('6ba7b8109dad11d180b400c04fd430c8','hex');
  const bytes=crypto.createHash('sha1').update(ns).update('N4nd0-Hub/Pok-dex-GM/'+key).digest().subarray(0,16);
  bytes[6]=(bytes[6]&15)|80;bytes[8]=(bytes[8]&63)|128;
  const hex=bytes.toString('hex');return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
function stats(value,label){
  if(!value||STATS.some(k=>!Number.isInteger(value[k])||value[k]<1||value[k]>999))fail(label+': informe hp, atk, def, spa, spd e spe entre 1 e 999.');
  return Object.fromEntries(STATS.map(k=>[k,value[k]]));
}
function type(value,label,optional=false){if(optional&&(value==null||value===''))return '';if(!TYPES.includes(value))fail(label+': tipo inválido.');return value;}
function slug(value,label){if(typeof value!=='string'||!/^([a-z0-9]+-)*[a-z0-9]+$/.test(value))fail(label+': use letras minúsculas, números e hífens.');return value;}
function list(value,label){if(!Array.isArray(value))fail(label+': informe uma lista.');return value;}
function status(value){if(!['published','draft','archived'].includes(value))fail('status: use published, draft ou archived.');return value;}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(d=>d.isDirectory()?(d.name==='artes'?[]:walk(path.join(dir,d.name))):d.name.endsWith('.pokemon.json')?[path.join(dir,d.name)]:[]);}

function linkEvolutions(species){
  const aliases=new Map(),parents=new Map(),children=new Map(species.map(s=>[s.id,new Set()]));
  for(const s of species)for(const name of [s.repository.key,s.slug,s.name]){
    const key=normalize(name);if(!aliases.has(key))aliases.set(key,s);else if(aliases.get(key)?.id!==s.id)aliases.set(key,null);
  }
  const edge=(from,to)=>{
    if(!from||!to)return;if(from.id===to.id)fail('Evolução não pode apontar para o próprio Pokémon: '+from.name);
    const old=parents.get(to.id);if(old&&old.id!==from.id)fail('Duas pré-evoluções conflitantes para '+to.name+'.');
    parents.set(to.id,from);children.get(from.id).add(to.id);
  };
  for(const s of species){
    if(s.evolution.previous)edge(aliases.get(normalize(s.evolution.previous)),s);
    if(s.evolution.next)for(const name of String(s.evolution.next).split(/\s*[,;\/]\s*/))edge(s,aliases.get(normalize(name)));
  }
  const byId=new Map(species.map(s=>[s.id,s]));
  for(const s of species){
    const visited=new Set([s.id]);let root=s,stage=0;
    while(parents.has(root.id)){root=parents.get(root.id);if(visited.has(root.id))fail('Ciclo na linha evolutiva de '+s.name+'.');visited.add(root.id);stage++;}
    const next=[...children.get(s.id)],previous=parents.get(s.id);
    if(!previous&&!next.length)continue;
    s.evolution={...s.evolution,chainId:stableId('evolution/'+root.repository.key),stage,previousId:previous?.id||null,nextIds:next,
      previous:previous?.name||s.evolution.previous||'',next:next.length?next.map(id=>byId.get(id).name).join(' / '):s.evolution.next||''};
  }
}

async function build(options={}){
  const root=options.root||ROOT,folder=path.join(root,'pokemons'),out=path.join(folder,'catalogo.json');
  const bank=JSON.parse(fs.readFileSync(path.join(root,'system-bank.json'),'utf8'));
  const context=vm.createContext({window:{POKEDEX_SYSTEM_LIBRARY:{data:bank,ready:Promise.resolve()}},fetch:options.fetch||fetch,AbortController,setTimeout,clearTimeout});
  vm.runInContext(fs.readFileSync(path.join(ROOT,'move-lookup.js'),'utf8'),context);
  const lookup=context.window.POKEDEX_MOVE_LOOKUP.lookup;
  let previous={species:[]};try{previous=JSON.parse(fs.readFileSync(out,'utf8'));}catch{}
  const cachedMoves=previous.species.flatMap(s=>s.moves||[]);
  const abilities=new Map(bank.abilities.map(a=>[normalize(a.name),a]));
  const keys=new Set(),slugs=new Set(),species=[],forms=[];
  function ability(raw){
    const row=typeof raw==='string'?{name:raw}:raw;if(!row||typeof row!=='object')fail('Ability inválida.');
    const name=text(row.name,'Ability.name',true),known=abilities.get(normalize(name));
    const description=row.text??row.description??known?.description;
    if(typeof description!=='string'||!description.trim())fail('Ability '+name+': efeito não encontrado; informe text para uma Ability nova.');
    return {name:known?.name||name,text:description.trim()};
  }
  async function move(raw){
    const row=typeof raw==='string'?{name:raw}:raw;if(!row||typeof row!=='object')fail('Move inválido.');
    const name=text(row.name,'Move.name',true);let base;
    const complete=typeof (row.text??row.description)==='string'&&row.type&&row.category&&row.power!=null&&Object.hasOwn(row,'accuracy');
    if(!complete){
      const isSystem=bank.moves.some(m=>normalize(m.name)===normalize(name));
      const cached=!isSystem&&cachedMoves.find(m=>normalize(m.name)===normalize(name));
      base=cached||await lookup(name);
    }
    const result={...base,...row,name:base?.name||name,text:row.text??row.description??base?.text??'',learn:text(row.learn,'Move.learn')};
    result.type=type(result.type,name+'.type');
    if(!['Physical','Special','Status'].includes(result.category))fail(name+': categoria inválida.');
    if(result.category==='Status')result.power=0;
    if(!Number.isInteger(result.power)||result.power<0||result.power>999)fail(name+': Power inválido.');
    let accuracy=result.alwaysHits?null:result.accuracy;
    if(accuracy===0)accuracy=null;
    if(accuracy!=null&&(!Number.isInteger(accuracy)||accuracy<1||accuracy>100))fail(name+': precisão inválida.');
    const canonical=result.accuracyCanonical??result.canonicalAccuracy??accuracy??null;
    if(canonical!=null&&(!Number.isInteger(canonical)||canonical<1||canonical>100))fail(name+': precisão canônica inválida.');
    return {name:result.name,type:result.type,category:result.category,power:result.power,accuracy:accuracy==null?null:Math.min(90,accuracy),accuracyCanonical:canonical,learn:result.learn,text:text(result.text,name+'.text',true)};
  }
  function art(value,label){
    if(!value)return '';
    text(value,label,true);
    if(/^https:\/\//i.test(value)){const u=new URL(value);if(u.username||u.password)fail(label+': URL com credenciais.');return u.href;}
    if(value.includes('\\')||value.startsWith('/')||value.split('/').includes('..')||!/^artes\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/i.test(value))fail(label+': use artes/nome.png ou uma URL HTTPS.');
    const local=path.resolve(folder,value);
    if(!local.startsWith(path.resolve(folder)+path.sep)||!fs.existsSync(local))fail(label+': arquivo não encontrado: '+value);
    const real=fs.realpathSync(local);if(!real.startsWith(fs.realpathSync(folder)+path.sep))fail(label+': arquivo fora da pasta pokemons.');
    const size=fs.statSync(local).size;if(size<1||size>10485760)fail(label+': imagem deve ter até 10 MB.');
    return 'pokemons/'+value;
  }
  for(const file of walk(folder)){
    const filename=path.relative(root,file).split(path.sep).join('/');
    try{
      if(!fs.realpathSync(file).startsWith(fs.realpathSync(folder)+path.sep))fail('Arquivo fora da pasta pokemons.');
      const raw=JSON.parse(fs.readFileSync(file,'utf8'));
      if(raw.schema!=='pokedex-pokemon-v1')fail('schema deve ser pokedex-pokemon-v1.');
      if(raw.notes)fail('Notas privadas devem ser cadastradas no painel GM, fora do Git público.');
      const key=slug(raw.key,'key');if(keys.has(key))fail('key duplicada: '+key);keys.add(key);
      const name=text(raw.name,'name',true),speciesSlug=slug(raw.slug||key,'slug');if(slugs.has(speciesSlug))fail('slug duplicado: '+speciesSlug);slugs.add(speciesSlug);
      const classification=raw.classification||'fakemon';if(!['fakemon','rework','official'].includes(classification))fail('classification inválida.');
      const revision=raw.revision??1;if(!Number.isInteger(revision)||revision<1)fail('revision deve ser inteiro positivo.');
      const id=stableId(key),state=status(raw.status);
      if(raw.dex!=null&&(!Number.isInteger(raw.dex)||raw.dex<1))fail('dex inválido.');
      const ab=list(raw.abilities,'abilities').map(ability);if(!ab.length)fail('Informe ao menos uma Ability.');
      const mov=[];for(const entry of list(raw.moves||[],'moves'))mov.push(await move(entry));
      if(new Set(mov.map(m=>normalize(m.name))).size!==mov.length)fail('Moves repetidos.');
      const type1=type(raw.type1,'type1'),type2=type(raw.type2,'type2',true);if(type1===type2)fail('Os dois tipos não podem ser iguais.');
      const evolution=raw.evolution||{};for(const field of ['previous','next','level','requirements'])if(evolution[field]!=null&&typeof evolution[field]!=='string'&&typeof evolution[field]!=='number')fail('evolution.'+field+': use texto ou número.');
      const date=raw.updatedAt||null;if(date&&(!Number.isFinite(Date.parse(date))||typeof date!=='string'))fail('updatedAt inválido.');
      const repository={key,file:filename,revision,sourceOnly:true};
      species.push({id,slug:speciesSlug,dex:raw.dex??null,name,classification,category:text(raw.category,'category'),description:text(raw.description,'description'),type1,type2,baseStats:stats(raw.baseStats,'baseStats'),abilities:ab,moves:mov,evolution,specialRules:text(raw.specialRules,'specialRules'),notes:'',coverArtId:null,coverUrl:art(raw.art,'art'),status:state,revision,publishedRevision:state==='published'?revision:null,createdAt:date,updatedAt:date,publishedAt:state==='published'?date:null,repository});
      const formKeys=new Set();
      for(const form of list(raw.forms||[],'forms')){
        const formKey=slug(form.key,'forms.key');if(formKeys.has(formKey))fail('Formas com key duplicada.');formKeys.add(formKey);
        const kind=form.kind||'alternate';if(!['mega','regional','alternate','shiny','primal','gigantamax','other'].includes(kind))fail('forms.kind inválido.');
        const f1=type(form.type1,'forms.type1'),f2=type(form.type2,'forms.type2',true);if(f1===f2)fail('Tipos repetidos na forma.');
        const fa=list(form.abilities,'forms.abilities').map(ability);if(!fa.length)fail('Informe ao menos uma Ability para a forma.');
        forms.push({id:stableId(key+'/forms/'+formKey),speciesId:id,slug:slug(form.slug||speciesSlug+'-'+formKey,'forms.slug'),name:text(form.name,'forms.name',true),kind,type1:f1,type2:f2,baseStats:stats(form.baseStats,'forms.baseStats'),abilities:fa,specialRules:text(form.specialRules,'forms.specialRules'),artId:null,artUrl:art(form.art,'forms.art'),status:status(form.status||state),revision,updatedAt:date,repository:{...repository,key:key+'/'+formKey}});
      }
    }catch(error){fail(filename+': '+error.message);}
  }
  linkEvolutions(species);
  const payload={format:'pokedex-repository-v1',species,forms};
  const hash=crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const catalog={...payload,hash};
  const content=JSON.stringify(catalog,null,2)+'\n';
  if(options.check){if(!fs.existsSync(out)||fs.readFileSync(out,'utf8')!==content)fail('Catálogo desatualizado. Execute node scripts/build-pokemon-catalog.cjs e inclua pokemons/catalogo.json no commit.');}
  else fs.writeFileSync(out,content);
  return catalog;
}
module.exports={build,stableId,normalize};
if(require.main===module)build({check:process.argv.includes('--check')}).then(c=>console.log(`Catálogo pronto: ${c.species.length} Pokémon, ${c.forms.length} formas.`)).catch(e=>{console.error(e.message);process.exitCode=1;});
