/* Pokédex GM V5.0 — Linhas evolutivas, 2–8 estágios.
   Não há acesso a segredos: a escrita usa sessão GM + RPC security invoker/RLS.
   Uma espécie continua sendo um registro; o vínculo é salvo em evolution (JSONB).
   Publicar é sempre uma ação explícita e separada do salvamento em rascunho. */
window.POKEDEX_EVOLUTION_SETUP = function (api) {
  'use strict';
  const {app, isEditable, modalShell, closeModal, closeDrawer, openEditor,
    toast, slug, esc, byId, visible, artTag, hydrateArt, render, demoPersist,
    loadCatalog} = api;
  const TYPES = ['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground',
    'Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
  const STATS = [['hp','HP'],['atk','Attack'],['def','Defense'],['spa','Sp.Atk'],['spd','Sp.Def'],['spe','Speed']];
  const STAT_DEFAULT = {hp:50,atk:50,def:50,spa:50,spd:50,spe:50};
  const ACTIONS = new Set(['chainWizard','chainFromDetail','chainFromEditor','chainAdd',
    'chainRemove','chainUp','chainDown','chainSave','chainEditStage','chainSplit','chainSplitSave']);
  const own = (obj,key) => Object.prototype.hasOwnProperty.call(obj,key);
  const clone = x => JSON.parse(JSON.stringify(x));
  const clean = val => String(val ?? '').trim();
  const safe = value => esc(String(value ?? ''));
  let wizard = null;

  function newStage() {
    return {id:crypto.randomUUID(),mode:'new',name:'',slug:'',slugEdited:false,
      dex:'',classification:'fakemon',category:'',description:'',type1:'Normal',type2:'',
      baseStats:clone(STAT_DEFAULT),requirements:'',level:''};
  }
  function existingStage(s) {
    return {id:s.id,mode:'existing',name:s.name,slug:s.slug,expectedRevision:s.revision,
      requirements:clean(s.evolution?.requirements),level:clean(s.evolution?.level),
      classification:s.classification,type1:s.type1,type2:s.type2||'',
      baseStats:clone(s.baseStats),dex:s.dex||'',category:s.category||'',description:s.description||''};
  }
  function gmItems() {return (app.items||[]).filter(s=>s.status!=='archived');}
  function chainMembers(chainId) {
    return gmItems().filter(s=>s.evolution?.chainId===chainId)
      .sort((a,b)=>(Number(a.evolution.stage)||0)-(Number(b.evolution.stage)||0));
  }
  function stageFromCurrent(s) {
    const cid=s.evolution?.chainId;
    const connected=cid?chainMembers(cid):[];
    return {chainId:cid||crypto.randomUUID(),
      rows:connected.length?connected.map(existingStage):[existingStage(s),newStage()],
      dirty:false,saving:false,publish:false};
  }
  function addButtons() {
    for (const [selector,label] of [
      ['.hero-buttons','⤳ Criar linha evolutiva'],
      ['.section-actions','⤳ Nova linha evolutiva']
    ]) {
      const target=document.querySelector(selector);
      if (target && !target.querySelector('[data-action="chainWizard"]'))
        target.insertAdjacentHTML('beforeend',
          `<button class="btn btn-outline gm-only" data-action="chainWizard">${label}</button>`);
    }
  }
  function openWizard(speciesId=null) {
    if (!isEditable()) return toast('Entre como GM e conecte-se ao banco para criar linhas evolutivas.','warning');
    if (app.editor?.dirty && !confirm('Você tem alterações não salvas. Descartar para criar a linha evolutiva?')) return;
    const selected=speciesId?byId(app.items,speciesId):null;
    if (speciesId&&!selected) return toast('Pokémon não encontrado. Atualize a Pokédex.','error');
    wizard=selected?stageFromCurrent(selected):
      {chainId:crypto.randomUUID(),rows:[newStage(),newStage(),newStage()],dirty:false,saving:false,publish:false};
    if (!wizard) return;
    closeModal(true);closeDrawer();
    const footer=`<span class="chain-foot-help">As espécies serão ligadas pelo ID. O banco não publica rascunhos.</span>
      <button class="btn btn-primary" data-action="chainSave" id="chainSaveButton">Salvar linha evolutiva</button>`;
    modalShell(selected?'Continuar linha evolutiva':'Criar linha evolutiva',
      'Cadastre até 8 estágios de uma vez ou aproveite Pokémon que já estão no banco.',
      '<div class="modal-body chain-body" id="chainBody"></div>',footer);
    document.getElementById('modal').dataset.kind='chain-wizard';
    document.getElementById('modal').classList.add('chain-modal');
    drawWizard();
  }
  const typeOptions=(selected,allowEmpty=false)=>(allowEmpty?'<option value="">Nenhum</option>':'')+
    TYPES.map(t=>`<option value="${t}" ${t===selected?'selected':''}>${t}</option>`).join('');
  const classOptions=(selected)=>[['fakemon','Fakemon'],['rework','Rework'],['official','Oficial']]
    .map(([v,t])=>`<option value="${v}" ${v===selected?'selected':''}>${t}</option>`).join('');
  function stageTitle(r,i) {return r.name||`Novo Pokémon ${i+1}`;}
  function preview() {
    const target=document.getElementById('chainPreviewBar');
    if(!target||!wizard)return;
    target.innerHTML=wizard.rows.map((r,i)=>`${i?'<span class="chain-preview-arrow">→</span>':''}
      <span class="chain-preview-pill"><b>${safe(stageTitle(r,i))}</b><small>${r.mode==='existing'?'Já cadastrado':'Novo'}
      ${i?`· ${safe(r.requirements||r.level&&'Nível '+r.level||'Método a definir')}`:''}</small></span>`).join('');
  }
  function drawWizard(){
    if(!wizard)return;
    const target=document.getElementById('chainBody');if(!target)return;
    target.innerHTML=`<div class="chain-info">
        <strong>⤳ Uma linha evolutiva, vários Pokémon.</strong>
        Você pode combinar espécies existentes com Fakemon novos. Clique em <b>Salvar linha</b> para
        cadastrar e vincular todos os estágios em uma operação. Depois, complete Moves, Abilities e artes individuais.
      </div>
      <div class="chain-preview" id="chainPreviewBar" aria-label="Prévia da linha evolutiva"></div>
      ${wizard.rows.map(drawStage).join('')}
      <div class="chain-toolbar"><button class="btn btn-outline" data-action="chainAdd" ${wizard.rows.length>=8?'disabled':''}>＋ Adicionar evolução</button>
        <span>${wizard.rows.length}/8 estágios</span></div>
      <label class="chain-publish-choice"><input type="checkbox" id="chainPublishAll" ${wizard.publish?'checked':''}>
        <span><b>Publicar todos após salvar</b><small>Opcional. Antes de marcar, preencha os Base Stats corretos. Abilities, Moves e artes podem ser adicionados após o cadastro; não use esta opção para modelos incompletos.</small></span>
      </label>
      <p class="chain-footnote">O cadastro não muda fichas de jogadores existentes. Etapas em rascunho só ficam visíveis para o GM. Linhas ramificadas, como Eevee, devem ser configuradas separadamente.</p>`;
    preview();
  }
  function drawStage(r,i){
    const existing=r.mode==='existing';
    const options=gmItems().sort((a,b)=>a.name.localeCompare(b.name)).map(s=>
      `<option value="${safe(s.id)}" ${s.id===r.id?'selected':''}>${safe(s.name)} · ${safe(s.slug)}${s.evolution?.chainId?' · vinculado':''}</option>`).join('');
    const stats=STATS.map(([k,label])=>
      `<label class="chain-stat"><span>${label}</span><input type="number" min="1" max="999" inputmode="numeric" data-chain-index="${i}" data-chain-stat="${k}" value="${Number(r.baseStats?.[k]??50)}" ${existing?'disabled':''}></label>`).join('');
    const bst=STATS.reduce((sum,[k])=>sum+(Number(r.baseStats?.[k])||0),0);
    return `<section class="chain-stage" data-chain-stage="${i}">
      <header class="chain-stage-top"><div><span class="chain-counter">${i+1}</span><b>${safe(stageTitle(r,i))}</b>
        <span class="badge ${existing?'published':'draft'}">${existing?'No banco':'Novo'}</span></div>
        <nav aria-label="Organizar etapas"><button type="button" title="Subir etapa" class="chain-mini" data-action="chainUp" data-index="${i}" ${i===0?'disabled':''}>↑</button>
        <button type="button" title="Descer etapa" class="chain-mini" data-action="chainDown" data-index="${i}" ${i===wizard.rows.length-1?'disabled':''}>↓</button>
        <button type="button" class="chain-mini chain-danger" title="Remover etapa" data-action="chainRemove" data-index="${i}" ${wizard.rows.length<=2?'disabled':''}>✕</button></nav>
      </header>
      <div class="chain-grid">
        <label class="chain-field"><span>Fonte desta etapa</span><select data-chain-index="${i}" data-chain-field="mode">
          <option value="new" ${existing?'':'selected'}>Criar Pokémon novo</option>
          <option value="existing" ${existing?'selected':''}>Usar Pokémon do banco</option></select></label>
        ${existing?`<label class="chain-field"><span>Espécie existente</span>
          <input type="search" data-chain-filter="${i}" placeholder="Filtrar opções por nome ou slug…" autocomplete="off">
          <select data-chain-index="${i}" data-chain-field="existingId" id="chainExisting${i}">${options}</select></label>
          <div class="chain-note">Os dados de ${safe(r.name)} serão preservados; apenas os vínculos evolutivos serão atualizados.</div>`:
          `<label class="chain-field"><span>Nome do Pokémon *</span><input required maxlength="120" placeholder="Ex.: Krillia" data-chain-index="${i}" data-chain-field="name" value="${safe(r.name)}"></label>
          <label class="chain-field"><span>Slug único</span><input maxlength="120" placeholder="ex.: krillia" data-chain-index="${i}" data-chain-field="slug" value="${safe(r.slug)}"></label>
          <label class="chain-field"><span>Classe</span><select data-chain-index="${i}" data-chain-field="classification">${classOptions(r.classification)}</select></label>
          <label class="chain-field"><span>Nº Pokédex (opcional)</span><input type="number" min="1" max="999999" data-chain-index="${i}" data-chain-field="dex" value="${safe(r.dex)}"></label>
          <label class="chain-field"><span>Tipo 1</span><select data-chain-index="${i}" data-chain-field="type1">${typeOptions(r.type1)}</select></label>
          <label class="chain-field"><span>Tipo 2</span><select data-chain-index="${i}" data-chain-field="type2">${typeOptions(r.type2,true)}</select></label>
          <div class="chain-stats-title">Base Stats <b data-chain-bst="${i}">BST ${bst}</b></div>
          <div class="chain-stats">${stats}</div>
          <label class="chain-field chain-full"><span>Descrição rápida (opcional)</span><input maxlength="500" placeholder="Pokémon personalizado, detalhes da espécie…" data-chain-index="${i}" data-chain-field="description" value="${safe(r.description)}"></label>`}
      </div>
      ${i?`<div class="chain-method">
        <span class="chain-method-symbol">↓</span><div class="chain-method-fields">
          <label class="chain-field"><span>Método para evoluir de ${safe(stageTitle(wizard.rows[i-1],i-1))} até aqui</span>
            <input maxlength="300" placeholder="Ex.: Nível 24 / Pedra especial / Amizade alta" data-chain-index="${i}" data-chain-field="requirements" value="${safe(r.requirements)}"></label>
          <label class="chain-field chain-level"><span>Nível (opcional)</span><input type="number" min="1" max="999" data-chain-index="${i}" data-chain-field="level" value="${safe(r.level)}" placeholder="24"></label>
        </div></div>`:'<div class="chain-base-tag">ESTÁGIO INICIAL</div>'}
    </section>`;
  }
  function swap(i,j){if(!wizard||i<0||j<0||i>=wizard.rows.length||j>=wizard.rows.length)return;
    [wizard.rows[i],wizard.rows[j]]=[wizard.rows[j],wizard.rows[i]];wizard.dirty=true;drawWizard();}
  function setMode(i,mode){const row=wizard.rows[i];if(!row)return;
    const preserved={requirements:row.requirements,level:row.level};
    const candidate=gmItems().find(s=>!wizard.rows.some((r,j)=>i!==j&&r.id===s.id));
    wizard.rows[i]=mode==='existing'&&candidate?{...existingStage(candidate),...preserved}:
      {...newStage(),...preserved}; wizard.dirty=true;drawWizard();
    if(mode==='existing'&&!candidate)toast('Nenhuma espécie disponível para vincular. Crie uma espécie nova.','warning');
  }
  function setExisting(i,id){const row=wizard?.rows[i],s=byId(app.items,id);
    if(!row||!s)return;
    if(wizard.rows.some((r,j)=>j!==i&&r.id===id))return toast('Este Pokémon já aparece em outra etapa.','warning');
    const cid=s.evolution?.chainId;
    if(cid&&cid!==wizard.chainId)return toast('Este Pokémon pertence a outra linha. Abra a linha dele para continuar ou editar.','warning');
    wizard.rows[i]={...existingStage(s),requirements:row.requirements,level:row.level};
    wizard.dirty=true;drawWizard();
  }
  function getPayload(){
    if(!wizard||wizard.rows.length<2||wizard.rows.length>8)throw Error('Informe de 2 a 8 estágios.');
    const slugs=new Set(), ids=new Set();
    return wizard.rows.map((r,i)=>{
      if(ids.has(r.id))throw Error('Um Pokémon não pode aparecer duas vezes na linha.');ids.add(r.id);
      const req=clean(r.requirements);const level=clean(r.level);
      if(req.length>300)throw Error(`Método de evolução muito longo na etapa ${i+1}.`);
      if(level&&(!/^\d{1,3}$/.test(level)||Number(level)<1||Number(level)>999))
        throw Error(`Nível de evolução inválido na etapa ${i+1}.`);
      if(i&& !req && !level)throw Error(`Informe o método ou o nível da evolução para ${r.name||'etapa '+(i+1)}.`);
      const requirements=req|| (i&&level?`Nível ${level}`:'');
      if(r.mode==='existing'){
        const current=byId(app.items,r.id);
        if(!current)throw Error(`Espécie existente indisponível na etapa ${i+1}. Atualize a Pokédex.`);
        if(current.evolution?.chainId&&current.evolution.chainId!==wizard.chainId)
          throw Error(`${current.name} já está ligado a outra linha evolutiva.`);
        return {id:r.id,existing:true,expectedRevision:r.expectedRevision,requirements,level};
      }
      const name=clean(r.name),key=slug(r.slug||name);
      if(!name||name.length>120)throw Error(`Preencha o nome da etapa ${i+1}.`);
      if(!key||key.length>120)throw Error(`Slug inválido em ${name}.`);
      if(slugs.has(key)||gmItems().some(s=>s.slug===key))
        throw Error(`O slug “${key}” já existe ou está repetido. Use um slug exclusivo.`);
      slugs.add(key);
      const dex=clean(r.dex);
      if(dex&&(!/^\d{1,6}$/.test(dex)||+dex<1||+dex>999999))throw Error(`Número Pokédex inválido para ${name}.`);
      if(!TYPES.includes(r.type1)||r.type2&&(!TYPES.includes(r.type2)||r.type1===r.type2))
        throw Error(`Tipagem inválida para ${name}.`);
      const stats={};for(const [k,label] of STATS){const raw=String(r.baseStats[k]);
        if(!/^\d{1,3}$/.test(raw)||+raw<1||+raw>999)throw Error(`${name}: ${label} deve estar entre 1 e 999.`);
        stats[k]=+raw;}
      return {id:r.id,existing:false,name,slug:key,dex:dex||null,
        classification:r.classification,type1:r.type1,type2:r.type2||'',
        baseStats:stats,category:clean(r.category),description:clean(r.description),requirements,level};
    });
  }
  async function saveChain(){
    if(!isEditable()||!wizard||wizard.saving)return;
    let entries;
    try{entries=getPayload()}catch(e){toast(e.message,'error');return;}
    const shouldPublish=Boolean(wizard.publish);
    const incomplete=entries.filter(x=>!x.existing);
    if(shouldPublish && incomplete.length && !confirm(
      `Publicar ${entries.length} Pokémon agora? ${incomplete.length} são novos e ainda não possuem Abilities, Moves ou artes cadastradas nesta tela. Você pode cancelar e salvar apenas os rascunhos.`))return;
    wizard.saving=true;
    const btn=document.getElementById('chainSaveButton');if(btn){btn.disabled=true;btn.textContent='Salvando estágios…';}
    let publishErrors=[];const publishedNames=[],publishedIds=[];
    try {
      if(app.mode==='demo'){
        const ids=entries.map(e=>e.id), names=entries.map(e=>e.existing?byId(app.items,e.id).name:e.name);
        for(let i=0;i<entries.length;i++){
          const e=entries[i],old=byId(app.items,e.id);
          const evolution={...(old?.evolution||{}),chainId:wizard.chainId,stage:i,
            previousId:i?ids[i-1]:null,nextIds:i<ids.length-1?[ids[i+1]]:[],
            previous:i?names[i-1]:'',next:i<ids.length-1?names[i+1]:'',
            requirements:e.requirements||'',level:e.level||''};
          const model=old?{...clone(old),evolution,revision:(old.revision||1)+1,updatedAt:new Date().toISOString()}:
            {id:e.id,name:e.name,slug:e.slug,dex:e.dex,classification:e.classification,
             category:e.category,description:e.description,type1:e.type1,type2:e.type2,
             baseStats:e.baseStats,abilities:[],evolution,moves:[],specialRules:'',notes:'',
             coverArtId:null,status:'draft',revision:1,publishedRevision:null,updatedAt:new Date().toISOString()};
          app.items=app.items.filter(s=>s.id!==e.id).concat(model);
        }
        if(shouldPublish)for(const e of entries){const s=byId(app.items,e.id);s.status='published';
          s.publishedRevision=s.revision;s.publishedAt=new Date().toISOString();
          app.published=app.published.filter(p=>p.id!==e.id).concat({...clone(s),notes:''});
          publishedNames.push(s.name);publishedIds.push(s.id);
        }
        await demoPersist();
      }else{
        const result=await app.client.rpc('pokedex_save_evolution_chain',
          {p_chain_id:wizard.chainId,p_entries:entries});
        if(result.error)throw result.error;
        if(shouldPublish){
          for(const e of entries){
            const result=await app.client.rpc('pokedex_publish',{p_id:e.id});
            const name=e.name||byId(app.items,e.id)?.name||e.id;
            if(result.error)publishErrors.push(`${name}: ${result.error.message}`);
            else {publishedNames.push(name);publishedIds.push(e.id);}
          }
        }
        await loadCatalog();
      }
      const snapshot=clone(entries), msg=publishErrors.length?
        `Linha salva. ${publishedNames.length} publicado(s); ${publishErrors.length} publicação(ões) falharam.`:
        shouldPublish?`${entries.length} estágio(s) salvos e publicados.`:
        `${entries.length} estágio(s) vinculados em rascunho. Agora complete cada um e publique.`;
      wizard=null;render();
      modalShell('Linha evolutiva salva',msg,
        `<div class="modal-body chain-result"><div class="chain-info"><strong>✓ Linha vinculada</strong>
        ${shouldPublish?'As etapas publicadas já estão disponíveis na Pokédex pública.':'Os Pokémon já estão no seu banco GM; a publicação é feita quando você decidir.'}</div>
        ${snapshot.map((e,i)=>`<div class="chain-done"><span class="chain-counter">${i+1}</span>
          <b>${safe(e.name||byId(app.items,e.id)?.name||'Pokémon')}</b>
          <span class="badge ${publishedIds.includes(e.id)?'published':'draft'}">${publishedIds.includes(e.id)?'Publicado':'Salvo'}</span>
          <button class="btn btn-outline btn-sm" data-action="chainEditStage" data-id="${safe(e.id)}">Editar</button></div>`).join('')}
        ${publishErrors.length?`<div class="chain-error">Publicação parcial. Corrija e publique individualmente:<br>${publishErrors.map(e=>safe(e)).join('<br>')}</div>`:''}
        <p class="chain-footnote">O GM pode adicionar novas evoluções usando o botão "Continuar esta linha" nos detalhes de um estágio.</p>
        </div>`,`<button class="btn btn-outline" data-action="closeModal">Fechar</button>`);
      document.getElementById('modal').dataset.kind='chain-result';
      toast(msg,publishErrors.length?'warning':'success');
    }catch(err){toast('Não foi possível salvar a linha: '+(err.message||err),'error');
      if(btn){btn.disabled=false;btn.textContent='Tentar salvar novamente';}
    }finally{if(wizard)wizard.saving=false;}
  }
  function renderDrawer(item,form=false){
    const s=form?byId(visible(),item.speciesId):item;
    if(!s)return;
    const all=visible();
    let members=s.evolution?.chainId?all.filter(x=>x.evolution?.chainId===s.evolution.chainId):[];
    members=members.sort((a,b)=>(Number(a.evolution?.stage)||0)-(Number(b.evolution?.stage)||0));
    const target=document.querySelector('#drawer .drawer-content');
    if(!target)return;
    document.getElementById('chainDrawerSection')?.remove();
    const old=s.evolution||{};
    if(members.length===0 && !old.previous && !old.next && !isEditable())return;
    const markup=members.length?
      `<div class="chain-drawer-scroll">${members.map((m,i)=>`
        <button class="chain-drawer-card ${m.id===s.id?'chain-current':''}" data-action="detail" data-id="${safe(m.id)}" data-is-form="0">
          <span class="chain-drawer-image">${artTag(m)}</span>
          <span><b>${safe(m.name)}</b><small>${safe(m.type1)}${m.type2?' / '+safe(m.type2):''}</small>
          ${i&&m.evolution?.requirements?`<small class="chain-evo-req">${safe(m.evolution.requirements)}</small>`:''}</span>
        </button>${i<members.length-1?'<span class="chain-drawer-arrow">·</span>':''}`).join('')}</div>`:
      `<div class="drawer-list">${old.previous?`Anterior: ${safe(old.previous)}<br>`:''}${old.next?`Próxima: ${safe(old.next)}`:''}</div>`;
    const box=document.createElement('section');box.id='chainDrawerSection';box.className='chain-drawer-section';
    box.innerHTML=`<h3 class="subheading">⤳ LINHA EVOLUTIVA</h3>${markup}
       ${isEditable()?`<button class="btn btn-outline btn-sm" data-action="chainFromDetail" data-id="${safe(s.id)}">＋ ${members.length?'Continuar esta linha':'Criar evolução a partir deste Pokémon'}</button>`:''}`;
    target.appendChild(box);
    if(isEditable())box.insertAdjacentHTML('beforeend',`<button class="btn btn-good btn-sm" data-action="chainSplit" data-id="${safe(s.id)}" style="margin-top:10px">＋ Adicionar evolução alternativa existente</button>`);
    hydrateArt(box);
  }

  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-action]');
    if(!el||!ACTIONS.has(el.dataset.action))return;
    event.preventDefault();event.stopImmediatePropagation();
    const index=Number(el.dataset.index),act=el.dataset.action;
    if(act==='chainWizard')openWizard();
    else if(act==='chainFromDetail')openWizard(el.dataset.id);
    else if(act==='chainFromEditor')openWizard(app.editor?.model?.id);
    else if(act==='chainAdd' && wizard && wizard.rows.length<8){wizard.rows.push(newStage());wizard.dirty=true;drawWizard();}
    else if(act==='chainRemove' && wizard && wizard.rows.length>2){wizard.rows.splice(index,1);wizard.dirty=true;drawWizard();}
    else if(act==='chainUp')swap(index,index-1);
    else if(act==='chainDown')swap(index,index+1);
    else if(act==='chainSave')saveChain();
    else if(act==='chainEditStage'){closeModal(true);openEditor(el.dataset.id);}
  },true);
  document.addEventListener('input',event=>{
    if(!wizard||document.getElementById('modal')?.dataset.kind!=='chain-wizard')return;
    const el=event.target;
    if(el.dataset.chainFilter!=null){
      const select=document.getElementById('chainExisting'+el.dataset.chainFilter);if(!select)return;
      const q=el.value.trim().toLowerCase();
      for(const option of select.options)option.hidden=!!q&&!option.textContent.toLowerCase().includes(q);
      return;
    }
    const i=el.dataset.chainIndex;
    if(i==null)return;
    const r=wizard.rows[+i];if(!r)return;
    if(el.dataset.chainStat){r.baseStats[el.dataset.chainStat]=el.value;
      const bst=document.querySelector(`[data-chain-bst="${i}"]`);
      if(bst)bst.textContent='BST '+STATS.reduce((sum,[k])=>sum+(Number(r.baseStats[k])||0),0);
    }else if(el.dataset.chainField){
      const field=el.dataset.chainField;
      if(field==='mode'||field==='existingId')return;
      r[field]=el.value;
      if(field==='slug')r.slugEdited=true;
      if(field==='name'&&!r.slugEdited){r.slug=slug(el.value);
        const input=document.querySelector(`[data-chain-index="${i}"][data-chain-field="slug"]`);
        if(input)input.value=r.slug;}
    }
    wizard.dirty=true;preview();
  });
  document.addEventListener('change',event=>{
    if(!wizard||document.getElementById('modal')?.dataset.kind!=='chain-wizard')return;
    const el=event.target;
    if(el.id==='chainPublishAll'){wizard.publish=el.checked;return;}
    const i=el.dataset.chainIndex;if(i==null)return;
    if(el.dataset.chainField==='mode')setMode(+i,el.value);
    else if(el.dataset.chainField==='existingId')setExisting(+i,el.value);
  });
  if(!document.getElementById('evolutionChainStyles')){
    const style=document.createElement('style');style.id='evolutionChainStyles';
    style.textContent=`
      .chain-modal{max-width:1080px}.chain-body{padding-bottom:28px}.section-actions{flex-wrap:wrap}
      .chain-edit-link{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:16px;background:#18372f;border:1px solid #346759;border-radius:10px;margin-bottom:18px}.chain-edit-link b{color:#91eabb}.chain-edit-link span{color:#b6cddd;font-size:12px}
      .chain-info{border:1px solid #346759;border-radius:12px;background:#18372f;padding:17px 20px;line-height:1.65;color:#d6f3e9}
      .chain-info strong{display:block;font-weight:800;font-size:14px;margin-bottom:5px;color:#8ce8b9}
      .chain-preview{display:flex;gap:8px;align-items:center;overflow-x:auto;padding:17px 0 22px;scrollbar-width:thin}
      .chain-preview-pill{display:flex;flex-direction:column;flex:0 0 auto;max-width:205px;min-width:115px;
        border:1px solid #435769;background:#162231;border-radius:10px;padding:12px}
      .chain-preview-pill b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .chain-preview-pill small{color:#9eb2c3;font-size:10px;margin-top:5px;line-height:1.45}
      .chain-preview-arrow{color:#52d6a5;font-size:24px;flex:0 0 auto}
      .chain-stage{border:1px solid #405367;background:#192637;border-radius:13px;padding:20px;margin:0 0 16px}
      .chain-stage-top,.chain-stage-top>div,.chain-stage-top nav{display:flex;align-items:center;gap:10px}
      .chain-stage-top{justify-content:space-between;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid #2b4054}
      .chain-stage-top b{font-size:15px}.chain-counter{display:inline-grid;place-items:center;flex:0 0 28px;
        height:28px;width:28px;border-radius:50%;background:#2c685b;color:#c0ffdf;font-weight:900}
      .chain-mini{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:7px;
        background:#233449;border:1px solid #39526b;color:#eaf5ff;cursor:pointer}
      .chain-mini:hover:not(:disabled){border-color:#89d7b6;background:#345667}
      .chain-mini:disabled{opacity:.3;cursor:not-allowed}.chain-danger{color:#ff9ca6}
      .chain-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 16px;padding-top:18px}
      .chain-field{display:flex;flex-direction:column;gap:7px;min-width:0;color:#bdccdc;font-weight:700;font-size:12px}
      .chain-field input,.chain-field select{width:100%;min-width:0;background:#13202e;border:1px solid #40516a;
        border-radius:9px;color:#f2f6fa;padding:11px 13px;min-height:43px}
      .chain-field input:focus,.chain-field select:focus{border-color:#67d5ab;outline:2px solid #67d5ab30}
      .chain-field input[type=search]{min-height:36px}.chain-field select option{background:#13202e}
      .chain-note{grid-column:1/-1;color:#b5ceda;background:#213344;padding:11px;border-radius:9px;font-size:12px}
      .chain-stats-title{grid-column:1/-1;color:#9cb4cc;display:flex;justify-content:space-between;
        font-size:11px;font-weight:800;letter-spacing:1px;padding-top:5px}
      .chain-stats-title b{color:#7ee3b3}.chain-stats{grid-column:1/-1;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}
      .chain-stat{display:flex;flex-direction:column;gap:7px;min-width:0;font-size:11px;color:#adc1d3;font-weight:700}
      .chain-stat input{width:100%;min-width:0;text-align:center;font-size:15px;font-weight:800;
        padding:11px 4px;color:#f3f9ff;background:#13202e;border:1px solid #3a5064;border-radius:8px}
      .chain-full{grid-column:1/-1}.chain-base-tag{font-size:10px;color:#77c7a6;font-weight:800;letter-spacing:1px;margin-top:15px}
      .chain-method{display:flex;gap:12px;border-top:1px solid #344b60;margin-top:17px;padding-top:15px;align-items:center}
      .chain-method-symbol{display:grid;place-items:center;color:#76e0b7;background:#244b47;width:30px;height:30px;border-radius:50%;flex:0 0 30px}
      .chain-method-fields{display:flex;gap:12px;flex:1;min-width:0;align-items:end}.chain-method-fields .chain-field{flex:1}
      .chain-method-fields .chain-level{flex:0 0 135px}.chain-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px}
      .chain-toolbar span{font-size:11px;color:#92aabd}.chain-publish-choice{display:flex;gap:12px;padding:17px;
        border:1px solid #3c5a50;border-radius:12px;margin:22px 0 8px;background:#1b302f;cursor:pointer}
      .chain-publish-choice input{width:20px;height:20px;flex:0 0 20px;accent-color:#6ce3ad}
      .chain-publish-choice span{display:flex;flex-direction:column;gap:6px}.chain-publish-choice small{font-weight:400;color:#adbfcd;line-height:1.5}
      .chain-footnote,.chain-foot-help{color:#9bacbe;font-size:11px;line-height:1.6}.chain-foot-help{margin-right:auto}
      .chain-result{display:flex;flex-direction:column;gap:10px}.chain-done{display:flex;align-items:center;gap:12px;
        background:#1c2c3a;border:1px solid #3b4e5f;border-radius:10px;padding:11px 14px}
      .chain-done b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis}.chain-error{padding:14px;color:#ffbec5;
        background:#442b35;border:1px solid #9b5561;border-radius:9px;line-height:1.6}
      .chain-drawer-section{margin-top:24px;border-top:1px solid #344559;padding-top:22px}
      .chain-drawer-section>.btn{margin-top:15px}.chain-drawer-scroll{display:flex;gap:7px;overflow-x:auto;
        align-items:stretch;padding:7px 0 10px}
      .chain-drawer-card{display:flex;flex-direction:column;align-items:center;gap:6px;min-width:112px;width:132px;
        flex:0 0 132px;border:1px solid #3e5267;background:#192738;border-radius:11px;padding:10px 8px;
        color:#e6f5f5;cursor:pointer;text-align:center}.chain-drawer-card:hover,.chain-current{border-color:#75d6b1;background:#224039}
      .chain-drawer-image{display:flex;align-items:center;justify-content:center;width:75px;height:75px}
      .chain-drawer-image img{height:75px;width:75px;object-fit:contain}
      .chain-drawer-card b{display:block;font-size:12px}.chain-drawer-card small{display:block;font-size:10px;color:#b0c4d2;margin-top:5px}
      .chain-drawer-card .chain-evo-req{color:#9ee8b8}.chain-drawer-arrow{align-self:center;font-size:18px;color:#81e1b8}
      @media(max-width:760px){.chain-grid{grid-template-columns:1fr}.chain-method-fields{flex-direction:column;align-items:stretch}
      .chain-method-fields .chain-level{flex:auto}.chain-stats{grid-template-columns:repeat(3,minmax(0,1fr))}
      .chain-stage{padding:14px}.chain-foot-help{display:none}.chain-preview-pill{min-width:110px}.chain-drawer-card{min-width:100px;flex-basis:100px}}
    `;
    document.head.append(style);
  }

  // V5.0: ramificações entre espécies já cadastradas, sem recriar suas fichas.
  let splitParent=null;
  function openSplit(id){
    if(!isEditable())return toast('Entre como GM para vincular evoluções.','warning');
    const parent=byId(app.items,id);
    if(!parent)return toast('Selecione um Pokémon cadastrado.','warning');
    splitParent=parent.id;
    const candidates=gmItems().filter(s=>s.id!==id).sort((a,b)=>a.name.localeCompare(b.name));
    modalShell('Adicionar evolução alternativa', 'Vincule Pokémon já cadastrados, oficiais, reworks ou Fakemon. Nenhuma ficha será duplicada.',
      `<div class="modal-body"><div class="chain-info"><strong>${safe(parent.name)} → ?</strong>Selecione uma evolução para criar uma nova ramificação. As evoluções anteriores serão mantidas.</div>
      <div class="field-grid" style="margin-top:20px">
      <label class="field">Buscar Pokémon existente<input id="splitSearch" type="search" placeholder="Ex.: Pupitar de Elysium" autocomplete="off"></label>
      <label class="field">Evolução<select id="splitChild">${candidates.map(s=>`<option value="${safe(s.id)}">${safe(s.name)} · ${safe(s.classification)}</option>`).join('')}</select></label>
      <label class="field">Método / condição<input id="splitRequirement" placeholder="Ex.: Nível 30"></label>
      <label class="field">Nível (opcional)<input id="splitLevel" type="number" min="1" max="999" placeholder="30"></label></div>
      <p class="chain-footnote">A alteração será salva como rascunho. Publique os Pokémon alterados depois para atualizar a Pokédex dos jogadores.</p></div>`,
      '<button class="btn btn-outline" data-action="closeModal">Cancelar</button><button class="btn btn-primary" data-action="chainSplitSave" id="splitSaveButton">Vincular evolução</button>');
    document.getElementById('modal').dataset.kind='chain-split';
    document.getElementById('splitSearch').addEventListener('input',e=>{
      const q=e.target.value.trim().toLocaleLowerCase();
      const select=document.getElementById('splitChild');
      select.innerHTML=candidates.filter(s=>(s.name+' '+s.slug).toLocaleLowerCase().includes(q))
        .map(s=>`<option value="${safe(s.id)}">${safe(s.name)} · ${safe(s.classification)}</option>`).join('');
    });
  }
  async function saveSplit(){
    const parent=byId(app.items,splitParent);
    const child=byId(app.items,document.getElementById('splitChild')?.value);
    const requirement=clean(document.getElementById('splitRequirement')?.value);
    const level=clean(document.getElementById('splitLevel')?.value);
    if(!parent||!child||parent.id===child.id)return toast('Selecione dois Pokémon diferentes.','error');
    if(level&&(!/^\\d{1,3}$/.test(level)||+level<1||+level>999))return toast('Nível inválido.','error');
    if(!requirement&&!level)return toast('Informe o método ou nível de evolução.','error');
    if((parent.evolution?.nextIds||[]).includes(child.id))return toast('Esta evolução já está vinculada.','warning');
    if(child.evolution?.previousId&&child.evolution.previousId!==parent.id)return toast('Esta espécie já tem outra pré-evolução. Edite primeiro o vínculo existente.','warning');
    if(parent.evolution?.previousId===child.id)return toast('Não é possível criar um ciclo evolutivo.','error');
    const pc=parent.evolution?.chainId,cc=child.evolution?.chainId;
    if(pc&&cc&&pc!==cc)return toast('Estas espécies pertencem a linhas diferentes. Una ou remova o vínculo anterior antes.','warning');
    const cid=pc||cc||crypto.randomUUID();
    const pe={...parent.evolution,chainId:cid,stage:Number(parent.evolution?.stage)||0,
      nextIds:[...new Set([...(parent.evolution?.nextIds||[]),child.id])],
      next:[...new Set([parent.evolution?.next,child.name].filter(Boolean))].join(' / ')};
    const ce={...child.evolution,chainId:cid,stage:(Number(parent.evolution?.stage)||0)+1,
      previousId:parent.id,previous:parent.name,requirements:requirement||'Nível '+level,level};
    const btn=document.getElementById('splitSaveButton');if(btn){btn.disabled=true;btn.textContent='Vinculando…';}
    try{
      if(app.mode==='demo'){
        for(const [item,evo] of [[parent,pe],[child,ce]]){
          item.evolution=evo;item.revision=(item.revision||1)+1;
          item.updatedAt=new Date().toISOString();
        }
        await demoPersist();
      }else{
        // Both writes use revision guards to avoid overwriting concurrent GM edits.
        const p=await app.client.from('pokedex_species').update({evolution:pe})
          .eq('id',parent.id).eq('revision',parent.revision).select('id').maybeSingle();
        if(p.error)throw p.error;
        if(!p.data)throw Error('A pré-evolução foi modificada em outra sessão. Atualize a página.');
        const c=await app.client.from('pokedex_species').update({evolution:ce})
          .eq('id',child.id).eq('revision',child.revision).select('id').maybeSingle();
        if(c.error||!c.data){
          // Roll back only if the parent still has the evolution written by this operation.
          const rollback=await app.client.from('pokedex_species').update({evolution:parent.evolution||{}})
            .eq('id',parent.id).contains('evolution',{chainId:cid,nextIds:pe.nextIds});
          if(rollback.error)console.warn('Reversão manual pode ser necessária',rollback.error);
          throw c.error||Error('A evolução foi alterada em outra sessão.');
        }
        await loadCatalog();
      }
      closeModal(true);render();toast('Evolução alternativa vinculada. Publique as fichas alteradas quando estiverem prontas.','success');
    }catch(e){toast('Erro ao vincular: '+(e.message||e),'error');}
    finally{if(btn&&document.contains(btn)){btn.disabled=false;btn.textContent='Vincular evolução';}}
  }
  document.addEventListener('click',event=>{
    const el=event.target.closest('[data-action]');
    if(!el||!['chainSplit','chainSplitSave'].includes(el.dataset.action))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(el.dataset.action==='chainSplit')openSplit(el.dataset.id);
    else saveSplit();
  },true);
  addButtons();
  window.POKEDEX_EVOLUTION={renderDrawer};
};