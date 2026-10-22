'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {build,stableId}=require('../scripts/build-pokemon-catalog.cjs');
const repo=require('../repository-catalog.js');
const project=path.resolve(__dirname,'..');
const clone=value=>JSON.parse(JSON.stringify(value));
const base={schema:'pokedex-pokemon-v1',key:'teste-integracao',name:'Teste de integração',classification:'fakemon',status:'published',type1:'Grass',type2:'Dragon',baseStats:{hp:70,atk:85,def:65,spa:105,spd:85,spe:120},abilities:['Adaptability'],moves:['Swords Dance','Cinder Lock'],art:'',evolution:{previous:'',next:'',level:'',requirements:''},forms:[]};
function fixture(t,raw=base){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'pokedex-files-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'pokemons','artes'),{recursive:true});
  fs.copyFileSync(path.join(project,'system-bank.json'),path.join(root,'system-bank.json'));
  const file=path.join(root,'pokemons','teste.pokemon.json');
  const write=data=>fs.writeFileSync(file,JSON.stringify(data,null,2));write(clone(raw));
  return {root,file,write};
}

test('uma criação completa resolve efeitos H&H e mantém IDs ao atualizar',async t=>{
  const f=fixture(t);const data=await build({root:f.root});
  const s=data.species[0];assert.match(s.id,/^[a-f0-9-]{36}$/);assert.equal(s.id,stableId(base.key));
  assert.match(s.abilities[0].text,/STAB/);assert.match(s.moves[0].text,/Postura Ofensiva/);
  assert.equal(s.moves[0].accuracy,null);assert.equal(s.moves[1].type,'Fire');assert.equal(s.moves[1].power,60);
  const bytes=fs.readFileSync(path.join(f.root,'pokemons','catalogo.json'),'utf8');
  await build({root:f.root,check:true});assert.equal(fs.readFileSync(path.join(f.root,'pokemons','catalogo.json'),'utf8'),bytes);
  f.write({...clone(base),name:'Nome atualizado'});assert.equal((await build({root:f.root})).species[0].id,s.id);
});

test('moves oficiais resolvidos ficam disponíveis para compilar sem rede',async t=>{
  const f=fixture(t,{...clone(base),moves:['Flamethrower']});let requests=0;
  const data=await build({root:f.root,fetch:async()=>{requests++;return {ok:true,json:async()=>({name:'flamethrower',names:[],type:{name:'fire'},damage_class:{name:'special'},power:90,accuracy:100,effect_entries:[{language:{name:'en'},short_effect:'Inflicts regular damage.'}]})};}});
  assert.equal(requests,1);assert.equal(data.species[0].moves[0].accuracy,90);assert.equal(data.species[0].moves[0].accuracyCanonical,100);
  await build({root:f.root,check:true,fetch:async()=>{throw Error('A rede não deveria ser usada.');}});
});

test('efeitos autorais e overrides são preservados',async t=>{
  const f=fixture(t,{...clone(base),abilities:[{name:'Ability própria de teste',text:'Efeito definido pelo usuário.'}],moves:[{name:'Move próprio de teste',type:'Dragon',category:'Special',power:90,accuracy:85,text:'Efeito próprio.'}]});
  const s=(await build({root:f.root})).species[0];assert.equal(s.abilities[0].text,'Efeito definido pelo usuário.');assert.equal(s.moves[0].text,'Efeito próprio.');
});

test('cadastro incompleto, colisões e artes fora da pasta são rejeitados',async t=>{
  for(const [label,raw,pattern] of [
    ['BST incompleto',{...clone(base),baseStats:{hp:1}},/baseStats/],
    ['Ability sem efeito',{...clone(base),abilities:['Ability que não existe']},/efeito não encontrado/],
    ['imagem ausente',{...clone(base),art:'artes/ausente.png'},/não encontrado/],
    ['caminho externo',{...clone(base),art:'../segredo.png'},/artes\/nome/],
    ['status inválido',{...clone(base),status:'public'},/status/],
    ['tipo repetido',{...clone(base),type2:'Grass'},/tipos/]
  ])await t.test(label,async child=>{const f=fixture(child,raw);await assert.rejects(build({root:f.root}),pattern);});
  const f=fixture(t);fs.copyFileSync(f.file,path.join(f.root,'pokemons','duplicado.pokemon.json'));
  await assert.rejects(build({root:f.root}),/key duplicada/);
});

