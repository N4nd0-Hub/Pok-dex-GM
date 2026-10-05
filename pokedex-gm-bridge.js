/* Pokémon Heaven & Hell V5.0 — ponte de leitura Pokédex GM para ficha PC e Mobile.
   Apenas registros PUBLICADOS. Nenhuma credencial privada, escrita remota ou alteração automática de personagens. */
(function () {
  'use strict';
  if (window.HH_GM_CATALOG_BRIDGE) return;
  var API = 'https://eoteckuikfmhfmkbbndc.supabase.co/rest/v1/';
  var PUBLIC_KEY = 'sb_publishable_a7zlErG9omVgrP_W9MK-4w_yjvP3Qd8';
  var GM_SITE = 'https://n4nd0-hub.github.io/Pok-dex-GM/';
  var CACHE_DB = 'hh-pokedex-gm-bridge-v5';
  var cache = {species:[], forms:[], customMegas:[], savedAt:0};
  /* INDEPENDENT_CUSTOM_MEGA_V1 — Megas criadas sem duplicar a espécie oficial. */
  var catalog = [];
  var online = false;
  var busy = null;
  var mounted = false;
  var originalFind = null;
  var originalMegaModal = null;
  var originalLoadMegas = null;
  var lastError = '';

  function key(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function art(s) {
    if (!s || typeof s !== 'string') return '';
    try { var u = new URL(s); return u.protocol === 'https:' ? u.href : ''; }
    catch (err) { return ''; }
  }
  function stats(s) {
    var result = {};
    ['hp','atk','def','spa','spd','spe'].forEach(function(k) {
      var value = Number(s && s[k]);
      result[k] = Number.isFinite(value) ? Math.max(1,Math.min(999,Math.round(value))) : 1;
    });
    return result;
  }
  function abilities(raw) {
    return Array.isArray(raw) ? raw.filter(function(a){return a && a.name;}).map(function(a){
      return {name:String(a.name), description:String(a.text || a.description || '')};
    }) : [];
  }
  function learnLevel(s) {
    var match = String(s || '').match(/(?:lv\.?|level|nível)\s*(\d+)/i);
    return match ? Number(match[1]) : null;
  }
  function moves(raw) {
    return Array.isArray(raw) ? raw.filter(function(m){return m && m.name;}).map(function(m) {
      var accuracy = m.accuracy == null || m.accuracy === '' ? null : Number(m.accuracy);
      return {name:String(m.name),type:m.type || 'Normal',category:m.category || 'Status',
        power:Number(m.power || 0),accuracy:accuracy == null ? null : Math.max(1,Math.min(90,accuracy)),
        alwaysHits:accuracy == null,description:String(m.text || m.description || ''),
        learnLevel:learnLevel(m.learn),learnMethod:m.learn || '',
        source:'Pokédex GM',specialRules:m.specialRules || []};
    }) : [];
  }
  function adaptForm(record) {
    var d = record && (record.data || record);
    if (!d || !d.name) return null;
    var aa = abilities(d.abilities);
    return {id:String(d.id || record.form_id || ''),name:String(d.name),slug:d.slug || '',
      formType:String(d.kind || 'alternate').toLowerCase(),kind:String(d.kind || 'alternate').toLowerCase(),
      types:[d.type1 || 'Normal',d.type2 || ''].filter(Boolean),
      baseStats:stats(d.baseStats),ability:aa[0] || {name:'',description:''},
      abilities:aa,image:{dataUrl:art(d.artUrl || d.thumbUrl || '')},
      specialRules:d.specialRules ? [String(d.specialRules)] : [],
      revision:Number(record.revision || d.revision || 1)};
  }
  function adaptIndependentMega(record) {
    var d = record && (record.data || record);
    var form = adaptForm(record);
    if (!d || !form) return null;
    form.formType='mega';
    form.kind='mega';
    form.independentMega=true;
    form.parentPokeapiId=Number(d.parentPokeapiId || record.parent_pokeapi_id || 0) || null;
    form.parentName=String(d.parentName || record.parent_name || '');
    form.parentSlug=String(d.parentSlug || record.parent_slug || key(form.parentName));
    form.parentSpriteUrl=art(d.parentSpriteUrl || record.parent_sprite_url || '');
    return form;
  }
  function adaptSpecies(record, formRecords) {
    var d = record && (record.data || record);
    if (!d || !d.name || !d.baseStats) return null;
    var aa = abilities(d.abilities);
    var id = String(record.species_id || d.id || '');
    if (!id) return null;
    var fs = formRecords.filter(function(f){return String(f.species_id) === id;})
      .map(adaptForm).filter(Boolean);
    return {id:'gm-'+id, gmId:id,slug:d.slug || record.slug || '',name:String(d.name),
      dex:d.dex == null ? null : Number(d.dex),category:d.category || '',
      classification:d.classification || record.classification || 'fakemon',
      types:[d.type1 || record.type1 || 'Normal',d.type2 || record.type2 || ''].filter(Boolean),
      baseStats:stats(d.baseStats),ability:aa[0] || {name:'',description:''},abilities:aa,
      image:{dataUrl:art(d.coverUrl || d.thumbUrl || '')},moves:moves(d.moves),
      evolution:d.evolution || {},specialRules:d.specialRules ? [String(d.specialRules)] : [],
      forms:fs,revision:Number(record.revision || d.revision || 1),
      publishedAt:record.published_at || d.publishedAt || '',
      description:d.description || '',source:'Pokédex GM'};
  }
  function build(species, forms, customMegaRows) {
    if (!Array.isArray(species) || !Array.isArray(forms)) throw Error('Resposta inválida do banco.');
    var result = species.map(function(r){return adaptSpecies(r,forms);}).filter(Boolean);
    (Array.isArray(customMegaRows) ? customMegaRows : []).forEach(function(row){
      var form=adaptIndependentMega(row);
      if(!form || !form.parentPokeapiId) return;
      var parent=result.find(function(s){
        return Number(s.dex)===Number(form.parentPokeapiId)
          || key(s.slug)===key(form.parentSlug)
          || key(s.name)===key(form.parentName);
      });
      if(parent){
        if(!parent.forms.some(function(f){return String(f.id)===String(form.id);})) parent.forms.push(form);
        return;
      }
      result.push({
        id:'gm-pokeapi-'+form.parentPokeapiId,
        gmId:'pokeapi-'+form.parentPokeapiId,
        slug:form.parentSlug || key(form.parentName),
        name:form.parentName || ('Pokémon #'+form.parentPokeapiId),
        dex:form.parentPokeapiId,
        category:'Espécie oficial · base via PokéAPI',
        classification:'official',
        types:[],
        baseStats:{hp:0,atk:0,def:0,spa:0,spd:0,spe:0},
        ability:{name:'',description:''},abilities:[],
        image:{dataUrl:form.parentSpriteUrl},moves:[],evolution:{},specialRules:[],
        forms:[form],revision:form.revision,publishedAt:'',description:'',
        source:'Pokédex GM',megaOnly:true
      });
    });
    return result.sort(function(a,b){return a.name.localeCompare(b.name,'pt-BR');});
  }
  function readCache() {
    return new Promise(function(resolve) {
      if (!window.indexedDB) return resolve(null);
      try {
        var req = indexedDB.open(CACHE_DB,1);
        req.onupgradeneeded = function(){req.result.createObjectStore('catalog');};
        req.onerror = function(){resolve(null);};
        req.onsuccess = function(){
          var db = req.result, tx = db.transaction('catalog','readonly'), get = tx.objectStore('catalog').get('published');
          get.onsuccess = function(){resolve(get.result || null);db.close();};
          get.onerror = function(){resolve(null);db.close();};
        };
      } catch(err) {resolve(null);}
    });
  }
  function writeCache(value) {
    if (!window.indexedDB) return;
    try {
      var req = indexedDB.open(CACHE_DB,1);
      req.onupgradeneeded = function(){req.result.createObjectStore('catalog');};
      req.onsuccess = function(){
        var db = req.result, tx = db.transaction('catalog','readwrite');
        tx.objectStore('catalog').put(value,'published');
        tx.oncomplete = tx.onerror = function(){db.close();};
      };
    } catch(err) {console.warn('Cache Pokédex GM:',err);}
  }
  function request(table, offset) {
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function(){ctrl.abort();},11000) : null;
    var url = API+table+'?select=*&limit=500&offset='+offset;
    return fetch(url,{method:'GET',mode:'cors',cache:'no-store',
      headers:{apikey:PUBLIC_KEY,Accept:'application/json'},
      signal:ctrl ? ctrl.signal : undefined
    }).then(function(response) {
      if (!response.ok) throw Error('Supabase '+response.status+' ('+table+')');
      return response.json();
    }).finally(function(){if(timer) clearTimeout(timer);});
  }
  async function allRows(table) {
    var result = [];
    for (var offset=0;offset<10000;offset+=500) {
      var batch = await request(table,offset);
      if (!Array.isArray(batch)) throw Error('Resposta inesperada de '+table);
      result.push.apply(result,batch);
      if (batch.length<500) break;
    }
    return result;
  }
  function status(message) {
    var el=document.getElementById('hhGmDexStatus');
    if(el)el.textContent=message;
    document.querySelectorAll('[data-gm-count]').forEach(function(n){
      n.textContent = String(catalog.length);
    });
  }
  function notify(message) {
    if (typeof showToast==='function') showToast(message);
    else console.info(message);
  }
  async function refresh(force) {
    if (busy) return busy;
    if (!force && online) return catalog;
    status('Sincronizando espécies e Megas publicadas...');
    busy = (async function(){
      try {
        var data = await Promise.all([
          allRows('pokedex_public_species'),
          allRows('pokedex_public_forms'),
          allRows('pokedex_public_custom_megas')
        ]);
        var entries = build(data[0],data[1],data[2]);
        catalog = entries;
        online = true;
        lastError = '';
        cache = {species:data[0],forms:data[1],customMegas:data[2],savedAt:Date.now()};
        writeCache(cache);
        status(catalog.length+' espécie(s) publicadas • catálogo online');
        render();
        if(typeof current!=='undefined' && current){
          var activeMatch=catalog.find(currentMatch);
          if(activeMatch && activeMatch.forms.some(function(f){return f.formType==='mega';})){
            addMegas(activeMatch,true);
          }
        }
        return catalog;
      } catch(err) {
        lastError = err.message || 'Falha de conexão';
        online = false;
        status(catalog.length
          ? catalog.length+' em cache offline • '+lastError+' • registros podem estar desatualizados'
          : 'Banco indisponível: '+lastError);
        render();
        return catalog;
      } finally {busy=null;}
    })();
    return busy;
  }
  function findRemote(q) {
    var k=key(q);
    if(!k)return null;
    return catalog.find(function(s){
      if(s.megaOnly) return false;
      return [s.id,s.gmId,s.name,s.slug,s.dex==null?'':String(s.dex)]
        .some(function(a){return key(a)===k;});
    }) || null;
  }
  function currentMatch(species) {
    if (!species || typeof current==='undefined' || !current) return false;
    var api = current.apiData || {};
    var currentKeys = [current.name,api.speciesName,api.pokemonName,api.integratedSpeciesId,api.gmCatalogId]
      .map(key).filter(Boolean);
    var currentDex = Number(current.dex || api.pokemonId || 0);
    return [species.id,species.gmId,species.name,species.slug]
      .map(key).some(function(k){return currentKeys.indexOf(k)>=0;})
      || !!(species.dex && currentDex && Number(species.dex)===currentDex);
  }
  function addMegas(species,quiet) {
    if(!species || !currentMatch(species)) {
      if(!quiet) notify('Selecione primeiro um Pokémon correspondente à espécie.');
      return 0;
    }
    if (typeof ensurePage2Data!=='function' || typeof integratedFormToMega!=='function') return 0;
    ensurePage2Data(current);
    var gmForms=species.forms.filter(function(f){return f.formType==='mega';});
    var old=current.gimmicks.mega.customForms || [];
    var existing=old.filter(function(f){
      return !f.gmCatalogFormId ||
        (current.gimmicks.mega.active && current.gimmicks.mega.formName==='custom:'+f.id);
    });
    var mapped=gmForms.map(function(f){
      var form=integratedFormToMega(species,f);
      form.id='gm-mega-'+f.id;
      form.gmCatalogFormId=f.id;
      form.gmCatalogRevision=f.revision;
      form.source='Pokédex GM';
      return form;
    });
    mapped.forEach(function(f){
      if (!existing.some(function(e){return e.id===f.id;})) existing.push(f);
    });
    current.gimmicks.mega.customForms=existing;
    if(typeof renderCustomMegaOptions==='function') renderCustomMegaOptions();
    if(typeof saveState==='function') saveState();
    if(!quiet)notify(mapped.length+' Mega(s) registradas em Gimmicks.');
    return mapped.length;
  }
  function installHooks() {
    if (typeof findIntegratedCustomSpecies==='function') {
      originalFind = findIntegratedCustomSpecies;
      findIntegratedCustomSpecies = function(q){return findRemote(q) || originalFind(q);};
    }
    if (typeof openMegaGimmickModal==='function') {
      originalMegaModal=openMegaGimmickModal;
      openMegaGimmickModal=function() {
        /* MEGA_OPEN_REFRESH_V2
           Abre o modal imediatamente, mas sincroniza novamente o catálogo.
           Isso evita perder Megas criadas depois do cache local da ficha. */
        var args=arguments;
        var result=originalMegaModal.apply(this,args);
        var sync=function(){
          var match=catalog.find(currentMatch);
          if(match && match.forms.some(function(f){return f.formType==='mega';})){
            addMegas(match,true);
            if(typeof renderCustomMegaOptions==='function') renderCustomMegaOptions();
            var status=document.getElementById('megaGimmickStatus');
            var gmCount=match.forms.filter(function(f){return f.formType==='mega' && f.independentMega;}).length;
            if(status && gmCount){
              status.textContent=gmCount+' Mega(s) publicada(s) pela Pokédex GM sincronizada(s) com esta ficha.';
            }
          }
        };
        sync();
        Promise.resolve(refresh(true)).then(sync).catch(function(err){
          console.warn('Pokédex GM Mega sync:',err);
        });
        return result;
      };
    }
    if (typeof loadMegaOptions==='function') {
      originalLoadMegas=loadMegaOptions;
      loadMegaOptions=function(){
        var hasGmMega = !!(current && current.gimmicks && current.gimmicks.mega
          && current.gimmicks.mega.customForms.some(function(f){return f.gmCatalogFormId;}));
        if (hasGmMega && current.apiData && current.apiData.source==='IntegratedCustomSpecies') {
          var n=document.getElementById('megaGimmickStatus');
          var l=document.getElementById('megaOptionsList');
          if(n)n.textContent='Mega personalizada publicada pela Pokédex GM — selecione nas opções abaixo.';
          if(l)l.innerHTML='';
          return Promise.resolve();
        }
        var result = originalLoadMegas.apply(this,arguments);
        if(hasGmMega && result && typeof result.then==='function'){
          return result.then(function(value){
            if(typeof renderCustomMegaOptions==='function') renderCustomMegaOptions();
            return value;
          });
        }
        if(hasGmMega && typeof renderCustomMegaOptions==='function') renderCustomMegaOptions();
        return result;
      };
    }
  }
  function applySpecies(species, mode, formId) {
    if(!species || typeof applyIntegratedCustomSpecies!=='function')return;
    if(species.megaOnly){
      addMegas(species,false);
      return;
    }
    var selected=species, form=species.forms.find(function(f){return f.id===formId;});
    if(form && form.formType!=='mega') {
      selected=Object.assign({},species,{
        id:species.id+':'+form.id,name:form.name,types:form.types,baseStats:form.baseStats,
        ability:form.ability,image:form.image,forms:[],source:'Pokédex GM'
      });
    }
    if(mode==='current') {
      if(!window.confirm('Aplicar '+selected.name+' à ficha atual? Nível, Nature, itens e pontos investidos serão mantidos; dados de espécie e Ability serão atualizados.'))return;
    } else {
      if(typeof createBlankPokemon!=='function')return;
      createBlankPokemon();
    }
    try {
      applyIntegratedCustomSpecies(selected,{preserveInvested:mode==='current',syncCurrent:mode!=='current'});
      if(current && current.apiData) {
        current.apiData.gmCatalogId=species.gmId;
        current.apiData.gmCatalogRevision=species.revision;
        current.apiData.gmCatalogFormId=form ? form.id : '';
        current.apiData.source='IntegratedCustomSpecies';
      }
      if(typeof upsertSpeciesBank==='function' && typeof speciesTemplateFromPokemon==='function')
        upsertSpeciesBank(speciesTemplateFromPokemon(current));
      if(typeof saveState==='function')saveState();
      if(typeof setActiveSheetPage==='function')setActiveSheetPage('page1');
      document.getElementById('app')?.classList.remove('drawer-open');
      close();
    } catch(err) {notify('Falha ao importar: '+(err.message||err));console.error(err);}
  }
  function matchesFilters(s) {
    var input=document.getElementById('hhGmDexSearch');
    var filter=document.getElementById('hhGmDexFilter');
    var q=key(input && input.value);
    if (filter && filter.value!=='all' && s.classification!==filter.value)return false;
    if (!q)return true;
    return [s.name,s.slug,s.dex,s.classification].concat(s.forms.map(function(f){return f.name;}))
      .some(function(x){return key(x).includes(q);});
  }
  function render() {
    var list=document.getElementById('hhGmDexList');
    if(!list)return;
    var shown=catalog.filter(matchesFilters);
    if(!shown.length) {
      list.innerHTML='<div class="hh-gm-empty">'+(catalog.length
        ? 'Nenhum Pokémon corresponde à busca.'
        : online
          ? 'Nenhum Pokémon publicado ainda. Publique uma espécie na Pokédex GM.'
          : 'Sem registros locais. Conecte-se à internet ou sincronize o catálogo.')+'</div>';
      return;
    }
    list.innerHTML=shown.map(function(s){
      var bst=Object.values(s.baseStats).reduce(function(a,b){return a+Number(b||0);},0);
      var megaCount=s.forms.filter(function(f){return f.formType==='mega';}).length;
      var image=art(s.image.dataUrl);
      var topMeta=s.megaOnly?'oficial · Mega publicada':esc(s.classification)+' · BST '+bst;
      var subMeta=s.megaOnly
        ? 'Base oficial via PokéAPI'+(s.dex?' · #'+esc(s.dex):'')+(megaCount?' · '+megaCount+' Mega(s)':'')
        : esc(s.types.join(' / '))+(s.dex?' · #'+esc(s.dex):'')+' · Rev. '+s.revision+(megaCount?' · '+megaCount+' Mega(s)':'');
      return '<article class="hh-gm-entry">'+(image?'<img loading="lazy" src="'+esc(image)+'" alt="">':'<div class="hh-gm-placeholder">◓</div>')
        +'<div class="hh-gm-details"><div class="hh-gm-entry-top"><strong>'+esc(s.name)+'</strong><span>'+topMeta+'</span></div>'
        +'<div class="hh-gm-sub">'+subMeta+'</div>'
        +(!s.megaOnly&&s.ability.name?'<div class="hh-gm-sub">Ability: '+esc(s.ability.name)+'</div>':'')
        +'<div class="hh-gm-buttons">'
        +(s.megaOnly?'':('<button type="button" data-gm-create="'+esc(s.gmId)+'">＋ Nova ficha</button>'
        +'<button type="button" data-gm-apply="'+esc(s.gmId)+'">Aplicar à atual</button>'))
        +(megaCount&&currentMatch(s)?'<button type="button" data-gm-mega="'+esc(s.gmId)+'">Registrar Mega</button>':'')
        +'</div>'
        +(s.forms.length?'<div class="hh-gm-forms">'+s.forms.map(function(f){
          return '<div class="hh-gm-form"><span>'+esc(f.name)+' · '+esc(f.formType)+'</span>'
            +(f.formType==='mega'?'<span>Em Gimmicks</span>'
              :'<button type="button" data-gm-form="'+esc(s.gmId)+'" data-form-id="'+esc(f.id)+'">＋ Nova ficha</button>')
            +'</div>';
        }).join('')+'</div>':'')
        +'</div></article>';
    }).join('');
  }
  function close() {
    var modal=document.getElementById('hhGmDexModal');
    if(modal)modal.hidden=true;
  }
  function open() {
    var modal=document.getElementById('hhGmDexModal');
    if(!modal)return;
    modal.hidden=false;
    render();
    refresh(true);
    document.getElementById('hhGmDexSearch')?.focus();
  }
  function mount() {
    if(mounted)return;
    mounted=true;
    var css=document.createElement('style');
    css.id='hhGmDexCss';
    css.textContent=[
      '#hhGmDexModal[hidden]{display:none!important}',
      '#hhGmDexModal{position:fixed;inset:0;z-index:2147482000;background:#070e18e8;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;font-family:system-ui,sans-serif;color:#edf4fa}',
      '#hhGmDexModal *{box-sizing:border-box}',
      '.hh-gm-panel{width:min(940px,100%);max-height:min(92dvh,900px);background:#101b2b;border:1px solid #47617b;border-radius:17px;display:flex;flex-direction:column;box-shadow:0 20px 90px #000b;overflow:hidden}',
      '.hh-gm-header{padding:15px 20px;background:linear-gradient(90deg,#1d2a3e,#131c2b);border-bottom:1px solid #364960;display:flex;justify-content:space-between;gap:14px;align-items:center}',
      '.hh-gm-header b{font-size:20px;color:#f0f6ff}.hh-gm-header small{display:block;font-size:11px;color:#8fb6d0;margin-top:4px}',
      '.hh-gm-close{background:#26374a;border:1px solid #567088;color:white;border-radius:9px;padding:7px 13px;font-size:20px}',
      '.hh-gm-tools{padding:14px 18px;display:flex;gap:9px;flex-wrap:wrap;border-bottom:1px solid #34465a}',
      '.hh-gm-tools input,.hh-gm-tools select{min-height:39px;border:1px solid #4b6178;background:#091523;color:#eff7ff;padding:8px 12px;border-radius:9px;font-size:13px}',
      '.hh-gm-tools input{flex:1;min-width:160px}.hh-gm-tools button,.hh-gm-buttons button,.hh-gm-form button{background:#1d4360;color:#e6f7ff;border:1px solid #4b91b0;border-radius:9px;padding:8px 11px;font-size:12px;font-weight:700;cursor:pointer}',
      '.hh-gm-tools button:hover,.hh-gm-buttons button:hover,.hh-gm-form button:hover{background:#346b88}',
      '#hhGmDexStatus{padding:8px 19px;background:#172636;color:#a4ccde;font-size:11px}',
      '#hhGmDexList{padding:12px 17px;overflow:auto;overscroll-behavior:contain;display:grid;gap:12px}',
      '.hh-gm-entry{display:flex;align-items:flex-start;gap:15px;padding:12px;background:#162538;border:1px solid #304960;border-radius:13px}',
      '.hh-gm-entry>img,.hh-gm-placeholder{width:92px;height:92px;object-fit:contain;border-radius:11px;background:#213449;flex-shrink:0}',
      '.hh-gm-placeholder{display:grid;place-items:center;font-size:38px;color:#86a7bc}',
      '.hh-gm-details{min-width:0;flex:1}.hh-gm-entry-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}',
      '.hh-gm-entry-top strong{font-size:17px}.hh-gm-entry-top span,.hh-gm-sub{font-size:11px;color:#b1c5d8;line-height:1.7}',
      '.hh-gm-buttons{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0}.hh-gm-buttons [data-gm-create]{background:#236f60;border-color:#50b6a3}',
      '.hh-gm-forms{border-top:1px solid #35516a;padding-top:8px;margin-top:5px;display:grid;gap:5px}',
      '.hh-gm-form{display:flex;gap:9px;justify-content:space-between;align-items:center;font-size:11px;color:#cee2f3}',
      '.hh-gm-form span:last-child{color:#85b7a4}.hh-gm-empty{text-align:center;padding:60px 15px;color:#bacdda;font-size:13px}',
      '.hh-gm-footer{padding:10px 17px;border-top:1px solid #35485e;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:#8faac1;font-size:11px}',
      '.hh-gm-footer a{color:#7ed0ce}',
      '@media(max-width:600px){.hh-gm-entry>img,.hh-gm-placeholder{width:63px;height:63px}.hh-gm-entry{gap:9px;padding:9px}.hh-gm-entry-top strong{font-size:14px}.hh-gm-header b{font-size:16px}.hh-gm-header{padding:11px}.hh-gm-tools{padding:10px}.hh-gm-panel{max-height:96dvh}}'
    ].join('\n');
    document.head.appendChild(css);
    var overlay=document.createElement('div');
    overlay.id='hhGmDexModal';overlay.hidden=true;overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Catálogo Pokédex GM');
    overlay.innerHTML='<div class="hh-gm-panel">'
      +'<div class="hh-gm-header"><div><b>◓ Pokédex GM · Heaven & Hell</b><small>Fakemon, Reworks e Megas publicados · V5.0</small></div>'
      +'<button type="button" class="hh-gm-close" id="hhGmDexClose" aria-label="Fechar">×</button></div>'
      +'<div class="hh-gm-tools"><input id="hhGmDexSearch" placeholder="Buscar nome, Dex ou forma..." aria-label="Buscar Pokémon">'
      +'<select id="hhGmDexFilter" aria-label="Filtrar tipo"><option value="all">Todas as espécies</option><option value="fakemon">Fakemon</option><option value="rework">Reworks</option><option value="official">Oficiais</option></select>'
      +'<button type="button" id="hhGmDexRefresh">↻ Atualizar</button></div>'
      +'<div id="hhGmDexStatus" role="status">Carregando catálogo publicado...</div>'
      +'<div id="hhGmDexList"></div>'
      +'<div class="hh-gm-footer"><span>Rascunhos privados não são compartilhados. Fichas existentes não se atualizam sozinhas.</span>'
      +'<a href="'+GM_SITE+'" target="_blank" rel="noopener noreferrer">Abrir painel GM ↗</a></div></div>';
    document.body.appendChild(overlay);
    overlay.addEventListener('click',function(e){
      if(e.target===overlay)close();
      var btn=e.target.closest('button');
      if(!btn)return;
      var id=btn.getAttribute('data-gm-create') || btn.getAttribute('data-gm-apply')
        || btn.getAttribute('data-gm-form') || btn.getAttribute('data-gm-mega');
      if(!id)return;
      var species=catalog.find(function(s){return s.gmId===id;});
      if(!species)return;
      if(btn.hasAttribute('data-gm-mega'))addMegas(species,false);
      else applySpecies(species,btn.hasAttribute('data-gm-apply')?'current':'new',btn.getAttribute('data-form-id'));
    });
    document.getElementById('hhGmDexClose').addEventListener('click',close);
    document.getElementById('hhGmDexSearch').addEventListener('input',render);
    document.getElementById('hhGmDexFilter').addEventListener('change',render);
    document.getElementById('hhGmDexRefresh').addEventListener('click',function(){refresh(true);});
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape' && !overlay.hidden){close();e.stopPropagation();}
    });
    var top=document.getElementById('mobileToolsPanel');
    if(top){
      var button=document.createElement('button');
      button.type='button';button.className='btn';button.id='hhGmDexTopBtn';
      button.textContent='◓ Catálogo GM';button.title='Fakemon, reworks e Megas publicados';
      button.addEventListener('click',open);
      top.insertBefore(button,document.getElementById('newPokemonBtn') || null);
    }
    var registry=document.querySelector('.pokemon-registry-console');
    if(registry){
      var entry=document.createElement('button');
      entry.type='button';entry.className='btn';entry.id='hhGmDexRegistryBtn';
      entry.textContent='◓ Pokédex GM';entry.title='Buscar Pokémon publicados pela sua campanha';
      entry.style.cssText='margin:8px 0;max-width:100%;font-size:12px';
      entry.addEventListener('click',open);
      registry.appendChild(entry);
    }
  }
  async function start(){
    if(typeof applyIntegratedCustomSpecies!=='function'){
      console.warn('Pokédex GM: ficha V5.0 incompatível; integração não inicializada.');
      return;
    }
    installHooks();mount();
    var old=await readCache();
    if(old && Array.isArray(old.species) && Array.isArray(old.forms) && !online){
      try{cache=old;catalog=build(old.species,old.forms,old.customMegas||[]);status(catalog.length+' em cache offline • verificando atualizações...');render();}
      catch(err){console.warn('Cache GM inválido:',err);}
    }
    refresh(true);
  }
  window.HH_GM_CATALOG_BRIDGE={
    open:open,refresh:refresh,getCatalog:function(){return catalog.slice();},
    find:findRemote,registerMegas:addMegas,getStatus:function(){
      return {online:online,count:catalog.length,savedAt:cache.savedAt,lastError:lastError,
        independentMegas:Array.isArray(cache.customMegas)?cache.customMegas.length:0};
    },_adaptSpecies:adaptSpecies,_adaptForm:adaptForm,_adaptIndependentMega:adaptIndependentMega,_build:build
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
