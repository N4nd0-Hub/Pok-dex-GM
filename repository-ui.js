/* Interface e adoção dos Pokémon criados pelos arquivos do Git. */
window.POKEDEX_REPOSITORY_SETUP=function(api){
  'use strict';
  const {app,esc,toast,render,modalShell,openEditor,openDetail,handleArt}=api;
  const repo=window.POKEDEX_REPOSITORY;
  let catalog={species:[],forms:[]},error='';
  async function load(force=false){
    try{catalog=await repo.fetchCatalog({force});error='';repo.mergeInto(app,catalog);}
    catch(e){error=e.message;}
    app.repositoryCatalog=catalog;return catalog;
  }
  function sourceOf(id){
    const row=catalog.species.find(s=>s.id===id);
    if(row?.status==='archived'&&!app.items.some(s=>s.id===id&&s.repository?.sourceOnly))return undefined;
    return row?.repository;
  }
  function afterRender(){
    const workbench=document.querySelector('#gmWorkbench .gm-tool-grid');
    if(workbench&&!workbench.querySelector('[data-repository-card]')){
      workbench.insertAdjacentHTML('beforeend',`<section class="gm-tool-card library" data-repository-card><span class="gm-tool-icon">◈</span><div><span class="eyebrow">CRIAÇÕES DO CHAT</span><h2>Pokémon dos arquivos</h2><p>Novos Pokémon preparados no Git entram no catálogo automaticamente, com arte, formas, Abilities e Moves.</p><small>${catalog.species.filter(s=>s.status!=='archived').length} Pokémon disponíveis</small></div><button class="btn btn-primary" data-action="repositoryLibrary">Abrir criações</button></section>`);
    }
    for(const button of document.querySelectorAll('.poke-card [data-action="detail"]')){
      const item=[...app.items,...app.published,...app.forms,...app.publicForms].find(s=>s.id===button.dataset.id);
      const container=button.closest('.poke-card')?.querySelector('.card-status');
      if(item?.repository&&container&&!container.querySelector('[data-repository-badge]'))container.insertAdjacentHTML('beforeend','<span class="badge muted" data-repository-badge title="Publicado a partir dos arquivos do Git">Git</span>');
    }
  }
  function decorateDetail(item,form){
    const source=sourceOf(form?item.speciesId:item.id);if(!source)return;
    const controls=document.querySelector('#drawer .drawer-controls');
    const chain=document.getElementById('chainDrawerSection');
    chain?.querySelectorAll('[data-action="chainSplit"]').forEach(el=>el.remove());
    const parent=form?app.items.find(s=>s.id===item.speciesId):item;
    if(chain&&!app.gm&&!chain.querySelector('.chain-drawer-card')&&!parent?.evolution?.previous&&!parent?.evolution?.next)chain.remove();
    controls?.querySelectorAll('[data-action="unpublish"],[data-action="archive"],[data-action="delete"]').forEach(el=>el.remove());
    if(controls&&!controls.querySelector('.repository-origin'))controls.insertAdjacentHTML('beforeend',`<div class="repository-origin">Esta publicação vem do catálogo do Git. Edições salvas pelo painel GM têm prioridade.<br><a href="https://github.com/N4nd0-Hub/Pok-dex-GM/blob/main/${esc(source.file)}" target="_blank" rel="noopener">Abrir arquivo de origem ↗</a></div>`);
  }
  function afterEditor(){
    /* A evolução de um Pokémon do Git é permitida: o assistente o salva no banco antes de ligar a linha. */
  }
  function library(){
    if(!app.gm)return;
    const entries=catalog.species.filter(s=>s.status!=='archived');
    const list=entries.map(s=>`<article class="repository-entry"><div>${s.coverUrl?`<img src="${esc(s.coverUrl)}" alt="Arte de ${esc(s.name)}" loading="lazy">`:''}<span><b>${esc(s.name)}</b><small>${esc([s.type1,s.type2].filter(Boolean).join(' / '))} · BST ${Object.values(s.baseStats).reduce((n,v)=>n+Number(v),0)} · ${s.status==='published'?'Publicado':'Rascunho'}</small></span></div><button class="btn btn-outline btn-sm" data-action="repositoryDetail" data-id="${esc(s.id)}">Ver Pokémon</button><button class="btn btn-primary btn-sm" data-action="repositoryEdit" data-id="${esc(s.id)}">Editar no painel GM</button></article>`).join('');
    modalShell('Pokémon criados no chat','Catálogo de criações por arquivos',`<div class="modal-body"><div class="info-strip">As próximas criações podem trazer tipos, BST, Abilities, Moves, evolução e artes já preenchidos. Elas aparecem no catálogo quando os arquivos são publicados.</div>${error?`<p class="form-warning">${esc(error)}</p>`:''}<div class="repository-list">${list||'<div class="gm-empty-note"><h3>Pronto para receber seus Pokémon</h3><p>As próximas criações feitas aqui aparecerão nesta coleção automaticamente.</p></div>'}</div><p class="file-note"><a href="https://github.com/N4nd0-Hub/Pok-dex-GM/blob/main/pokemons/README.md" target="_blank" rel="noopener">Ver o formato para novas criações ↗</a></p></div>`,'<button class="btn btn-outline" data-action="repositoryRefresh">↻ Atualizar criações</button><button class="btn btn-outline" data-action="closeModal">Fechar</button>');
    document.getElementById('modal').dataset.kind='repository-library';
  }
  async function stageArt(editor,sources){
    const controller=new AbortController();editor.repositoryArtController=controller;
    try{
      for(const entry of sources){
        if(!entry.url)continue;if(app.editor!==editor)return;
        if(entry.scope==='species'?editor.model.coverArtId:editor.forms[entry.index]?.artId)continue;
        const timer=setTimeout(()=>controller.abort(),15000);
        let blob;
        try{const response=await fetch(entry.url,{signal:controller.signal});if(!response.ok)throw Error('A arte não pôde ser carregada.');blob=await response.blob();}finally{clearTimeout(timer);}
        if(app.editor!==editor)return;
        if(entry.scope==='species'?editor.model.coverArtId:editor.forms[entry.index]?.artId)continue;
        const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[blob.type];if(!ext)throw Error('A arte precisa ser PNG, JPEG ou WebP.');
        const before=entry.scope==='species'?editor.model.coverArtId:editor.forms[entry.index]?.artId;
        await handleArt(new File([blob],'arte.'+ext,{type:blob.type}),entry.scope,entry.index);
        if(app.editor!==editor)return;
        const after=entry.scope==='species'?editor.model.coverArtId:editor.forms[entry.index]?.artId;
        if(!after||after===before)throw Error('Não foi possível preparar a arte do Pokémon.');
      }
    }catch(e){if(app.editor===editor){editor.repositoryArtError=e.message;toast('Arte da criação: '+e.message,'error');}}
  }
  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-action]');if(!el||!el.dataset.action.startsWith('repository'))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(el.dataset.action==='repositoryLibrary')library();
    else if(el.dataset.action==='repositoryRefresh')load(true).then(()=>{render();library();});
    else if(el.dataset.action==='repositoryEdit'){document.getElementById('modalShade').classList.add('hidden');openEditor(el.dataset.id);}
    else if(el.dataset.action==='repositoryDetail'){document.getElementById('modalShade').classList.add('hidden');openDetail(el.dataset.id);}
  },true);
  window.POKEDEX_REPOSITORY_UI={load,afterRender,decorateDetail,afterEditor,sourceOf,stageArt};
};
