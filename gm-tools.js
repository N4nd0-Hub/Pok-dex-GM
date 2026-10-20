/* Pokédex GM — Central de Criação / QoL tools
   Fakemon, Rework via PokéAPI, Mega independente e bibliotecas de Ability/Move. */
window.POKEDEX_GM_TOOLS_SETUP = function(api){
  'use strict';
  const {
    app,isEditable,modalShell,closeModal,openEditor,renderEditor,editorDirty,
    toast,slug,esc,byId,render,newid,TYPES,STAT_KEYS,STAT_LABELS,statsTotal
  } = api;

  const titleCase=s=>String(s||'').split('-').map(w=>w? w[0].toUpperCase()+w.slice(1):'').join(' ');
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  let extrasKey='', extrasLoading=null, megaEditor=null, reworkResult=null, libraryTab='ability', pickerTarget='editor';
  const moveLookups=new WeakMap();
  const system=window.POKEDEX_SYSTEM_LIBRARY;
  const normalize=system?.normalize||slug;
  const abilityLookups=new WeakMap();
  let pickerKind=null, librarySearch='', libraryGroup='all', libraryLimit=40;

  function libraryEntries(kind){
    if(kind==='rules')return system?.data.rules||[];
    const rows=new Map();
    for(const row of system?.data[kind==='ability'?'abilities':'moves']||[]){
      rows.set(normalize(row.name),{...row,id:'system-'+kind+'-'+normalize(row.name),origin:'sheet',
        group:row.section||((row.tags||[]).includes('Rework')?'Moves alterados':'Moves próprios'),
        ...(kind==='move'?{accuracy:row.alwaysHits||!(Number(row.accuracy)>0)?null:Math.min(90,Number(row.accuracy))}:{}),
        canonicalAccuracy:row.accuracyCanonical??row.canonicalAccuracy??(Number(row.accuracy)>0?Number(row.accuracy):null)});
    }
    for(const row of kind==='ability'?app.abilityLibrary:app.moveLibrary){
      rows.set(normalize(row.name),{...row,origin:'gm',group:'Minhas criações'});
    }
    return [...rows.values()].sort((a,b)=>a.name.localeCompare(b.name,'en'));
  }

  function findAbility(name){return libraryEntries('ability').find(row=>normalize(row.name)===normalize(name));}
  function syncHTML(){
    const states={loading:'Carregando o banco…',syncing:'Atualizando a partir da ficha…',synced:'Banco sincronizado com a ficha.',
      bundled:'Cópia incluída no site disponível.',cached:'Último banco salvo disponível.',offline:'Sem conexão com a ficha. Usando o banco salvo.',unavailable:'Banco indisponível. Tente atualizar.'};
    return `<div class="system-library-sync"><div><strong>Ficha Pokémon · Heaven & Hell</strong><small role="status">${esc(states[system?.status]||'Banco do sistema')} · ${system?.data.abilities.length||0} abilities · ${system?.data.moves.length||0} moves próprios/alterados · ${system?.data.rules.length||0} regras</small></div><button class="btn btn-outline btn-sm" data-action="toolSystemSync" ${system?.status==='syncing'?'disabled':''}>↻ Atualizar da ficha</button></div>`;
  }

  function safeRuleHTML(value){
    const template=document.createElement('template');template.innerHTML=String(value||'');
    const allowed=new Set(['P','H1','H2','H3','H4','UL','OL','LI','STRONG','B','EM','I','BR','HR','BLOCKQUOTE','CODE','PRE','TABLE','THEAD','TBODY','TR','TD','TH']);
    const clean=node=>{
      if(node.nodeType===3)return document.createTextNode(node.textContent);
      const out=document.createDocumentFragment();
      if(node.nodeType!==1||['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH'].includes(node.tagName))return out;
      const target=allowed.has(node.tagName)?document.createElement(node.tagName.toLowerCase()):out;
      for(const child of node.childNodes)target.append(clean(child));
      return target;
    };
    const result=document.createElement('div');
    for(const node of template.content.childNodes)result.append(clean(node));
    return result.innerHTML;
  }

  function ruleText(rule){
    const div=document.createElement('div');
    div.innerHTML=safeRuleHTML(rule.content).replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(p|li|h[1-6]|blockquote|tr)>/gi,'\n</$1>');
    return rule.title+'\n'+div.textContent.trim().replace(/\n{3,}/g,'\n\n');
  }

  function abilityBinding(input){
    let list,index;
    if(input.dataset.megaAbility){list=megaEditor?.abilities;index=0;}
    else if(input.dataset.formAbilityIndex!=null){list=app.editor?.forms[Number(input.dataset.formIndex)]?.abilities;index=Number(input.dataset.formAbilityIndex);}
    else{list=app.editor?.model.abilities;index=Number(input.dataset.abilityIndex);}
    return list?.[index];
  }

  function cancelAbilityLookup(ability){
    const pending=abilityLookups.get(ability);if(pending?.timer)clearTimeout(pending.timer);abilityLookups.delete(ability);
  }

  function queueAbilityLookup(input,immediate=false){
    const ability=abilityBinding(input);if(!ability)return;
    cancelAbilityLookup(ability);
    const name=input.value.trim(),row=input.closest('.field-grid'),status=input.parentElement.querySelector('[data-ability-status]');
    if(!name){if(status)status.textContent='Digite o nome para preencher o efeito da ficha.';return;}
    const editor=app.editor,mega=megaEditor,pending={timer:null};abilityLookups.set(ability,pending);
    const current=()=>input.isConnected&&abilityLookups.get(ability)===pending&&abilityBinding(input)===ability
      &&app.editor===editor&&megaEditor===mega&&normalize(input.value)===normalize(name);
    const run=async()=>{
      await system?.ready;if(!current())return;
      const match=findAbility(name);
      if(!match){if(status)status.textContent='Sem entrada no banco. Você pode manter uma Ability própria.';abilityLookups.delete(ability);return;}
      ability.name=match.name;ability.text=match.description||'';input.value=match.name;
      const text=row?.querySelector('textarea[data-subfield="text"],textarea[data-mega-ability="text"]');
      if(text)text.value=ability.text;
      if(!input.dataset.megaAbility)editorDirty();
      if(status)status.textContent='✓ Efeito preenchido · '+(match.origin==='gm'?'Biblioteca GM':'Ficha Heaven & Hell');
      abilityLookups.delete(ability);
    };
    if(immediate)run();else pending.timer=setTimeout(run,550);
  }

  function moveLookupStatus(move,message,failed=false){
    const index=app.editor?.model.moves.indexOf(move)??-1;
    if(index<0)return;
    const status=document.querySelector(`[data-move-lookup-status="${index}"]`);
    if(status){status.textContent=message;status.classList.toggle('form-warning',failed)}
  }

  function cancelMoveLookup(move){
    const pending=moveLookups.get(move);
    if(pending?.timer)clearTimeout(pending.timer);
    moveLookups.delete(move);
  }

  function queueMoveLookup(index,immediate=false){
    const editor=app.editor,move=editor?.model.moves[Number(index)];
    const lookup=window.POKEDEX_MOVE_LOOKUP;
    if(!move||!lookup)return;
    cancelMoveLookup(move);
    const query=move.name.trim();
    if(!query){moveLookupStatus(move,'Digite o nome para preencher os dados automaticamente.');return}
    const pending={query,editor,timer:null};
    moveLookups.set(move,pending);
    moveLookupStatus(move,'Buscando dados do movimento…');
    const current=()=>app.editor===editor&&editor.model.moves.includes(move)
      &&moveLookups.get(move)===pending&&lookup.normalize(move.name)===lookup.normalize(query);
    const run=async()=>{
      try{
        const data=await lookup.lookup(query,app.moveLibrary);
        if(!current())return;
        const index=editor.model.moves.indexOf(move);
        for(const field of ['name','type','category','power','accuracy','accuracyCanonical','text']){
          move[field]=data[field];
          const input=document.querySelector(`[data-move-index="${index}"][data-subfield="${field}"]`);
          if(input)input.value=data[field]??'';
        }
        const nameInput=document.querySelector(`[data-move-index="${index}"][data-subfield="name"]`);
        const heading=nameInput?.closest('.repeat-entry')?.querySelector('.repeat-entry-head > span');
        if(heading)heading.textContent=move.name+' · '+(index+1);
        editorDirty();
        moveLookupStatus(move,'✓ '+data.name+' preenchido · '+data.source+(data.accuracy==null?' · Sem teste de precisão':''));
      }catch(error){
        if(current())moveLookupStatus(move,error.message||'Não foi possível buscar. Você pode preencher manualmente.',true);
      }finally{if(moveLookups.get(move)===pending)moveLookups.delete(move)}
    };
    if(immediate)run();else pending.timer=setTimeout(run,700);
  }

  app.customMegas=app.customMegas||[];
  app.publicCustomMegas=app.publicCustomMegas||[];
  app.abilityLibrary=app.abilityLibrary||[];
  app.moveLibrary=app.moveLibrary||[];

  function localExtras(){
    try{return JSON.parse(localStorage.getItem('pokedex-gm-tools-demo')||'{}')||{}}catch{return {}}
  }
  function saveLocalExtras(){
    localStorage.setItem('pokedex-gm-tools-demo',JSON.stringify({
      customMegas:app.customMegas, publicCustomMegas:app.publicCustomMegas,
      abilityLibrary:app.abilityLibrary, moveLibrary:app.moveLibrary
    }));
  }
  const mapMegaRow=r=>({
    id:r.id,parentPokeapiId:r.parent_pokeapi_id,parentName:r.parent_name,parentSlug:r.parent_slug,
    parentSpriteUrl:r.parent_sprite_url||'',name:r.name,slug:r.slug,category:r.category||'Mega Evolution',
    type1:r.type1,type2:r.type2||'',baseStats:r.base_stats||{},abilities:r.abilities||[],
    specialRules:r.special_rules||'',notes:r.notes||'',artPath:r.art_path||'',artUrl:r.art_url||'',
    status:r.status||'draft',revision:r.revision||1,publishedRevision:r.published_revision??null,
    updatedAt:r.updated_at,createdAt:r.created_at,publishedAt:r.published_at
  });
  const mapPublicMega=r=>({...r.data,id:r.mega_id,status:'published',publishedRevision:r.revision,revision:r.revision,publishedAt:r.published_at});
  const mapAbility=r=>({id:r.id,name:r.name,description:r.description||'',notes:r.notes||'',updatedAt:r.updated_at});
  const mapMove=r=>({id:r.id,name:r.name,type:r.type,category:r.category,power:r.power,accuracy:r.accuracy,
    canonicalAccuracy:r.canonical_accuracy,description:r.description||'',notes:r.notes||'',updatedAt:r.updated_at});

  async function loadExtras(){
    const key=app.mode+'|'+(app.gm?'gm':'public')+'|'+(app.user?.id||'none');
    extrasKey=key;
    if(app.mode==='demo'){
      const d=localExtras();
      app.customMegas=d.customMegas||[];
      app.publicCustomMegas=d.publicCustomMegas||[];
      app.abilityLibrary=d.abilityLibrary||[];
      app.moveLibrary=d.moveLibrary||[];
      return;
    }
    if(!app.client)return;
    const pub=await app.client.from('pokedex_public_custom_megas').select('*').order('published_at',{ascending:false});
    if(pub.error)throw pub.error;
    app.publicCustomMegas=(pub.data||[]).map(mapPublicMega);
    if(app.gm){
      const [m,a,mv]=await Promise.all([
        app.client.from('pokedex_custom_megas').select('*').order('updated_at',{ascending:false}),
        app.client.from('pokedex_ability_library').select('*').order('name'),
        app.client.from('pokedex_move_library').select('*').order('name')
      ]);
      if(m.error)throw m.error;if(a.error)throw a.error;if(mv.error)throw mv.error;
      app.customMegas=(m.data||[]).map(mapMegaRow);
      app.abilityLibrary=(a.data||[]).map(mapAbility);
      app.moveLibrary=(mv.data||[]).map(mapMove);
    }else{
      app.customMegas=[];app.abilityLibrary=[];app.moveLibrary=[];
    }
  }

  function ensureExtras(){
    const key=app.mode+'|'+(app.gm?'gm':'public')+'|'+(app.user?.id||'none');
    if(extrasKey===key)return;
    if(extrasLoading)return;
    extrasLoading=loadExtras().then(()=>{extrasLoading=null;render()}).catch(e=>{
      extrasLoading=null;extrasKey=key;toast('Ferramentas GM: '+(e.message||e),'warning');
    });
  }

  function workbenchHTML(){
    const megas=app.customMegas.filter(x=>x.status!=='archived').length;
    return `<div class="gm-workbench-head">
      <div><span class="eyebrow">CENTRAL DO GM</span><h1>Criação & Rework</h1>
      <p>Cada tarefa tem seu próprio fluxo. Nada de usar o mesmo botão para Fakemon, Rework, Mega e biblioteca.</p></div>
      <div class="gm-workbench-summary"><span><b>${libraryEntries('ability').length}</b> Abilities</span><span><b>${libraryEntries('move').length}</b> Moves do sistema</span><span><b>${libraryEntries('rules').length}</b> Regras</span><span><b>${megas}</b> Megas próprias</span></div>
    </div>
    <div class="gm-tool-grid">
      <section class="gm-tool-card fakemon"><span class="gm-tool-icon">✦</span><div><span class="eyebrow">ESPÉCIE NOVA</span><h2>Adicionar Pokémon</h2><p>Crie um Fakemon do zero. Abre o editor já classificado como Fakemon, sem misturar com Pokémon oficiais.</p></div><button class="btn btn-primary" data-action="toolCreateFakemon">＋ Criar Fakemon</button></section>
      <section class="gm-tool-card rework"><span class="gm-tool-icon">↻</span><div><span class="eyebrow">POKÉAPI → H&H</span><h2>Alterar Pokémon</h2><p>Busque um Pokémon oficial na PokéAPI, importe Tipagem, BST e Abilities e abra diretamente como Rework.</p></div><button class="btn btn-primary" data-action="toolReworkWizard">⌕ Buscar Pokémon oficial</button></section>
      <section class="gm-tool-card mega"><span class="gm-tool-icon">⬡</span><div><span class="eyebrow">MEGA INDEPENDENTE</span><h2>Criar Fake Mega Evolution</h2><p>Cria somente a Mega. O Pokémon-base fica na PokéAPI e não é duplicado nem transformado em Fakemon no seu banco.</p></div><button class="btn btn-primary" data-action="toolMegaWizard">✦ Criar Mega Evolution</button></section>
      <section class="gm-tool-card library"><span class="gm-tool-icon">⚙</span><div><span class="eyebrow">BANCO DA FICHA</span><h2>Abilities, Moves & Regras</h2><p>Consulte os efeitos alterados de Heaven & Hell, busque movimentos e adicione tudo direto ao Pokémon.</p></div><button class="btn btn-primary" data-action="toolLibrary">Abrir Biblioteca</button></section>
    </div>
    <section class="gm-tool-recent"><div class="section-head"><div><span class="eyebrow muted-text">ATALHOS</span><h2>Megas independentes recentes</h2></div></div>
      <div class="gm-recent-grid">${app.customMegas.filter(x=>x.status!=='archived').slice(0,6).map(m=>`<button class="gm-recent-mega" data-action="toolMegaEdit" data-id="${esc(m.id)}"><img src="${esc(m.artUrl||m.parentSpriteUrl||'')}" alt=""><span><b>${esc(m.name)}</b><small>${esc(m.parentName)} · ${esc(m.status)}</small></span></button>`).join('')||'<p class="gm-empty-note">Nenhuma Mega independente criada ainda.</p>'}</div>
    </section>`;
  }

  function customMegaVisible(){
    const source=app.gm?app.customMegas:app.publicCustomMegas;
    const q=document.getElementById('search')?.value.trim().toLowerCase()||'';
    const st=document.getElementById('statusFilter')?.value||'all';
    const cl=document.getElementById('classFilter')?.value||'all';
    let out=source.filter(m=>m.status!=='archived');
    if(st!=='all')out=out.filter(m=>m.status===st);
    if(cl!=='all'&&cl!=='official')out=[];
    if(app.type!=='all')out=out.filter(m=>m.type1===app.type||m.type2===app.type);
    if(q)out=out.filter(m=>[m.name,m.parentName,m.slug,m.type1,m.type2,...(m.abilities||[]).map(a=>a.name)].join(' ').toLowerCase().includes(q));
    const sort=document.getElementById('sort')?.value||'dex';
    out.sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='recent'?new Date(b.updatedAt||b.publishedAt||0)-new Date(a.updatedAt||a.publishedAt||0):(a.parentPokeapiId||999999)-(b.parentPokeapiId||999999)||a.name.localeCompare(b.name));
    return out;
  }
  function megaCard(m){
    const img=m.artUrl||m.parentSpriteUrl||'';
    return `<article class="poke-card custom-mega-card"><div class="card-image"><span class="card-number">MEGA / #${String(m.parentPokeapiId||'—').padStart(4,'0')}</span><div class="card-status"><span class="badge ${m.status==='published'?'published':'draft'}">${m.status==='published'?'Publicado':'Rascunho'}</span></div>${img?`<img loading="lazy" src="${esc(img)}" alt="Arte de ${esc(m.name)}">`:''}</div><div class="card-info"><div class="card-heading"><div style="min-width:0"><h3>${esc(m.name)}</h3><span class="card-sub">Mega de ${esc(m.parentName)} · PokéAPI</span></div><span class="badge mega">mega</span></div><div class="types card-types">${[m.type1,m.type2].filter(Boolean).map(t=>`<span class="type ${esc(t.toLowerCase())}">${esc(t)}</span>`).join('')}</div><div class="card-meta"><span><strong>BST ${statsTotal(m.baseStats)}</strong> · ${esc(m.abilities?.[0]?.name||'Sem Ability')}</span><span>OFICIAL BASE</span></div></div><div class="card-foot"><button class="btn btn-sm btn-outline" data-action="toolMegaDetail" data-id="${esc(m.id)}">Ver detalhes →</button>${app.gm?'<button class="card-more" data-action="toolMegaEdit" data-id="'+esc(m.id)+'" title="Editar">✎</button>':''}</div></article>`;
  }

  function afterRender(){
    ensureExtras();
    const wb=document.getElementById('gmWorkbench');
    if(wb && app.nav==='tools' && app.gm){wb.innerHTML=workbenchHTML();}
    const stat=document.getElementById('statForms');
    if(stat){
      const extra=(app.gm?app.customMegas:app.publicCustomMegas).filter(x=>x.status!=='archived').length;
      const normal=(app.gm?app.forms:app.publicForms).length;
      stat.textContent=String(normal+extra).padStart(2,'0');
    }
    if(app.nav==='forms'){
      const grid=document.getElementById('catalogGrid');if(!grid)return;
      const extras=customMegaVisible();
      if(extras.length){
        if(grid.querySelector('.empty'))grid.innerHTML='';
        grid.insertAdjacentHTML('beforeend',extras.map(megaCard).join(''));
      }
      const count=document.getElementById('resultCount');
      if(count)count.textContent=String((Number(count.textContent)||0)+extras.length);
    }
  }

  function createFakemon(){
    if(!isEditable())return toast('Faça login como GM para criar Fakemon.','warning');
    openEditor();
    if(!app.editor)return;
    app.editor.model.classification='fakemon';
    app.editor.model.category='Fakemon';
    app.editor.model.notes='Criado pela seção Adicionar Pokémon (Fakemon).';
    app.editor.dirty=true;
    renderEditor();
  }

  async function pokeFetch(query){
    const clean=String(query||'').trim();
    if(clean.length<1)throw Error('Informe o nome ou número do Pokémon.');
    const target=/^\d+$/.test(clean)?clean:slug(clean);
    const res=await fetch('https://pokeapi.co/api/v2/pokemon/'+encodeURIComponent(target)+'/');
    if(!res.ok)throw Error(res.status===404?'Pokémon não encontrado na PokéAPI.':'PokéAPI indisponível ('+res.status+').');
    const p=await res.json();
    let species=null;
    try{const s=await fetch('https://pokeapi.co/api/v2/pokemon-species/'+p.id+'/');if(s.ok)species=await s.json()}catch{}
    return {p,species};
  }
  function pokeStats(p){
    const map={hp:'hp',attack:'atk',defense:'def','special-attack':'spa','special-defense':'spd',speed:'spe'};
    const out={hp:1,atk:1,def:1,spa:1,spd:1,spe:1};
    for(const x of p.stats||[])if(map[x.stat?.name])out[map[x.stat.name]]=Number(x.base_stat)||1;
    return out;
  }
  function pokeTypes(p){return (p.types||[]).slice().sort((a,b)=>a.slot-b.slot).map(x=>titleCase(x.type.name));}
  function pokeArt(p){return p.sprites?.other?.['official-artwork']?.front_default||p.sprites?.front_default||''}
  function pokeCategory(species){
    const genus=species?.genera?.find(x=>x.language?.name==='en')?.genus;
    return genus||'Official Pokémon';
  }
  function pokeAbilities(p){return (p.abilities||[]).slice().sort((a,b)=>a.slot-b.slot).map(x=>{
    const name=titleCase(x.ability.name),known=findAbility(name);return {name:known?.name||name,text:known?.description||''};
  })}

  function openReworkWizard(){
    if(!isEditable())return toast('Faça login como GM para criar Reworks.','warning');
    reworkResult=null;
    const body=`<div class="modal-body"><div class="info-strip"><b>Rework de Pokémon oficial:</b> a PokéAPI serve como ponto de partida. O site importa os dados canônicos e abre uma cópia de trabalho classificada como <b>Rework</b>.</div><div class="field full"><label>Nome ou número oficial</label><input id="reworkPokeSearch" type="search" placeholder="Ex.: Sceptile, Garchomp ou 445" autocomplete="off"></div><button class="btn btn-primary btn-full mt" data-action="toolReworkSearch">⌕ Buscar na PokéAPI</button><div id="reworkPokeResult" class="tool-poke-result"></div></div>`;
    modalShell('Alterar Pokémon','PokéAPI → dados base → editor de Rework',body,'<button class="btn btn-outline" data-action="closeModal">Fechar</button>',true);
    document.getElementById('modal').dataset.kind='rework-wizard';
    setTimeout(()=>document.getElementById('reworkPokeSearch')?.focus(),0);
  }
  async function searchRework(){
    const input=document.getElementById('reworkPokeSearch'),box=document.getElementById('reworkPokeResult');
    if(!input||!box)return;
    box.innerHTML='<p class="progress">Consultando PokéAPI…</p>';
    try{
      reworkResult=await pokeFetch(input.value);
      const {p,species}=reworkResult,types=pokeTypes(p),stats=pokeStats(p),existing=(app.items||[]).find(s=>s.dex===p.id||s.slug===slug(p.species?.name||p.name));
      box.innerHTML=`<div class="tool-poke-card">${pokeArt(p)?`<img src="${esc(pokeArt(p))}" alt="">`:''}<div><span class="eyebrow">#${p.id}</span><h3>${esc(titleCase(p.species?.name||p.name))}</h3><p>${esc(types.join(' / '))} · BST ${statsTotal(stats)} · ${esc(pokeCategory(species))}</p><small>${existing?'Já existe no banco GM. O editor abrirá esse registro para evitar duplicação.':'Ainda não existe no banco GM. Será criado diretamente como Rework.'}</small></div><button class="btn btn-primary" data-action="toolReworkUse">${existing?'Abrir e alterar':'Criar Rework'} →</button></div>`;
    }catch(e){reworkResult=null;box.innerHTML='<div class="info-strip warning">'+esc(e.message||e)+'</div>'}
  }
  function useRework(){
    if(!reworkResult)return toast('Busque um Pokémon primeiro.','warning');
    const {p,species}=reworkResult,name=titleCase(p.species?.name||p.name);
    const existing=(app.items||[]).find(s=>s.dex===p.id||s.slug===slug(p.species?.name||p.name));
    if(existing){
      openEditor(existing.id);
      if(app.editor){
        app.editor.model.classification='rework';
        app.editor.model.notes=(app.editor.model.notes?app.editor.model.notes+'\n':'')+'Aberto como Rework a partir da Central GM.';
        editorDirty();renderEditor();
      }
      return;
    }
    openEditor();if(!app.editor)return;
    const s=app.editor.model,types=pokeTypes(p);
    s.name=name;s.slug=slug(name);if(app.items.some(x=>x.slug===s.slug))s.slug+='-rework';
    s.dex=p.id;s.classification='rework';s.category=pokeCategory(species);s.type1=types[0]||'Normal';s.type2=types[1]||'';
    s.baseStats=pokeStats(p);s.abilities=pokeAbilities(p);s.moves=[];s.specialRules='';
    s.notes='Base importada da PokéAPI em '+new Date().toLocaleString('pt-BR')+'. Ajuste Ability, Moves e regras do rework antes de publicar.';
    app.editor.dirty=true;renderEditor();
    toast(name+' carregado como Rework. Agora altere apenas o que quiser.','success');
  }

  function openMegaWizard(existing=null){
    if(!isEditable())return toast('Faça login como GM para criar Megas.','warning');
    if(existing)return openMegaEditor(existing);
    megaEditor=null;
    const body=`<div class="modal-body"><div class="info-strip"><b>Mega independente:</b> o Pokémon original continuará vindo da PokéAPI. Nenhuma espécie-base será criada no Supabase.</div><div class="field full"><label>Pokémon original</label><input id="customMegaBaseSearch" type="search" placeholder="Ex.: Flygon, Milotic ou 330" autocomplete="off"></div><button class="btn btn-primary btn-full mt" data-action="toolMegaSearch">⌕ Buscar base oficial</button><div id="customMegaBaseResult" class="tool-poke-result"></div></div>`;
    modalShell('Criar Fake Mega Evolution','Escolha apenas o Pokémon-base oficial',body,'<button class="btn btn-outline" data-action="closeModal">Fechar</button>',true);
    document.getElementById('modal').dataset.kind='custom-mega-search';
    setTimeout(()=>document.getElementById('customMegaBaseSearch')?.focus(),0);
  }
  async function searchMegaBase(){
    const input=document.getElementById('customMegaBaseSearch'),box=document.getElementById('customMegaBaseResult');if(!input||!box)return;
    box.innerHTML='<p class="progress">Consultando PokéAPI…</p>';
    try{
      const result=await pokeFetch(input.value),p=result.p,types=pokeTypes(p);
      megaEditor={id:newid(),parentPokeapiId:p.id,parentName:titleCase(p.species?.name||p.name),parentSlug:slug(p.species?.name||p.name),
        parentSpriteUrl:pokeArt(p),name:'Mega '+titleCase(p.species?.name||p.name),slug:'mega-'+slug(p.species?.name||p.name)+'-hh',
        category:'Mega Evolution',type1:types[0]||'Normal',type2:types[1]||'',baseStats:pokeStats(p),
        abilities:[{name:'',text:''}],specialRules:'',notes:'',artPath:'',artUrl:'',status:'draft',revision:1,newFile:null};
      box.innerHTML=`<div class="tool-poke-card">${pokeArt(p)?`<img src="${esc(pokeArt(p))}" alt="">`:''}<div><span class="eyebrow">BASE OFICIAL #${p.id}</span><h3>${esc(megaEditor.parentName)}</h3><p>${esc(types.join(' / '))} · BST ${statsTotal(megaEditor.baseStats)}</p><small>A Mega será uma entrada própria ligada a este ID da PokéAPI.</small></div><button class="btn btn-primary" data-action="toolMegaContinue">Criar Mega →</button></div>`;
    }catch(e){megaEditor=null;box.innerHTML='<div class="info-strip warning">'+esc(e.message||e)+'</div>'}
  }
  function megaStatInputs(m){return STAT_KEYS.map(k=>`<div class="field"><label>${STAT_LABELS[k]}</label><input type="number" min="1" max="999" data-mega-stat="${k}" value="${Number(m.baseStats?.[k])||1}"></div>`).join('')}
  function openMegaEditor(m){
    if(m)megaEditor={...JSON.parse(JSON.stringify(m)),newFile:null};
    if(!megaEditor)return;
    const a=megaEditor.abilities?.[0]||{name:'',text:''};
    const img=megaEditor.artUrl||megaEditor.parentSpriteUrl||'';
    const body=`<div class="modal-body custom-mega-editor"><div class="custom-mega-parent">${img?`<img src="${esc(img)}" alt="">`:''}<div><span class="eyebrow">BASE POKÉAPI #${megaEditor.parentPokeapiId}</span><b>${esc(megaEditor.parentName)}</b><small>Somente referência; não ocupa uma espécie no seu banco.</small></div></div>
      <div class="form-section"><h3 class="subheading">IDENTIDADE DA MEGA</h3><div class="field-grid thirds"><div class="field"><label>Nome</label><input data-mega-field="name" value="${esc(megaEditor.name)}"></div><div class="field"><label>Slug</label><input data-mega-field="slug" value="${esc(megaEditor.slug)}"></div><div class="field"><label>Categoria</label><input data-mega-field="category" value="${esc(megaEditor.category)}"></div><div class="field"><label>Tipo 1</label><select data-mega-field="type1">${TYPES.map(t=>`<option ${t===megaEditor.type1?'selected':''}>${t}</option>`).join('')}</select></div><div class="field"><label>Tipo 2</label><select data-mega-field="type2"><option value="">Nenhum</option>${TYPES.map(t=>`<option ${t===megaEditor.type2?'selected':''}>${t}</option>`).join('')}</select></div></div></div>
      <div class="form-section"><h3 class="subheading">BASE STATS <span class="mega-bst">/ BST <b id="customMegaBST">${statsTotal(megaEditor.baseStats)}</b></span></h3><div class="stat-grid">${megaStatInputs(megaEditor)}</div><p class="settings-help">Os valores começam com o Pokémon original apenas como referência. Ajuste o BST da Mega livremente.</p></div>
      <div class="form-section"><h3 class="subheading">ABILITY DA MEGA</h3><div class="field-grid"><div class="field"><label>Nome em inglês</label><input data-mega-ability="name" value="${esc(a.name||'')}"></div><div class="field full"><label>Efeito em português</label><textarea data-mega-ability="text">${esc(a.text||'')}</textarea></div></div><button class="btn btn-outline btn-sm mt" data-action="toolMegaPickAbility">＋ Puxar da Biblioteca</button></div>
      <div class="form-section"><h3 class="subheading">ARTE & REGRAS</h3><div class="custom-mega-art">${img?`<img id="customMegaPreview" src="${esc(img)}" alt="">`:'<div id="customMegaPreview"></div>'}<div><input id="customMegaArtFile" type="file" accept="image/png,image/jpeg,image/webp"><small>PNG, JPEG ou WebP · máximo 10 MB. Se não enviar, a Pokédex usa a arte oficial do Pokémon-base como referência temporária.</small></div></div><div class="field full mt"><label>Regras especiais</label><textarea data-mega-field="specialRules">${esc(megaEditor.specialRules||'')}</textarea></div><div class="field full mt"><label>Notas privadas do GM</label><textarea data-mega-field="notes">${esc(megaEditor.notes||'')}</textarea></div></div>
      </div>`;
    modalShell(megaEditor.name||'Nova Mega','Mega independente · Pokémon-base via PokéAPI',body,`<button class="btn btn-outline" data-action="toolMegaSave">Salvar rascunho</button><button class="btn btn-primary" data-action="toolMegaPublish">✦ Salvar & Publicar</button>`);
    document.getElementById('modal').dataset.kind='custom-mega-editor';
    injectAbilityInputs(document.getElementById('modal'));
  }
  function megaPayload(){
    const m=megaEditor;if(!m)throw Error('Mega não carregada.');
    m.name=String(m.name||'').trim();m.slug=slug(m.slug||m.name);if(!m.name||!m.slug)throw Error('Informe nome e slug.');
    if(m.type2===m.type1)m.type2='';
    for(const k of STAT_KEYS){const n=Math.trunc(Number(m.baseStats[k]));if(!Number.isInteger(n)||n<1||n>999)throw Error('Base Stat inválido: '+STAT_LABELS[k]);m.baseStats[k]=n}
    m.abilities=(m.abilities||[]).filter(a=>a.name?.trim()).map(a=>({name:a.name.trim(),text:a.text||''}));
    return {id:m.id,parent_pokeapi_id:m.parentPokeapiId,parent_name:m.parentName,parent_slug:m.parentSlug,parent_sprite_url:m.parentSpriteUrl||'',
      name:m.name,slug:m.slug,category:m.category||'Mega Evolution',type1:m.type1,type2:m.type2||null,base_stats:m.baseStats,
      abilities:m.abilities,special_rules:m.specialRules||'',notes:m.notes||'',art_path:m.artPath||null,art_url:m.artUrl||null,status:m.status||'draft'};
  }
  async function prepareMegaArt(){
    const m=megaEditor;if(!m?.newFile)return;
    const file=m.newFile;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size<1||file.size>10485760)throw Error('Arte inválida. Use PNG, JPEG ou WebP de até 10 MB.');
    if(app.mode==='demo'){m.artUrl=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(file)});m.artPath='demo/'+m.id;return}
    const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];
    const path='custom-megas/'+m.id+'/draft.'+ext;
    const up=await app.client.storage.from('pokedex-drafts').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});
    if(up.error)throw up.error;m.artPath=path;m.newFile=null;
  }
  async function saveMega(stay=true){
    if(!megaEditor)return;
    megaPayload();await prepareMegaArt();
    if(app.mode==='demo'){
      const old=app.customMegas.find(x=>x.id===megaEditor.id);
      megaEditor.revision=(old?.revision||0)+1;megaEditor.updatedAt=new Date().toISOString();
      app.customMegas=app.customMegas.filter(x=>x.id!==megaEditor.id).concat(JSON.parse(JSON.stringify(megaEditor)));
      saveLocalExtras();
    }else{
      const row=megaPayload();
      const exists=app.customMegas.some(x=>x.id===megaEditor.id);
      const res=exists?await app.client.from('pokedex_custom_megas').update(row).eq('id',megaEditor.id).select().single():await app.client.from('pokedex_custom_megas').insert(row).select().single();
      if(res.error)throw res.error;megaEditor=mapMegaRow(res.data);
      await loadExtras();
    }
    render();
    if(stay){openMegaEditor(megaEditor);toast('Mega salva como rascunho.','success')}
  }
  async function publishMega(){
    try{
      await saveMega(false);
      if(app.mode==='demo'){
        const m=app.customMegas.find(x=>x.id===megaEditor.id);m.status='published';m.publishedRevision=m.revision;m.publishedAt=new Date().toISOString();
        app.publicCustomMegas=app.publicCustomMegas.filter(x=>x.id!==m.id).concat(JSON.parse(JSON.stringify(m)));saveLocalExtras();
      }else{
        if(megaEditor.artPath){
          const dl=await app.client.storage.from('pokedex-drafts').download(megaEditor.artPath);if(dl.error)throw dl.error;
          const ext=(megaEditor.artPath.split('.').pop()||'png').replace('jpeg','jpg');
          const publicPath='custom-megas/'+megaEditor.id+'/art-r'+megaEditor.revision+'.'+ext;
          const up=await app.client.storage.from('pokedex-public').upload(publicPath,dl.data,{upsert:true,cacheControl:'31536000'});if(up.error)throw up.error;
          megaEditor.artUrl=app.client.storage.from('pokedex-public').getPublicUrl(publicPath).data.publicUrl;
          const ur=await app.client.from('pokedex_custom_megas').update({art_url:megaEditor.artUrl}).eq('id',megaEditor.id);if(ur.error)throw ur.error;
        }
        const pub=await app.client.rpc('pokedex_publish_custom_mega',{p_id:megaEditor.id});if(pub.error)throw pub.error;
        await loadExtras();
      }
      const n=megaEditor.name;megaEditor=null;closeModal(true);render();toast(n+' publicada como Mega independente.','success');
    }catch(e){toast('Não foi possível publicar a Mega: '+(e.message||e),'error')}
  }
  async function unpublishMega(id,archive=false){
    const m=app.customMegas.find(x=>x.id===id);if(!m)return;
    if(!confirm((archive?'Arquivar ':'Despublicar ')+m.name+'?'))return;
    try{
      if(app.mode==='demo'){m.status=archive?'archived':'draft';app.publicCustomMegas=app.publicCustomMegas.filter(x=>x.id!==id);saveLocalExtras()}
      else{const r=await app.client.rpc('pokedex_unpublish_custom_mega',{p_id:id,p_archive:archive});if(r.error)throw r.error;await loadExtras()}
      closeModal(true);render();toast(archive?'Mega arquivada.':'Mega despublicada.','success');
    }catch(e){toast(e.message||e,'error')}
  }
  async function deleteMega(id){
    const m=app.customMegas.find(x=>x.id===id);if(!m||!confirm('Excluir permanentemente '+m.name+'?'))return;
    try{
      if(app.mode==='demo'){app.customMegas=app.customMegas.filter(x=>x.id!==id);app.publicCustomMegas=app.publicCustomMegas.filter(x=>x.id!==id);saveLocalExtras()}
      else{const r=await app.client.from('pokedex_custom_megas').delete().eq('id',id);if(r.error)throw r.error;for(const b of ['pokedex-drafts','pokedex-public']){const ls=await app.client.storage.from(b).list('custom-megas/'+id);if(!ls.error&&ls.data?.length)await app.client.storage.from(b).remove(ls.data.map(x=>'custom-megas/'+id+'/'+x.name))}await loadExtras()}
      closeModal(true);render();toast('Mega excluída.','success');
    }catch(e){toast(e.message||e,'error')}
  }
  function megaDetail(id){
    const m=(app.gm?app.customMegas:app.publicCustomMegas).find(x=>x.id===id);if(!m)return;
    const stats=STAT_KEYS.map(k=>`<div class="stat-block"><small>${STAT_LABELS[k].toUpperCase()}</small><strong>${Number(m.baseStats[k])||0}</strong></div>`).join('');
    const img=m.artUrl||m.parentSpriteUrl||'';
    const body=`<div class="modal-body"><div class="custom-mega-detail">${img?`<img src="${esc(img)}" alt="">`:''}<div><span class="badge mega">Mega independente</span><h2>${esc(m.name)}</h2><p>Forma criada para <b>${esc(m.parentName)}</b> (#${m.parentPokeapiId} na PokéAPI).</p><div class="types">${[m.type1,m.type2].filter(Boolean).map(t=>`<span class="type ${t.toLowerCase()}">${esc(t)}</span>`).join('')}</div></div></div><h3 class="subheading">BASE STATS / BST ${statsTotal(m.baseStats)}</h3><div class="drawer-stats">${stats}</div><h3 class="subheading">ABILITIES</h3>${(m.abilities||[]).map(a=>`<div class="drawer-list"><strong>${esc(a.name)}</strong><div>${esc(a.text||'')}</div></div>`).join('')||'<p class="drawer-summary">Nenhuma Ability cadastrada.</p>'}${m.specialRules?`<h3 class="subheading">REGRAS ESPECIAIS</h3><div class="drawer-list">${esc(m.specialRules).replace(/\n/g,'<br>')}</div>`:''}</div>`;
    const foot=app.gm?`<button class="btn btn-outline" data-action="toolMegaEdit" data-id="${m.id}">✎ Editar</button><div>${m.status==='published'?`<button class="btn btn-outline" data-action="toolMegaUnpublish" data-id="${m.id}">Despublicar</button>`:`<button class="btn btn-good" data-action="toolMegaPublishExisting" data-id="${m.id}">Publicar</button>`}<button class="btn btn-danger" data-action="toolMegaArchive" data-id="${m.id}">Arquivar</button><button class="btn btn-danger" data-action="toolMegaDelete" data-id="${m.id}">Excluir</button></div>`:'<button class="btn btn-outline" data-action="closeModal">Fechar</button>';
    modalShell(m.name,'Mega Evolution personalizada ligada à espécie oficial',body,foot);
    document.getElementById('modal').dataset.kind='custom-mega-detail';
  }

  function libraryListHTML(){
    const kind=pickerKind||libraryTab,query=normalize(librarySearch);
    const all=libraryEntries(kind);
    const filtered=all.filter(x=>(libraryGroup==='all'||x.group===libraryGroup)&&(!query||normalize(
      [x.name,x.title,x.description,x.summary,x.searchText,x.group,x.type,x.category].filter(Boolean).join(' ')
    ).includes(query)));
    if(query){const rank=x=>normalize(x.name||x.title)===query?0:normalize(x.name||x.title).startsWith(query)?1:2;filtered.sort((a,b)=>rank(a)-rank(b));}
    const cards=filtered.slice(0,libraryLimit).map(x=>{
      const id=esc(x.id),isRule=kind==='rules',name=x.name||x.title;
      const meta=isRule?x.group:(x.origin==='sheet'?'Ficha Heaven & Hell':'Biblioteca GM')+' · '+x.group;
      const data=kind==='move'?`<small class="system-library-meta">${esc(x.type)} · ${esc(x.category)} · Power ${x.power??'—'} · Precisão ${x.alwaysHits?'Nunca erra':Number(x.accuracy)>0?Math.min(90,Number(x.accuracy))+'%':'—'}</small>`:'';
      const use=pickerKind?`<button class="btn btn-primary btn-sm system-picker-choice" data-action="${isRule?'toolUseRule':kind==='ability'?'toolUseAbility':'toolUseMove'}" data-id="${id}">＋ ${isRule?'Adicionar às regras especiais':'Adicionar ao Pokémon'}</button>`:'';
      const actions=isRule?`<button class="btn btn-outline btn-sm" data-action="toolRuleCopy" data-id="${id}">Copiar texto</button>`:
        `<button class="btn btn-outline btn-sm" data-action="${kind==='ability'?'toolLibraryCopyAbility':'toolLibraryCopyMove'}" data-id="${id}">Copiar</button>`+
        (!pickerKind?`<button class="btn btn-outline btn-sm" data-action="${kind==='ability'?'toolAbilityEdit':'toolMoveEdit'}" data-id="${id}">${x.origin==='sheet'?'Criar minha versão':'Editar'}</button>`+(x.origin==='gm'?`<button class="btn btn-danger btn-sm" data-action="${kind==='ability'?'toolAbilityDelete':'toolMoveDelete'}" data-id="${id}">Excluir</button>`:''):'');
      return `<details class="system-library-entry"><summary><span><b>${esc(name)}</b><small class="system-library-meta">${esc(meta)}</small></span></summary>${data}<p class="system-library-preview">${esc(isRule?x.summary:x.description||'Sem descrição.')}</p>${isRule?`<div class="system-rule-content">${safeRuleHTML(x.content)}</div>`:`<p>${esc(x.description||'Sem descrição.')}</p>${kind==='move'&&x.learnRule?`<p><b>Aprendizado:</b> ${esc(x.learnRule)}</p>`:''}`}<div class="system-library-actions">${actions}</div>${use}</details>`;
    }).join('');
    const empty=query||libraryGroup!=='all'?'Nenhum resultado para esta busca.':'Nenhuma entrada disponível.';
    return `<div class="system-library-count" role="status">${filtered.length} resultado${filtered.length===1?'':'s'}${filtered.length>libraryLimit?' · exibindo '+libraryLimit:''}</div><div class="library-list">${cards||`<p class="gm-empty-note">${empty}</p>`}</div>${filtered.length>libraryLimit?'<button class="btn btn-outline system-library-more" data-action="toolLibraryMore">Mostrar mais</button>':''}${kind==='move'&&query?'<div class="info-strip"><b>Move oficial?</b> A busca pelo nome no editor consulta também a PokéAPI. Os efeitos próprios de Heaven & Hell têm preferência.</div>':''}`;
  }

  function libraryFiltersHTML(kind){
    const groups=[...new Set(libraryEntries(kind).map(x=>x.group).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
    return `<div class="system-library-filters"><div class="field"><label for="systemLibrarySearch">Buscar ${kind==='rules'?'regra':'nome ou efeito'}</label><input id="systemLibrarySearch" type="search" autocomplete="off" value="${esc(librarySearch)}" placeholder="${kind==='ability'?'Ex.: Intimidate, Blaze Pulse, imunidade…':kind==='move'?'Ex.: Swords Dance, Fire, cura…':'Ex.: dano, captura, estágios…'}"></div><div class="field"><label for="systemLibraryGroup">Categoria</label><select id="systemLibraryGroup"><option value="all">Todas as categorias</option>${groups.map(g=>`<option value="${esc(g)}" ${libraryGroup===g?'selected':''}>${esc(g)}</option>`).join('')}</select></div></div>`;
  }

  async function openLibrary(tab=libraryTab){
    if(!isEditable())return toast('Biblioteca disponível apenas para o GM.','warning');
    await system?.ready;
    if(libraryTab!==tab){librarySearch='';libraryGroup='all';libraryLimit=40;}
    libraryTab=tab;
    pickerKind=null;
    const create=tab==='rules'?'':`<button class="btn btn-outline btn-sm" data-action="${tab==='ability'?'toolAbilityNew':'toolMoveNew'}">＋ ${tab==='ability'?'Nova Ability':'Novo Move'}</button>`;
    const body=`<div class="modal-tabs">${[['ability','✧ Abilities'],['move','⚔ Moves'],['rules','▣ Regras']].map(([key,label])=>`<button class="modal-tab ${tab===key?'active':''}" data-action="toolLibraryTab" data-tab="${key}">${label}</button>`).join('')}</div><div class="modal-body">${syncHTML()}<div class="library-toolbar"><span>Consulte o banco da ficha ou cadastre sua própria versão.</span>${create}</div>${libraryFiltersHTML(tab)}<div id="systemLibraryResults">${libraryListHTML()}</div></div>`;
    modalShell('Biblioteca Heaven & Hell','Abilities alteradas, Moves e regras da ficha',body,'<button class="btn btn-outline" data-action="closeModal">Fechar</button>');
    document.getElementById('modal').dataset.kind='library';
  }
  function abilityForm(a={id:'',name:'',description:'',notes:''}){
    const body=`<div class="modal-body"><div class="field-grid"><div class="field full"><label>Nome da Ability em inglês</label><input id="libAbilityName" value="${esc(a.name)}" placeholder="Ex.: Relentless Bore"></div><div class="field full"><label>Efeito em português</label><textarea id="libAbilityDescription" style="min-height:150px">${esc(a.description)}</textarea></div><div class="field full"><label>Notas privadas</label><textarea id="libAbilityNotes">${esc(a.notes)}</textarea></div></div></div>`;
    modalShell(a.id?'Editar Ability':'Nova Ability','Entrada reutilizável da biblioteca',body,`<button class="btn btn-outline" data-action="toolLibraryBack">Voltar</button><button class="btn btn-primary" data-action="toolAbilitySave" data-id="${esc(a.id)}">Salvar Ability</button>`,true);
    document.getElementById('modal').dataset.kind='library-ability';
  }
  async function saveAbility(id){
    const name=document.getElementById('libAbilityName')?.value.trim(),description=document.getElementById('libAbilityDescription')?.value||'',notes=document.getElementById('libAbilityNotes')?.value||'';
    if(!name)return toast('Informe o nome da Ability.','warning');
    try{
      if(app.mode==='demo'){
        const row={id:id||newid(),name,description,notes,updatedAt:new Date().toISOString()};app.abilityLibrary=app.abilityLibrary.filter(x=>x.id!==row.id).concat(row).sort((a,b)=>a.name.localeCompare(b.name));saveLocalExtras();
      }else{
        const payload={name,description,notes};const r=id?await app.client.from('pokedex_ability_library').update(payload).eq('id',id):await app.client.from('pokedex_ability_library').insert(payload);if(r.error)throw r.error;await loadExtras();
      }
      openLibrary('ability');render();toast('Ability salva na biblioteca.','success');
    }catch(e){toast(e.message||e,'error')}
  }
  function moveForm(m={id:'',name:'',type:'Normal',category:'Physical',power:40,accuracy:90,canonicalAccuracy:null,description:'',notes:''}){
    const body=`<div class="modal-body"><div class="field-grid thirds"><div class="field"><label>Nome em inglês</label><input id="libMoveName" value="${esc(m.name)}"></div><div class="field"><label>Type</label><select id="libMoveType">${TYPES.map(t=>`<option ${t===m.type?'selected':''}>${t}</option>`).join('')}</select></div><div class="field"><label>Categoria</label><select id="libMoveCategory">${['Physical','Special','Status'].map(x=>`<option ${x===m.category?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Power</label><input id="libMovePower" type="number" min="0" max="999" value="${m.power??''}"></div><div class="field"><label>Accuracy RPG · máx. 90</label><input id="libMoveAccuracy" type="number" min="1" max="90" value="${m.accuracy??''}"></div><div class="field"><label>Accuracy canônica</label><input id="libMoveCanonical" type="number" min="1" max="100" value="${m.canonicalAccuracy??''}"></div><div class="field full"><label>Descrição / efeito em português</label><textarea id="libMoveDescription" style="min-height:140px">${esc(m.description)}</textarea></div><div class="field full"><label>Notas privadas</label><textarea id="libMoveNotes">${esc(m.notes)}</textarea></div></div></div>`;
    modalShell(m.id?'Editar Move':'Novo Move','Entrada reutilizável da biblioteca',body,`<button class="btn btn-outline" data-action="toolLibraryBack">Voltar</button><button class="btn btn-primary" data-action="toolMoveSave" data-id="${esc(m.id)}">Salvar Move</button>`,true);
    document.getElementById('modal').dataset.kind='library-move';
  }
  async function saveMove(id){
    const name=document.getElementById('libMoveName')?.value.trim(),type=document.getElementById('libMoveType')?.value,category=document.getElementById('libMoveCategory')?.value;
    let power=document.getElementById('libMovePower')?.value,accuracy=document.getElementById('libMoveAccuracy')?.value,canonical=document.getElementById('libMoveCanonical')?.value;
    const description=document.getElementById('libMoveDescription')?.value||'',notes=document.getElementById('libMoveNotes')?.value||'';
    power=power===''?null:Math.trunc(Number(power));accuracy=accuracy===''?null:Math.trunc(Number(accuracy));canonical=canonical===''?null:Math.trunc(Number(canonical));
    if(!name)return toast('Informe o nome do Move.','warning');if(accuracy!=null&&(accuracy<1||accuracy>90))return toast('Accuracy RPG deve ficar entre 1 e 90%.','warning');
    if(category==='Status')power=0;
    try{
      if(app.mode==='demo'){
        const row={id:id||newid(),name,type,category,power,accuracy,canonicalAccuracy:canonical,description,notes,updatedAt:new Date().toISOString()};app.moveLibrary=app.moveLibrary.filter(x=>x.id!==row.id).concat(row).sort((a,b)=>a.name.localeCompare(b.name));saveLocalExtras();
      }else{
        const payload={name,type,category,power,accuracy,canonical_accuracy:canonical,description,notes};const r=id?await app.client.from('pokedex_move_library').update(payload).eq('id',id):await app.client.from('pokedex_move_library').insert(payload);if(r.error)throw r.error;await loadExtras();
      }
      openLibrary('move');render();toast('Move salvo na biblioteca.','success');
    }catch(e){toast(e.message||e,'error')}
  }
  async function deleteLibrary(kind,id){
    const list=kind==='ability'?app.abilityLibrary:app.moveLibrary,item=list.find(x=>x.id===id);if(!item||!confirm('Excluir '+item.name+' da biblioteca?'))return;
    try{
      if(app.mode==='demo'){if(kind==='ability')app.abilityLibrary=app.abilityLibrary.filter(x=>x.id!==id);else app.moveLibrary=app.moveLibrary.filter(x=>x.id!==id);saveLocalExtras()}
      else{const table=kind==='ability'?'pokedex_ability_library':'pokedex_move_library';const r=await app.client.from(table).delete().eq('id',id);if(r.error)throw r.error;await loadExtras()}
      openLibrary(kind);render();
    }catch(e){toast(e.message||e,'error')}
  }
  async function copyText(text){try{await navigator.clipboard.writeText(text);toast('Copiado.','success')}catch{toast('Não foi possível copiar automaticamente.','warning')}}
  async function picker(kind,target='editor'){
    await system?.ready;
    pickerTarget=target;
    if(pickerKind!==kind){librarySearch='';libraryGroup='all';libraryLimit=40;}
    pickerKind=kind;
    const body=`<div class="modal-body">${syncHTML()}<div class="info-strip">${kind==='rules'?'Consulte as regras da ficha e adicione o texto desejado às regras especiais do Pokémon.':'Escolha uma entrada para preencher o Pokémon que está sendo editado.'}</div>${libraryFiltersHTML(kind)}<div id="systemLibraryResults">${libraryListHTML()}</div></div>`;
    modalShell(kind==='rules'?'Regras da ficha':'Adicionar da Biblioteca',kind==='ability'?'Abilities alteradas de Heaven & Hell':kind==='move'?'Moves próprios e alterados da ficha':'Manual do sistema',body,'<button class="btn btn-outline" data-action="toolReturnEditor">Voltar ao Pokémon</button>');
    document.getElementById('modal').dataset.kind='library-picker';
  }

  function injectAbilityInputs(body){
    if(!body)return;
    let names=body.querySelector('#gmAbilityNames');
    if(!names){names=document.createElement('datalist');names.id='gmAbilityNames';body.append(names);}
    names.innerHTML=libraryEntries('ability').map(a=>`<option value="${esc(a.name)}"></option>`).join('');
    body.querySelectorAll('input[data-ability-index][data-subfield="name"],input[data-form-ability-index][data-subfield="name"],input[data-mega-ability="name"]').forEach(input=>{
      if(input.dataset.abilityLookupReady)return;
      input.dataset.abilityLookupReady='1';input.setAttribute('list','gmAbilityNames');input.setAttribute('autocomplete','off');
      input.placeholder='Ex.: Intimidate ou Blaze Pulse';
      input.insertAdjacentHTML('afterend','<button type="button" class="btn btn-outline btn-sm" style="align-self:flex-start" data-action="toolLookupAbility">⌕ Buscar Ability</button><small class="system-lookup-status" role="status" data-ability-status>Digite o nome para preencher o efeito da ficha.</small>');
    });
  }

  function injectEditor(){
    const body=document.getElementById('editorBody');if(!body||!app.editor)return;
    if(app.editor.tab==='abilities'&&!body.querySelector('[data-action="toolPickAbility"]')){
      const first=body.querySelector('.repeat-list');if(first)first.insertAdjacentHTML('beforebegin','<button class="btn btn-outline btn-sm mb" data-action="toolPickAbility">＋ Adicionar da Biblioteca</button>');
    }
    if(app.editor.tab==='moves'&&!body.querySelector('[data-action="toolPickMove"]')){
      const first=body.querySelector('.repeat-list');if(first)first.insertAdjacentHTML('beforebegin','<button class="btn btn-outline btn-sm mb" data-action="toolPickMove">＋ Adicionar da Biblioteca</button>');
    }
    if(app.editor.tab==='rules'&&!body.querySelector('[data-action="toolPickRules"]')){
      body.insertAdjacentHTML('afterbegin','<div class="system-editor-tools"><button class="btn btn-outline btn-sm" data-action="toolPickRules">▣ Consultar regras da ficha</button></div>');
    }
    if(app.editor.tab==='forms'){
      body.querySelectorAll('[data-action="addFormAbility"]').forEach(button=>{
        if(button.parentElement.querySelector('[data-action="toolFormPickAbility"]'))return;
        button.insertAdjacentHTML('afterend',` <button class="btn btn-outline btn-sm mt" data-action="toolFormPickAbility" data-index="${button.dataset.index}">＋ Ability da Biblioteca</button>`);
      });
    }
    injectAbilityInputs(body);
    if(app.editor.tab==='moves'){
      if(!document.getElementById('gmMoveNames')){
        body.insertAdjacentHTML('beforeend','<datalist id="gmMoveNames"></datalist>');
        const list=document.getElementById('gmMoveNames');
        window.POKEDEX_MOVE_LOOKUP?.names(app.moveLibrary).then(names=>{
          if(list.isConnected)list.innerHTML=names.map(name=>`<option value="${esc(name)}"></option>`).join('');
        });
      }
      body.querySelectorAll('[data-move-index][data-subfield="name"]').forEach(input=>{
        if(input.dataset.moveLookupReady)return;
        const index=input.dataset.moveIndex;
        input.dataset.moveLookupReady='1';input.setAttribute('list','gmMoveNames');
        input.setAttribute('autocomplete','off');input.setAttribute('aria-label','Nome do movimento '+(Number(index)+1));
        input.placeholder='Ex.: Flamethrower ou Swords Dance';
        input.insertAdjacentHTML('afterend',`<button type="button" class="btn btn-outline btn-sm" style="align-self:flex-start" data-action="toolLookupMove" data-index="${index}">⌕ Buscar move</button><small role="status" aria-live="polite" data-move-lookup-status="${index}">Digite o nome para preencher os dados automaticamente.</small>`);
      });
    }
  }

  async function action(el){
    const a=el.dataset.action,id=el.dataset.id;
    if(a==='toolCreateFakemon')createFakemon();
    else if(a==='toolReworkWizard')openReworkWizard();
    else if(a==='toolReworkSearch')await searchRework();
    else if(a==='toolReworkUse')useRework();
    else if(a==='toolMegaWizard')openMegaWizard();
    else if(a==='toolMegaSearch')await searchMegaBase();
    else if(a==='toolMegaContinue')openMegaEditor();
    else if(a==='toolMegaSave'){try{await saveMega(true)}catch(e){toast(e.message||e,'error')}}
    else if(a==='toolMegaPublish')await publishMega();
    else if(a==='toolMegaDetail')megaDetail(id);
    else if(a==='toolMegaEdit'){const m=app.customMegas.find(x=>x.id===id);if(m)openMegaEditor(m)}
    else if(a==='toolMegaPublishExisting'){const m=app.customMegas.find(x=>x.id===id);if(m){megaEditor={...JSON.parse(JSON.stringify(m)),newFile:null};await publishMega()}}
    else if(a==='toolMegaUnpublish')await unpublishMega(id,false);
    else if(a==='toolMegaArchive')await unpublishMega(id,true);
    else if(a==='toolMegaDelete')await deleteMega(id);
    else if(a==='toolMegaPickAbility')picker('ability','mega');
    else if(a==='toolLibrary')await openLibrary();
    else if(a==='toolLibraryTab')await openLibrary(el.dataset.tab);
    else if(a==='toolLibraryMore'){libraryLimit+=40;document.getElementById('systemLibraryResults').innerHTML=libraryListHTML();}
    else if(a==='toolSystemSync'){
      try{await system?.refresh();toast('Banco atualizado a partir da ficha.','success');}catch{toast('Não foi possível atualizar. O banco já salvo continua disponível.','warning');}
      const kind=document.getElementById('modal')?.dataset.kind;
      if(kind==='library')await openLibrary();else if(kind==='library-picker')await picker(pickerKind,pickerTarget);
    }
    else if(a==='toolAbilityNew')abilityForm();
    else if(a==='toolAbilityEdit'){const x=libraryEntries('ability').find(x=>x.id===id);if(x)abilityForm({...x,id:x.origin==='sheet'?'':x.id,notes:x.notes||''});}
    else if(a==='toolAbilitySave')await saveAbility(id);
    else if(a==='toolAbilityDelete')await deleteLibrary('ability',id);
    else if(a==='toolMoveNew')moveForm();
    else if(a==='toolMoveEdit'){const x=libraryEntries('move').find(x=>x.id===id);if(x)moveForm({...x,id:x.origin==='sheet'?'':x.id,notes:x.notes||''});}
    else if(a==='toolMoveSave')await saveMove(id);
    else if(a==='toolMoveDelete')await deleteLibrary('move',id);
    else if(a==='toolLibraryBack')await openLibrary();
    else if(a==='toolLibraryCopyAbility'){const x=libraryEntries('ability').find(v=>v.id===id);if(x)await copyText(x.name+' — '+x.description)}
    else if(a==='toolLibraryCopyMove'){const x=libraryEntries('move').find(v=>v.id===id);if(x)await copyText(x.name+' — '+x.type+' — '+x.category+' — Power '+(x.power??'—')+' — Accuracy '+(x.accuracy??'—')+'% — '+x.description)}
    else if(a==='toolRuleCopy'){const x=libraryEntries('rules').find(v=>v.id===id);if(x)await copyText(ruleText(x));}
    else if(a==='toolPickAbility')picker('ability','editor');
    else if(a==='toolPickMove')picker('move','editor');
    else if(a==='toolPickRules')picker('rules','editor');
    else if(a==='toolFormPickAbility')picker('ability','form:'+el.dataset.index);
    else if(a==='toolLookupAbility'){const input=el.parentElement.querySelector('input');if(input)queueAbilityLookup(input,true);}
    else if(a==='toolLookupMove')queueMoveLookup(el.dataset.index,true);
    else if(a==='toolUseAbility'){const x=libraryEntries('ability').find(v=>v.id===id);if(!x)return;if(pickerTarget==='mega'&&megaEditor){megaEditor.abilities=[{name:x.name,text:x.description}];openMegaEditor();toast('Ability adicionada à Mega.','success')}else if(app.editor){const list=pickerTarget.startsWith('form:')?app.editor.forms[Number(pickerTarget.split(':')[1])]?.abilities:app.editor.model.abilities;if(!list)return;const blank=list.find(a=>!a.name.trim()&&!a.text.trim());if(blank)Object.assign(blank,{name:x.name,text:x.description});else list.push({name:x.name,text:x.description});editorDirty();renderEditor();toast('Ability adicionada ao Pokémon.','success')}}
    else if(a==='toolUseMove'){const x=libraryEntries('move').find(v=>v.id===id),editor=app.editor;if(x&&editor){const data=await window.POKEDEX_MOVE_LOOKUP.lookup(x.name,app.moveLibrary);if(app.editor!==editor)return;editor.model.moves.push({...data,learn:''});editorDirty();renderEditor();toast('Move adicionado ao Pokémon.','success')}}
    else if(a==='toolUseRule'){const x=libraryEntries('rules').find(v=>v.id===id);if(x&&app.editor){const text=ruleText(x);if(!(app.editor.model.specialRules||'').includes(text)){app.editor.model.specialRules=[app.editor.model.specialRules,text].filter(Boolean).join('\n\n');editorDirty();}app.editor.tab='rules';renderEditor();toast('Regra adicionada ao Pokémon.','success');}}
    else if(a==='toolReturnEditor'){if(pickerTarget==='mega'&&megaEditor)openMegaEditor();else if(app.editor)renderEditor();else closeModal(true)}
  }

  const own=new Set(['toolCreateFakemon','toolReworkWizard','toolReworkSearch','toolReworkUse','toolMegaWizard','toolMegaSearch','toolMegaContinue','toolMegaSave','toolMegaPublish','toolMegaDetail','toolMegaEdit','toolMegaPublishExisting','toolMegaUnpublish','toolMegaArchive','toolMegaDelete','toolMegaPickAbility','toolLibrary','toolLibraryTab','toolAbilityNew','toolAbilityEdit','toolAbilitySave','toolAbilityDelete','toolMoveNew','toolMoveEdit','toolMoveSave','toolMoveDelete','toolLibraryBack','toolLibraryCopyAbility','toolLibraryCopyMove','toolPickAbility','toolPickMove','toolLookupMove','toolUseAbility','toolUseMove','toolReturnEditor','toolSystemSync','toolLibraryMore','toolRuleCopy','toolPickRules','toolFormPickAbility','toolLookupAbility','toolUseRule']);
  document.addEventListener('click',ev=>{const el=ev.target.closest('[data-action]');if(!el||!own.has(el.dataset.action))return;ev.preventDefault();ev.stopImmediatePropagation();Promise.resolve(action(el)).catch(e=>toast(e.message||e,'error'))},true);
  document.addEventListener('input',ev=>{
    const el=ev.target;
    if(el.id==='systemLibrarySearch'){librarySearch=el.value;libraryLimit=40;document.getElementById('systemLibraryResults').innerHTML=libraryListHTML();return;}
    if(el.matches('[data-ability-index],[data-form-ability-index],[data-mega-ability]')){
      const field=el.dataset.subfield||el.dataset.megaAbility;
      if(field==='name')queueAbilityLookup(el);
      else{const ability=abilityBinding(el);if(ability)cancelAbilityLookup(ability);}
    }
    if(el.dataset.moveIndex!=null&&el.closest('#editorBody')){
      const move=app.editor?.model.moves[Number(el.dataset.moveIndex)];
      if(el.dataset.subfield==='name')queueMoveLookup(el.dataset.moveIndex);
      else if(move&&el.dataset.subfield!=='learn'){
        cancelMoveLookup(move);moveLookupStatus(move,'Dados editados manualmente.');
      }
    }
    if(!megaEditor)return;
    if(el.dataset.megaField!=null){megaEditor[el.dataset.megaField]=el.value;if(el.dataset.megaField==='slug')megaEditor.slugEdited=true;if(el.dataset.megaField==='name'&&!megaEditor.slugEdited)megaEditor.slug='mega-'+slug(el.value).replace(/^mega-/,'');}
    else if(el.dataset.megaStat){megaEditor.baseStats[el.dataset.megaStat]=Math.trunc(Number(el.value)||0);const b=document.getElementById('customMegaBST');if(b)b.textContent=statsTotal(megaEditor.baseStats)}
    else if(el.dataset.megaAbility){megaEditor.abilities=megaEditor.abilities?.length?megaEditor.abilities:[{name:'',text:''}];megaEditor.abilities[0][el.dataset.megaAbility]=el.value}
  });
  document.addEventListener('change',ev=>{
    const el=ev.target;
    if(el.id==='systemLibraryGroup'){libraryGroup=el.value;libraryLimit=40;document.getElementById('systemLibraryResults').innerHTML=libraryListHTML();return;}
    if(el.id==='customMegaArtFile'&&megaEditor){
      const f=el.files?.[0];if(!f)return;megaEditor.newFile=f;
      const img=document.getElementById('customMegaPreview');if(img?.tagName==='IMG')img.src=URL.createObjectURL(f);
    }
  });
  document.addEventListener('keydown',ev=>{
    if(ev.key!=='Enter')return;
    if(ev.target.matches('[data-move-index][data-subfield="name"]')){
      ev.preventDefault();queueMoveLookup(ev.target.dataset.moveIndex,true);
    }
    if(ev.target.matches('input[data-ability-index][data-subfield="name"],input[data-form-ability-index][data-subfield="name"],input[data-mega-ability="name"]')){
      ev.preventDefault();queueAbilityLookup(ev.target,true);
    }
    if(ev.target.id==='reworkPokeSearch'){ev.preventDefault();searchRework()}
    if(ev.target.id==='customMegaBaseSearch'){ev.preventDefault();searchMegaBase()}
  });

  window.POKEDEX_GM_TOOLS_AFTER_RENDER=afterRender;
  window.POKEDEX_GM_TOOLS_EDITOR=injectEditor;
  window.POKEDEX_GM_TOOLS_LOAD=loadExtras;
  window.addEventListener('pokedex-system-update',()=>{
    const strip=document.querySelector('.system-library-sync');if(strip)strip.outerHTML=syncHTML();
    if(app.nav==='tools')afterRender();
    const body=document.getElementById('editorBody');if(body)injectAbilityInputs(body);
    const results=document.getElementById('systemLibraryResults');if(results)results.innerHTML=libraryListHTML();
    const names=document.getElementById('gmMoveNames');
    if(names)window.POKEDEX_MOVE_LOOKUP?.names(app.moveLibrary).then(values=>{if(names.isConnected)names.innerHTML=values.map(name=>`<option value="${esc(name)}"></option>`).join('');});
  });
  system?.ready.then(()=>{if(app.nav==='tools')afterRender();});
  ensureExtras();
};