test('formas ficam vinculadas à base e rascunhos não aparecem no catálogo público',async t=>{
  const raw={...clone(base),forms:[{key:'mega',name:'Forma de teste',kind:'mega',type1:'Grass',type2:'Dragon',baseStats:base.baseStats,abilities:['Adaptability'],status:'published',art:''}]};
  const f=fixture(t,raw);const data=await build({root:f.root});
  assert.equal(data.forms[0].speciesId,data.species[0].id);assert.notEqual(data.forms[0].id,data.species[0].id);
  assert.equal(repo.publicRows(data).forms.length,1);
  f.write({...raw,status:'draft'});const draft=await build({root:f.root});
  assert.equal(repo.publicRows(draft).species.length,0);assert.equal(repo.publicRows(draft).forms.length,0);
  const app={items:[],forms:[],published:[],publicForms:[],gm:false};repo.mergeInto(app,draft);assert.equal(app.published.length,0);
});

test('edições salvas no banco têm preferência e recarregar não duplica registros',async t=>{
  const f=fixture(t);const data=await build({root:f.root});const s=data.species[0];
  const app={items:[],forms:[],published:[],publicForms:[],gm:true};
  repo.mergeInto(app,data);repo.mergeInto(app,data);assert.equal(app.items.length,1);assert.equal(app.published.length,1);
  const edited={...clone(s),name:'Edição manual do GM'};delete edited.repository;
  app.items=[edited];app.published=[clone(edited)];repo.mergeInto(app,data);
  assert.equal(app.items.length,1);assert.equal(app.items[0].name,'Edição manual do GM');assert.equal(app.items[0].repository.sourceOnly,false);
  const legacy={...clone(edited),id:'outro-id'};delete legacy.repository;
  app.items=[legacy];app.published=[clone(legacy)];repo.mergeInto(app,data);assert.equal(app.items.length,1);assert.equal(app.items[0].id,'outro-id');
  app.items=[];app.published=[];repo.mergeInto(app,data);repo.mergeInto(app,{species:[],forms:[]});assert.equal(app.items.length,0);assert.equal(app.published.length,0);
});

test('a ponte para a ficha usa apenas publicações e evita duplicatas por slug',async t=>{
  const f=fixture(t);const data=await build({root:f.root});const rows=repo.publicRows(data);
  assert.equal(rows.species[0].data.moves[0].name,'Swords Dance');
  const current={species:[{species_id:'existente',slug:base.key,data:{name:'Edição existente'}}],forms:[]};
  const combined=repo.mergePublicRows(current,rows);assert.equal(combined.species.length,1);assert.equal(combined.species[0].data.name,'Edição existente');
  assert.equal(repo.mergePublicRows(rows,{species:[],forms:[]}).species.length,0);
  const changed=clone(rows);changed.species[0].data.name='Nova revisão do arquivo';
  assert.equal(repo.mergePublicRows(rows,changed).species[0].data.name,'Nova revisão do arquivo');
});

test('arquivos de uma linha evolutiva recebem vínculos compatíveis com a Pokédex',async t=>{
  const f=fixture(t,{...clone(base),evolution:{next:'teste-final'}});
  const final={...clone(base),key:'teste-final',name:'Teste final',evolution:{previous:base.key,level:'36'}};
  const file=path.join(f.root,'pokemons','final.pokemon.json');fs.writeFileSync(file,JSON.stringify(final));
  const data=await build({root:f.root});const first=data.species.find(s=>s.repository.key===base.key),last=data.species.find(s=>s.repository.key==='teste-final');
  assert.equal(first.evolution.chainId,last.evolution.chainId);assert.equal(first.evolution.stage,0);assert.equal(last.evolution.stage,1);
  assert.equal(last.evolution.previousId,first.id);assert.equal(first.evolution.nextIds[0],last.id);
  fs.writeFileSync(file,JSON.stringify({...final,evolution:{previous:base.key,next:base.key}}));
  await assert.rejects(build({root:f.root}),/Ciclo/);
});

test('cópia em cache permanece utilizável quando a atualização falha',async t=>{
  const f=fixture(t);const data=await build({root:f.root});data.species[0].coverUrl='pokemons/artes/exemplo.png';
  const originalFetch=global.fetch,originalStorage=global.localStorage;const saved=new Map();
  t.after(()=>{global.fetch=originalFetch;if(originalStorage===undefined)delete global.localStorage;else global.localStorage=originalStorage;});
  global.localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)};
  global.fetch=async()=>({ok:true,json:async()=>data});
  const online=await repo.fetchCatalog({baseUrl:'https://teste.invalid/pokedex/'});
  assert.equal(online.species[0].coverUrl,'https://teste.invalid/pokedex/pokemons/artes/exemplo.png');
  global.fetch=async()=>{throw Error('offline');};
  const offline=await repo.fetchCatalog({baseUrl:'https://teste.invalid/pokedex/',force:true});assert.equal(offline.species[0].id,online.species[0].id);
  assert.equal(repo.resolved({...data,species:[{...data.species[0],coverUrl:'javascript:alert(1)'}]},'https://teste.invalid/').species[0].coverUrl,'');
});
