/* Pokédex GM — Gerador de Move Pool por perfil.
   O GM escolhe o "perfil" do Pokémon (Atacante Especial, Tanque, Suporte…),
   e o gerador monta uma lista de golpes por nível + Treino/TM/Tutor com os
   tipos do Pokémon, golpes Normal e cobertura opcional. Os dados oficiais vêm
   de move-pool-data.js (PokéAPI); os textos em português são buscados pelo
   mesmo tradutor do editor (POKEDEX_MOVE_LOOKUP) ao aplicar.
   Exposto em window.POKEDEX_MOVE_PROFILES. */
(function(){
  'use strict';
  const DATA=window.POKEDEX_MOVE_POOL_DATA;
  if(!DATA)return;
  const ALL_TYPES=['Normal','Fire','Water','Electric','Grass','Ice','Fighting','Poison','Ground','Flying','Psychic','Bug','Rock','Ghost','Dragon','Dark','Steel','Fairy'];
  const F=Object.fromEntries(DATA.fields.map((k,i)=>[k,i]));
  const MOVES=DATA.moves.map(r=>({name:r[F.name],type:r[F.type],cat:r[F.cat],power:r[F.power],acc:r[F.acc],pri:r[F.pri],
    gen:r[F.gen],learners:r[F.learners],tm:r[F.tm],levelup:r[F.levelup],tags:new Set(r[F.tags])}));
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const key=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');

  /* ---------- Perfis ---------- */
  const PROFILES={
    physical:{label:'Atacante Físico',icon:'⚔',desc:'Golpes físicos fortes dos seus tipos, Swords Dance/Bulk Up e prioridade.',cats:['Physical'],atk:9,status:3,setups:['setup-atk'],utility:['priority','protect']},
    special:{label:'Atacante Especial',icon:'✦',desc:'Golpes especiais dos seus tipos, Nasty Plot/Calm Mind e cobertura especial.',cats:['Special'],atk:9,status:3,setups:['setup-spa'],utility:['protect','drain']},
    mixed:{label:'Misto',icon:'⚡',desc:'Metade físico, metade especial. Bom para Pokémon com Attack e Sp.Atk parecidos.',cats:['Physical','Special'],atk:10,status:2,setups:['setup-atk','setup-spa'],utility:['protect']},
    tank:{label:'Tanque',icon:'🛡',desc:'Poucos ataques, defesa (Harden, Iron Defense, Amnesia), cura e Protect.',cats:['auto'],atk:6,status:6,setups:['setup-def'],utility:['heal','protect','hazard','status']},
    support:{label:'Suporte',icon:'✚',desc:'Telas, cura, status (Thunder Wave, Will-O-Wisp), debuffs e troca.',cats:['auto'],atk:5,status:7,setups:[],utility:['screen','heal','status','debuff','pivot','util']},
    speed:{label:'Veloz',icon:'➶',desc:'Prioridade, U-Turn/Volt Switch, Agility/Dragon Dance e golpes de alto acerto.',cats:['auto'],atk:8,status:3,setups:['setup-spe'],utility:['priority','pivot']},
    trickster:{label:'Trapaceiro',icon:'☠',desc:'Status, armadilhas, hazards, debuffs e golpes com efeitos secundários.',cats:['auto'],atk:6,status:6,setups:[],utility:['status','trap','hazard','debuff','util']}
  };
  const TM_ONLY=new Set(['Protect','Detect','Endure','Toxic','Attract','Rest','Substitute','Sleep Talk','Facade','Helping Hand','Roar','Whirlwind']);
  const SIZES={compact:{label:'Compacto',lvl:12,tm:6},standard:{label:'Padrão',lvl:18,tm:10},full:{label:'Completo',lvl:26,tm:16}};

  /* ---------- Gerador ---------- */
  function rng(seed){let s=(seed>>>0)||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return ((s>>>0)%100000)/100000;};}
  function coverageTypes(types){
    const chart=DATA.chart;const resisted=new Map();
    for(const t of types)for(const d of ALL_TYPES){if((chart[t]?.[d]??100)<100)resisted.set(d,(resisted.get(d)||0)+1);}
    const score=ALL_TYPES.filter(t=>!types.includes(t)&&t!=='Normal').map(t=>[t,[...resisted.keys()].reduce((s,d)=>s+((chart[t]?.[d]??100)>100?1:0),0)]);
    return score.sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
  }
  function pickCategory(profile,stats){
    const p=PROFILES[profile];
    if(!p.cats.includes('auto'))return p.cats;
    const atk=Number(stats?.atk)||0,spa=Number(stats?.spa)||0;
    if(Math.abs(atk-spa)<=10)return ['Physical','Special'];
    return [atk>spa?'Physical':'Special'];
  }
  function generate(opts){
    const o={types:['Normal'],profile:'physical',size:'standard',includeNormal:true,coverage:2,maxLevel:60,stats:null,seed:1,...opts};
    const R=rng(o.seed);const jitter=()=>R()*0.35;
    const P=PROFILES[o.profile]||PROFILES.physical;const S=SIZES[o.size]||SIZES.standard;
    const types=[...new Set(o.types.filter(Boolean))];
    const cats=pickCategory(o.profile,o.stats);
    const setupFits=m=>!(m.tags.has('setup-atk')&&!m.tags.has('setup-spa')&&!cats.includes('Physical'))&&!(m.tags.has('setup-spa')&&!m.tags.has('setup-atk')&&!cats.includes('Special'));
    const used=new Set();const take=m=>{used.add(m.name);return m;};
    const pop=m=>Math.log2(2+m.learners)/10;
    // ataques STAB em degraus de poder
    const stabAttacks=MOVES.filter(m=>m.tags.has('atk')&&types.includes(m.type)&&cats.includes(m.cat)&&!m.tags.has('slow'));
    const tiers=[[0,45],[46,65],[66,85],[86,100],[101,200]];
    const attacks=[];
    const atkBudget=Math.round(S.lvl*P.atk/12);
    const perType=Math.max(2,Math.ceil(atkBudget*(o.includeNormal?0.75:1)/types.length));
    for(const t of types){
      const mine=stabAttacks.filter(m=>m.type===t);
      let picked=0;
      for(const [lo,hi] of tiers){
        if(picked>=perType)break;
        const c=mine.filter(m=>m.power>=lo&&m.power<=hi&&!used.has(m.name)).sort((a,b)=>(pop(b)+jitter())-(pop(a)+jitter()));
        if(c[0]){attacks.push(take(c[0]));picked++;}
      }
      // completa com variações se faltar
      for(const m of mine.filter(m=>!used.has(m.name)).sort((a,b)=>(pop(b)+jitter())-(pop(a)+jitter()))){if(picked>=perType)break;attacks.push(take(m));picked++;}
    }
    // Normal: golpe inicial fraco + 1–2 médios/fortes
    if(o.includeNormal){
      const normal=MOVES.filter(m=>m.type==='Normal'&&m.tags.has('atk')&&cats.includes(m.cat)&&!used.has(m.name)&&!m.tags.has('slow'));
      const starter=normal.filter(m=>m.power<=40&&m.power>0&&!m.tags.has('priority')).sort((a,b)=>b.levelup-a.levelup)[0];
      if(starter)attacks.push(take(starter));
      const mid=normal.filter(m=>m.power>=60&&m.power<=90&&!m.tags.has('multi')).sort((a,b)=>(pop(b)+jitter())-(pop(a)+jitter()));
      if(mid[0])attacks.push(take(mid[0]));
      if(S.lvl>=18){const strong=normal.filter(m=>m.power>=100&&!used.has(m.name)).sort((a,b)=>(pop(b)+jitter())-(pop(a)+jitter()));if(strong[0])attacks.push(take(strong[0]));}
    }
    // status de perfil
    const statusMoves=[];
    const want=(tag,n,filter=()=>true)=>{
      const c=MOVES.filter(m=>m.tags.has(tag)&&!used.has(m.name)&&!TM_ONLY.has(m.name)&&(types.includes(m.type)||m.type==='Normal'||tag==='status'||tag==='hazard'||tag==='screen'||tag==='pivot')&&filter(m))
        .sort((a,b)=>((types.includes(b.type)?0.6:0)+pop(b)+jitter())-((types.includes(a.type)?0.6:0)+pop(a)+jitter()));
      for(const m of c.slice(0,n))statusMoves.push(take(m));
    };
    // debuff inicial (Growl/Leer/Tail Whip…)
    want('debuff',1,m=>m.type==='Normal'||types.includes(m.type));
    for(const s of P.setups)want(s,1,m=>m.cat==='Status');
    let budget=Math.max(1,Math.round(S.lvl*P.status/12)-statusMoves.length);
    for(const u of P.utility){if(budget<=0)break;if(u==='protect')continue;const before=statusMoves.length+attacks.length;
      if(u==='priority'||u==='drain'){const c=MOVES.filter(m=>m.tags.has(u)&&m.tags.has('atk')&&cats.includes(m.cat)&&(types.includes(m.type)||m.type==='Normal')&&!used.has(m.name)).sort((a,b)=>pop(b)-pop(a));if(c[0])attacks.push(take(c[0]));}
      else want(u,u==='status'||u==='util'?2:1,m=>u!=='status'||m.cat==='Status');
      budget-=(statusMoves.length+attacks.length)-before;}
    // níveis: ordena por "força" e espalha de 1 até o nível máximo
    const weight=m=>m.cat==='Status'
      ?(m.tags.has('debuff')?5:m.tags.has('setup')?45:m.tags.has('heal')?55:m.tags.has('hazard')||m.tags.has('screen')?40:30)
      :Math.min(150,m.power||50)*(m.tags.has('multi')?1.6:1)*(m.type==='Normal'&&!types.includes('Normal')?0.82:1)+(m.tags.has('priority')?-25:0);
    const levelList=[...attacks,...statusMoves].sort((a,b)=>weight(a)-weight(b)).slice(0,Math.max(S.lvl,attacks.length+statusMoves.length));
    const maxLv=Math.max(10,Math.min(100,Number(o.maxLevel)||60));
    const n=levelList.length;const firstCount=Math.min(3,n);
    const learnset=levelList.map((m,i)=>{
      let lv=i<firstCount?1:Math.round(4+((i-firstCount)/Math.max(1,n-firstCount-1))*(maxLv-4));
      return {...m,learn:'Lv. '+Math.max(1,lv),level:lv};
    });
    // Treino/TM/Tutor: cobertura + utilidade comum
    const tmList=[];
    const cov=coverageTypes(types).slice(0,Math.max(0,o.coverage)*2);
    let covPicked=0;
    for(const t of cov){
      if(covPicked>=o.coverage)break;
      const c=MOVES.filter(m=>m.type===t&&m.tags.has('atk')&&cats.includes(m.cat)&&m.power>=70&&m.power<=110&&m.tm>=80&&!used.has(m.name)&&!m.tags.has('slow'))
        .sort((a,b)=>(pop(b)+jitter())-(pop(a)+jitter()));
      if(c[0]){tmList.push({...take(c[0]),coverage:true});covPicked++;}
    }
    for(const t of types){
      const c=MOVES.filter(m=>m.type===t&&m.tags.has('atk')&&cats.includes(m.cat)&&m.tm>=40&&!used.has(m.name)).sort((a,b)=>b.tm-a.tm);
      if(c[0])tmList.push(take(c[0]));
    }
    const common=['Protect','Rest','Substitute','Sleep Talk','Facade','Endure','Toxic','Attract'];
    for(const name of common){if(tmList.length>=S.tm)break;const m=MOVES.find(x=>x.name===name);if(m&&!used.has(m.name)&&(m.cat==='Status'||cats.includes(m.cat)))tmList.push(take(m));}
    for(const m of MOVES.filter(m=>(types.includes(m.type)||m.type==='Normal')&&m.tm>=150&&!used.has(m.name)&&(m.cat==='Status'?P.status>=4&&setupFits(m):cats.includes(m.cat))).sort((a,b)=>b.tm-a.tm)){
      if(tmList.length>=S.tm)break;tmList.push(take(m));
    }
    return {
      profile:o.profile,types,cats,
      levelUp:learnset,
      tm:tmList.map(m=>({...m,learn:'Training/TM/Tutor'}))
    };
  }

  /* ---------- Conversão para o formato do editor ---------- */
  function toEntry(m,lookup){
    const base={name:m.name,type:m.type,category:m.cat,learn:m.learn,power:m.power||0,
      accuracy:m.acc==null?null:Math.min(90,m.acc),accuracyCanonical:m.acc??null,text:''};
    return lookup?{...base,...lookup,learn:m.learn,name:lookup.name||m.name}:base;
  }
  async function resolve(moves,onProgress){
    const L=window.POKEDEX_MOVE_LOOKUP;const out=new Array(moves.length);let done=0;
    const queue=moves.map((m,i)=>[m,i]);
    async function worker(){while(queue.length){const [m,i]=queue.shift();let info=null;
      try{if(L)info=await L.lookup(m.name);}catch(e){}
      const e=toEntry(m,info);delete e.source;out[i]=e;done++;onProgress?.(done,moves.length);}}
    await Promise.all(Array.from({length:6},worker));
    return out;
  }

  /* ---------- Interface ---------- */
  let ui=null;
  let API={};
  function setup(api){API=api||{};}
  const typeOptions=(sel,empty)=>(empty?'<option value="">—</option>':'')+ALL_TYPES.map(t=>`<option ${t===sel?'selected':''}>${t}</option>`).join('');
  const TYPE_COLORS={Normal:'#a8a77a',Fire:'#ee8130',Water:'#6390f0',Electric:'#f7d02c',Grass:'#7ac74c',Ice:'#96d9d6',Fighting:'#c22e28',Poison:'#a33ea1',Ground:'#e2bf65',Flying:'#a98ff3',Psychic:'#f95587',Bug:'#a6b91a',Rock:'#b6a136',Ghost:'#735797',Dragon:'#6f35fc',Dark:'#705746',Steel:'#b7b7ce',Fairy:'#d685ad'};
  function moveChip(m,i,group){
    const tag=m.cat==='Status'?'STATUS':m.cat==='Physical'?'FÍS':'ESP';
    return `<label class="mp-move" style="--t:${TYPE_COLORS[m.type]||'#888'}"><input type="checkbox" data-mp-pick="${group}:${i}" checked>
      <span class="mp-lv">${group==='lv'?esc(m.learn.replace('Lv. ','Lv')):'TM'}</span><b>${esc(m.name)}</b>
      <span class="mp-type">${esc(m.type)}</span><small>${tag}${m.power?' · '+m.power:''}${m.coverage?' · cobertura':''}</small></label>`;
  }
  function draw(){
    if(!ui)return;
    const r=ui.result;
    const box=ui.el.querySelector('.mp-body');
    box.innerHTML=`
      <div class="mp-row">
        <label class="mp-field"><span>Tipo 1</span><select data-mp="type1">${typeOptions(ui.opts.types[0])}</select></label>
        <label class="mp-field"><span>Tipo 2</span><select data-mp="type2">${typeOptions(ui.opts.types[1]||'',true)}</select></label>
        <label class="mp-field"><span>Nível máx. do último golpe</span><input type="number" min="10" max="100" data-mp="maxLevel" value="${ui.opts.maxLevel}"></label>
      </div>
      <div class="mp-label">PERFIL DO POKÉMON</div>
      <div class="mp-profiles">${Object.entries(PROFILES).map(([k,p])=>`<button type="button" class="mp-profile${k===ui.opts.profile?' on':''}" data-mp-profile="${k}"><i>${p.icon}</i><b>${p.label}</b><small>${p.desc}</small></button>`).join('')}</div>
      <div class="mp-row mp-opts">
        <div class="mp-seg">${Object.entries(SIZES).map(([k,s])=>`<button type="button" class="${k===ui.opts.size?'on':''}" data-mp-size="${k}">${s.label}<small>${s.lvl} por nível · ${s.tm} TM</small></button>`).join('')}</div>
        <label class="mp-check"><input type="checkbox" data-mp="includeNormal" ${ui.opts.includeNormal?'checked':''}> Incluir golpes Normal</label>
        <label class="mp-field mp-cov"><span>Cobertura (outros tipos)</span><input type="range" min="0" max="4" data-mp="coverage" value="${ui.opts.coverage}"><b>${ui.opts.coverage}</b></label>
      </div>
      <div class="mp-preview-head"><b>Prévia · ${r.levelUp.length} por nível · ${r.tm.length} Treino/TM</b>
        <span>${r.cats.map(c=>c==='Physical'?'Físico':'Especial').join(' + ')}</span>
        <button type="button" class="btn btn-outline btn-sm" data-mp-act="reroll">🎲 Sortear de novo</button></div>
      <div class="mp-cols"><div><div class="mp-label">POR NÍVEL</div><div class="mp-list">${r.levelUp.map((m,i)=>moveChip(m,i,'lv')).join('')}</div></div>
      <div><div class="mp-label">TREINO / TM / TUTOR</div><div class="mp-list">${r.tm.map((m,i)=>moveChip(m,i,'tm')).join('')}</div></div></div>`;
  }
  function regen(){ui.result=generate(ui.opts);draw();}
  function open(options){
    close();
    const el=document.createElement('div');el.className='mp-shade';
    el.innerHTML=`<div class="mp-dialog" role="dialog" aria-modal="true" aria-labelledby="mpTitle">
      <header class="mp-head"><div><span class="eyebrow">POKÉDEX GM · MOVE POOL</span><h2 id="mpTitle">${esc(options.title||'Gerar Move Pool por perfil')}</h2>
      <p>${esc(options.subtitle||'Escolha o perfil e ajuste. Você pode desmarcar o que não quiser antes de aplicar.')}</p></div>
      <button type="button" class="btn btn-outline btn-sm" data-mp-act="close" aria-label="Fechar">✕</button></header>
      <div class="mp-body"></div>
      <footer class="mp-foot"><label class="mp-check"><input type="checkbox" data-mp="replace" ${options.replace?'checked':''}> Substituir os golpes atuais</label>
      <span class="mp-status" role="status"></span>
      <button type="button" class="btn btn-outline" data-mp-act="close">Cancelar</button>
      <button type="button" class="btn btn-primary" data-mp-act="apply">${esc(options.applyLabel||'Adicionar golpes')}</button></footer></div>`;
    document.body.appendChild(el);
    ui={el,options,opts:{types:options.types?.length?options.types:['Normal'],profile:options.profile||guessProfile(options.stats),size:'standard',includeNormal:true,coverage:2,maxLevel:options.maxLevel||60,stats:options.stats,seed:Date.now()%100000},replace:!!options.replace};
    regen();
    el.addEventListener('click',onClick);el.addEventListener('change',onChange);el.addEventListener('input',onInput);
    el.querySelector('[data-mp-act="apply"]').focus();
  }
  function guessProfile(stats){
    if(!stats)return 'physical';
    const {atk=0,spa=0,def=0,spd=0,spe=0}=stats;const top=Math.max(atk,spa,def,spd,spe);
    if(top===spe&&spe>=Math.max(atk,spa))return 'speed';
    if(top===def||top===spd)return (def+spd)/2>Math.max(atk,spa)+20?'tank':'mixed';
    if(Math.abs(atk-spa)<=10)return 'mixed';
    return atk>spa?'physical':'special';
  }
  function close(){if(ui){ui.el.remove();ui=null;}}
  function selected(){
    const r=ui.result;const pick=[...ui.el.querySelectorAll('[data-mp-pick]')].filter(i=>i.checked).map(i=>i.dataset.mpPick.split(':'));
    return pick.map(([g,i])=>(g==='lv'?r.levelUp:r.tm)[+i]).filter(Boolean);
  }
  async function onClick(e){
    const t=e.target;
    if(t===ui.el){close();return;}
    const prof=t.closest('[data-mp-profile]');if(prof){ui.opts.profile=prof.dataset.mpProfile;regen();return;}
    const size=t.closest('[data-mp-size]');if(size){ui.opts.size=size.dataset.mpSize;regen();return;}
    const act=t.closest('[data-mp-act]')?.dataset.mpAct;
    if(act==='close')close();
    else if(act==='reroll'){ui.opts.seed=(ui.opts.seed*7919+13)%1000003;regen();}
    else if(act==='apply'){
      const moves=selected();if(!moves.length)return;
      const btn=t.closest('button');btn.disabled=true;const status=ui.el.querySelector('.mp-status');
      const entries=await resolve(moves,(d,n)=>{status.textContent=`Traduzindo golpes… ${d}/${n}`;});
      const replace=ui.el.querySelector('[data-mp="replace"]').checked;
      try{await ui.options.onApply?.(entries,{replace,profile:ui.opts.profile,types:ui.result.types});}finally{close();}
    }
  }
  function onChange(e){
    const k=e.target.dataset.mp;if(!k)return;
    if(k==='type1')ui.opts.types=[e.target.value,ui.opts.types[1]].filter(Boolean);
    else if(k==='type2')ui.opts.types=[ui.opts.types[0],e.target.value].filter(Boolean);
    else if(k==='includeNormal')ui.opts.includeNormal=e.target.checked;
    else if(k==='maxLevel')ui.opts.maxLevel=Math.max(10,Math.min(100,+e.target.value||60));
    else if(k==='replace')return;
    regen();
  }
  function onInput(e){if(e.target.dataset.mp==='coverage'){ui.opts.coverage=+e.target.value;regen();}}
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ui){e.stopImmediatePropagation();close();}},true);

  /* ---------- Ligação com o editor de espécie ---------- */
  function mergeMoves(current,entries,replace){
    const list=replace?[]:[...(current||[])];
    const have=new Set(list.map(m=>key(m.name)));
    for(const e of entries)if(!have.has(key(e.name))){list.push(e);have.add(key(e.name));}
    const order=m=>/^Lv\.\s*(\d+)/.test(m.learn||'')?+RegExp.$1:999;
    return list.sort((a,b)=>order(a)-order(b));
  }
  function openForEditor(){
    const ed=API.app?.editor;if(!ed)return;
    const s=ed.model;
    open({types:[s.type1,s.type2].filter(Boolean),stats:s.baseStats,maxLevel:suggestMaxLevel(s),
      subtitle:`${s.name||'Novo Pokémon'} · ${[s.type1,s.type2].filter(Boolean).join(' / ')}`,
      onApply:(entries,{replace})=>{
        s.moves=mergeMoves(s.moves,entries,replace);
        API.editorDirty?.();
        (API.refreshEditor||API.renderEditor)?.();
        API.toast?.(`${entries.length} golpe(s) adicionados ao move pool.`,'success');
      }});
  }
  /* ---------- Copiar golpes para as evoluções ---------- */
  function laterStages(s){
    const items=API.app?.items||[];const out=[];const seen=new Set([s.id]);
    let queue=[...(s.evolution?.nextIds||[])];
    // também aceita linhas antigas ligadas só pelo nome
    if(!queue.length&&s.evolution?.next){const n=items.find(x=>x.name===s.evolution.next);if(n)queue.push(n.id);}
    if(!queue.length&&s.evolution?.chainId){
      const stage=Number(s.evolution.stage)||0;
      queue=items.filter(x=>x.evolution?.chainId===s.evolution.chainId&&(Number(x.evolution.stage)||0)>stage).map(x=>x.id);
    }
    while(queue.length){
      const id=queue.shift();if(seen.has(id))continue;seen.add(id);
      const x=items.find(i=>i.id===id);if(!x||x.status==='archived')continue;
      out.push(x);
      for(const n of x.evolution?.nextIds||[])queue.push(n);
      if(!(x.evolution?.nextIds||[]).length&&x.evolution?.next){const n=items.find(i=>i.name===x.evolution.next);if(n)queue.push(n.id);}
    }
    return out;
  }
  async function propagate(){
    const ed=API.app?.editor;if(!ed)return;
    const s=ed.model;const targets=laterStages(s);
    if(!targets.length){API.toast?.('Este Pokémon não tem evoluções ligadas a ele.','warning');return;}
    if(!(s.moves||[]).length){API.toast?.('Adicione golpes antes de copiar para as evoluções.','warning');return;}
    const editable=targets.filter(t=>!t.repository?.sourceOnly);
    const skipped=targets.filter(t=>t.repository?.sourceOnly);
    if(!editable.length){API.toast?.('As evoluções são mantidas por arquivos do Git e não podem ser alteradas aqui.','warning');return;}
    const names=editable.map(t=>t.name).join(', ');
    const replace=document.querySelector('[data-mp-copy-replace]')?.checked;
    if(!confirm(`Copiar ${s.moves.length} golpe(s) de ${s.name||'este Pokémon'} para ${names}?\n\n${replace?'Os golpes atuais das evoluções serão SUBSTITUÍDOS.':'Os golpes que elas já têm continuam; só entram os que faltam.'}`))return;
    const app=API.app;let ok=0;const errors=[];
    for(const t of editable){
      const moves=mergeMoves(replace?[]:t.moves,JSON.parse(JSON.stringify(s.moves)),false);
      try{
        if(app.mode==='demo'){
          const item=app.items.find(i=>i.id===t.id);item.moves=moves;item.revision=(item.revision||1)+1;item.updatedAt=new Date().toISOString();
          if(item.status==='published'&&t.revision===t.publishedRevision){item.publishedRevision=item.revision;app.published=app.published.filter(p=>p.id!==item.id).concat({...JSON.parse(JSON.stringify(item)),notes:''});}
        }else{
          const wasLive=t.status==='published'&&t.revision===t.publishedRevision;
          const res=await app.client.from('pokedex_species').update({moves}).eq('id',t.id).eq('revision',t.revision).select('id').maybeSingle();
          if(res.error)throw res.error;
          if(!res.data)throw Error('foi editado em outra sessão; atualize a Pokédex');
          if(wasLive){const pub=await app.client.rpc('pokedex_publish',{p_id:t.id});if(pub.error)throw Error('golpes salvos, mas não republicado: '+pub.error.message);}
        }
        ok++;
      }catch(e){errors.push(`${t.name}: ${e.message||e}`);}
    }
    if(app.mode==='demo')await API.demoPersist?.();else await API.loadCatalog?.();
    API.render?.();
    if(errors.length)API.toast?.(`Copiado para ${ok}; falhou: ${errors.join(' · ')}`,'error');
    else API.toast?.(`Golpes copiados para ${names}. Salve este Pokémon também para guardar a lista dele.${skipped.length?' (Ignorados por serem do Git: '+skipped.map(x=>x.name).join(', ')+')':''}`,'success');
    injectCopy(true);
  }
  function injectCopy(force){
    const ed=API.app?.editor;const cta=document.querySelector('#editorBody .mp-cta');
    if(!ed||!cta)return;
    const box=document.querySelector('#editorBody .mp-copy');
    const targets=laterStages(ed.model);
    if(!targets.length){box?.remove();return;}
    if(box&&!force)return;box?.remove();
    const names=targets.map(t=>t.name).join(', ');
    cta.insertAdjacentHTML('afterend',`<div class="mp-copy"><div><b>⤵ Mesmos golpes nas evoluções</b><small>Copia a lista de golpes deste Pokémon para <b>${esc(names)}</b>. Os que estiverem publicados são republicados.</small>
      <label class="mp-check"><input type="checkbox" data-mp-copy-replace> Substituir os golpes das evoluções (em vez de só adicionar os que faltam)</label></div>
      <button type="button" class="btn btn-outline" data-mp-copy>Copiar para ${targets.length>1?'as evoluções':esc(targets[0].name)}</button></div>`);
  }
  function suggestMaxLevel(s){
    const lv=Number(s?.evolution?.level)||0;
    return Math.max(50,Math.min(75,lv?lv+25:60));
  }
  function inject(){
    const add=document.querySelector('#editorBody [data-action="addMove"]');
    const section=add?.closest('.form-section')||add?.parentElement;
    if(add&&section&&!section.querySelector('[data-mp-open]')){
      const anchor=section.querySelector(':scope > p')||add;
      anchor.insertAdjacentHTML(anchor===add?'beforebegin':'afterend',`<div class="mp-cta"><div><b>✨ Gerar Move Pool por perfil</b><small>Escolha se ele é Atacante Especial, Tanque, Suporte… e receba golpes dos tipos dele, Normal e cobertura, já com níveis.</small></div><button type="button" class="btn btn-primary" data-mp-open>Gerar move pool</button></div>`);
      injectCopy();
    }
  }
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-mp-open]')){e.preventDefault();e.stopPropagation();openForEditor();}
    else if(e.target.closest('[data-mp-copy]')){e.preventDefault();e.stopPropagation();
      const b=e.target.closest('[data-mp-copy]');b.disabled=true;propagate().finally(()=>{b.disabled=false;});}
  },true);
  new MutationObserver(inject).observe(document.documentElement,{childList:true,subtree:true});

  window.POKEDEX_MOVE_PROFILES={setup,laterStages,propagate,PROFILES,SIZES,generate,resolve,open,close,mergeMoves,guessProfile};
})();
