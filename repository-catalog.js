/* Catálogo público criado a partir dos arquivos da pasta pokemons/. */
(function(root,factory){
  const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.POKEDEX_REPOSITORY=api;
})(typeof globalThis==='object'?globalThis:this,function(){
  'use strict';
  const ownScript=typeof document!=='undefined'?document.currentScript?.src:'';
  const defaultBase=ownScript?new URL('.',ownScript).href:'https://n4nd0-hub.github.io/Pok-dex-GM/';
  const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  const copy=x=>JSON.parse(JSON.stringify(x));
  const storageKey=base=>'pokedex-repository-v1:'+base;
  const pending=new Map(),memory=new Map();
  function validate(data){
    if(data?.format!=='pokedex-repository-v1'||!Array.isArray(data.species)||!Array.isArray(data.forms))throw Error('Catálogo dos arquivos incompatível.');
    const ids=new Set(),slugs=new Set();
    for(const item of data.species){
      if(!item?.id||typeof item.slug!=='string'||typeof item.name!=='string'||!item.baseStats||!Array.isArray(item.abilities)||!Array.isArray(item.moves)||!['published','draft','archived'].includes(item.status))throw Error('Pokémon inválido no catálogo dos arquivos.');
      if(ids.has(item.id)||slugs.has(item.slug))throw Error('Pokémon duplicado nos arquivos.');ids.add(item.id);slugs.add(item.slug);
    }
    if(data.forms.some(f=>!f||!ids.has(f.speciesId)))throw Error('Forma sem Pokémon-base no catálogo dos arquivos.');
    return data;
  }
  function artURL(value,base){
    if(!value)return '';
    try{const u=new URL(value,base),site=new URL(base);return u.protocol==='https:'||u.protocol==='http:'&&u.origin===site.origin?u.href:'';}catch{return '';}
  }
  function resolved(data,base){
    const out=copy(validate(data));
    for(const s of out.species){s.coverUrl=artURL(s.coverUrl,base);s.thumbUrl=s.coverUrl;}
    for(const f of out.forms){f.artUrl=artURL(f.artUrl,base);f.thumbUrl=f.artUrl;}
    return out;
  }
  async function fetchCatalog(options={}){
    const base=new URL('./',options.baseUrl||defaultBase).href;
    if(pending.has(base))return pending.get(base);
    if(!options.force&&memory.has(base))return memory.get(base);
    const task=(async()=>{
      const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),12000);
      try{
        const response=await fetch(new URL('pokemons/catalogo.json',base).href,{cache:'no-cache',signal:ctrl.signal});
        if(!response.ok)throw Error('Não foi possível atualizar os Pokémon dos arquivos.');
        const data=resolved(await response.json(),base);memory.set(base,data);
        try{localStorage.setItem(storageKey(base),JSON.stringify(data));}catch{}
        return data;
      }catch(error){
        if(memory.has(base))return memory.get(base);
        try{const cached=JSON.parse(localStorage.getItem(storageKey(base))||'null');if(cached){const data=resolved(cached,base);memory.set(base,data);return data;}}catch{}
        throw error;
      }finally{clearTimeout(timer);pending.delete(base);}
    })();pending.set(base,task);return task;
  }
  function merge(existing,repository){
    const current=existing.filter(x=>!x.repository?.sourceOnly).map(row=>{const item=copy(row);delete item.repository;return item;});
    const ids=new Set(current.map(x=>x.id)),slugs=new Set(current.map(x=>x.slug));
    for(const row of repository){
      const persisted=current.find(x=>x.id===row.id);
      if(persisted){persisted.repository={...row.repository,sourceOnly:false};continue;}
      if(ids.has(row.id)||slugs.has(row.slug))continue;
      current.push(copy(row));ids.add(row.id);slugs.add(row.slug);
    }
    return current;
  }
  function mergeInto(app,data){
    const published=data.species.filter(s=>s.status==='published');
    app.published=merge(app.published||[],published);
    const publicIds=new Set(app.published.map(s=>s.id));
    const fromFiles=new Set(app.published.filter(s=>s.repository?.sourceOnly).map(s=>s.id));
    app.publicForms=merge(app.publicForms||[],data.forms.filter(f=>f.status==='published'&&publicIds.has(f.speciesId)&&fromFiles.has(f.speciesId)));
    if(app.gm){
      app.items=merge(app.items||[],data.species);
      const addedIds=new Set(app.items.filter(s=>s.repository?.sourceOnly).map(s=>s.id));
      app.forms=merge(app.forms||[],data.forms.filter(f=>addedIds.has(f.speciesId)));
    }
    return app;
  }
  function publicRows(data){
    const species=data.species.filter(s=>s.status==='published');
    const ids=new Set(species.map(s=>s.id));
    return {species:species.map(s=>({species_id:s.id,slug:s.slug,name:s.name,classification:s.classification,revision:s.revision,published_at:s.publishedAt,data:s})),
      forms:data.forms.filter(f=>f.status==='published'&&ids.has(f.speciesId)).map(f=>({form_id:f.id,species_id:f.speciesId,revision:f.revision,data:f}))};
  }
  function mergePublicRows(existing,repository){
    const species=existing.species.filter(s=>!s.data?.repository?.sourceOnly);
    const forms=existing.forms.filter(f=>!f.data?.repository?.sourceOnly);
    const ids=new Set(species.map(s=>s.species_id)),slugs=new Set(species.map(s=>s.slug||s.data?.slug));
    const extra=repository.species.filter(s=>!ids.has(s.species_id)&&!slugs.has(s.slug));
    const extraIds=new Set(extra.map(s=>s.species_id));
    return {species:species.concat(extra),forms:forms.concat(repository.forms.filter(f=>extraIds.has(f.species_id)))};
  }
  return {validate,resolved,fetchCatalog,merge,mergeInto,publicRows,mergePublicRows,normalize,defaultBase};
});
