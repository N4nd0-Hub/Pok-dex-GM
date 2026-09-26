/* Pokédex GM V5.0 — Adicionar Mega a uma espécie existente.
   Não grava nada antes de o GM confirmar Salvar ou Salvar & Publicar.
   Espécies oficiais ainda não cadastradas podem ser vinculadas pela PokéAPI. */
window.POKEDEX_MEGA_SETUP = function (api) {
  const {app, isEditable, modalShell, openEditor, newForm, renderEditor,
         editorDirty, toast, slug, esc, byId} = api;
  let officialResult = null;
  const actionNames = new Set(['megaWizard', 'megaSelectExisting', 'megaSearchOfficial', 'megaSelectOfficial']);
  const titleCase = text => String(text || '').split('-').map(w => w[0]?.toUpperCase() + w.slice(1)).join(' ');
  const baseQuery = () => document.getElementById('megaBaseSearch')?.value.trim() || '';

  function addButtons() {
    for (const [selector, label] of [
      ['.hero-buttons', '✦ Adicionar Mega a Pokémon existente'],
      ['.section-actions', '✦ Nova Mega de Pokémon existente']
    ]) {
      const container = document.querySelector(selector);
      if (container && !container.querySelector('[data-action="megaWizard"]')) {
        container.insertAdjacentHTML('beforeend',
          `<button class="btn btn-outline gm-only" data-action="megaWizard">${label}</button>`);
      }
    }
  }

  function existingMatches(query) {
    const q = slug(query);
    return (app.items || []).filter(s =>
      s.name.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')) ||
      s.slug?.includes(q) || (query && String(s.dex) === query)
    ).slice(0, 15);
  }

  function renderExisting(query) {
    const list = document.getElementById('megaExisting');
    if (!list) return;
    const items = query ? existingMatches(query) : (app.items || []).slice(0, 8);
    list.innerHTML = items.length ? items.map(s => {
      const n = (app.forms || []).filter(f => f.speciesId === s.id && f.status !== 'archived').length;
      return `<button class="mega-pick" data-action="megaSelectExisting" data-id="${esc(s.id)}">
        <span><b>${esc(s.name)}</b><small>${esc(s.classification)} · ${s.dex ? '#' + esc(s.dex) : esc(s.slug)} · ${n} forma(s)</small></span>
        <strong>＋ Mega</strong>
      </button>`;
    }).join('') : '<p class="mega-muted">Nenhuma espécie cadastrada corresponde à busca. Tente a PokéAPI abaixo.</p>';
  }

  function openWizard() {
    if (!isEditable()) return toast('Entre como GM e conecte-se à internet para adicionar Megas.', 'warning');
    officialResult = null;
    const body = `<div class="modal-body mega-wizard">
      <div class="info-strip"><b>Sem duplicar Pokémon:</b> escolha uma espécie que já está no seu banco GM ou busque um Pokémon oficial na PokéAPI. Se ele ainda não existir no banco GM, seus dados básicos serão preenchidos automaticamente, apenas como referência para sua nova Mega.</div>
      <div class="field full"><label>Nome ou número do Pokémon ORIGINAL</label>
        <input id="megaBaseSearch" type="search" placeholder="Ex.: Pidgeot, Sceptile ou 18" autocomplete="off" autofocus>
        <small class="mega-muted">Digite Pidgeot, não Mega Pidgeot Z. O nome da sua Mega será preenchido depois.</small>
      </div>
      <h3 class="subheading">Espécies já cadastradas no GM</h3>
      <div id="megaExisting" class="mega-results"></div>
      <h3 class="subheading">Espécie oficial ainda não cadastrada</h3>
      <button class="btn btn-outline btn-full" data-action="megaSearchOfficial" id="megaOfficialBtn">⌕ Buscar Pokémon na PokéAPI</button>
      <div id="megaRemoteResult" class="mega-results" aria-live="polite"></div>
    </div>`;
    modalShell('Adicionar Mega a Pokémon existente', 'Escolha a espécie base; você só precisará personalizar a nova forma.', body,
      `<button class="btn btn-outline" data-action="closeModal">Fechar</button>`);
    document.getElementById('modal').dataset.kind = 'mega-picker';
    renderExisting('');
    document.getElementById('megaBaseSearch')?.focus();
  }

  function attachForm(species) {
    const ed = app.editor;
    const f = newForm(ed);
    let name = `Mega ${species.name} Personalizada`;
    let code = slug(name);
    let n = 2;
    while (ed.forms.some(x => x.slug === code || slug(x.name) === code)) {
      name = `Mega ${species.name} Personalizada ${n++}`;
      code = slug(name);
    }
    f.name = name;
    f.slug = code;
    f.status = 'published'; // Visível somente depois de Salvar & Publicar.
    ed.forms.push(f);
    ed.tab = 'forms';
    editorDirty();
    renderEditor();
    toast(`Nova Mega vinculada a ${species.name}. Ajuste o nome, os Base Stats, a Ability e a arte; depois clique em Salvar & Publicar.`, 'success');
  }

  function useExisting(id) {
    const species = byId(app.items, id);
    if (!species) return toast('A espécie não está mais no catálogo. Atualize a página.', 'error');
    openEditor(id);
    if (app.editor) attachForm(species);
  }

  async function searchOfficial() {
    const query = baseQuery();
    const target = document.getElementById('megaRemoteResult');
    if (!target) return;
    if (!query || query.length < 2) {
      target.textContent = 'Informe o nome ou número do Pokémon original.';
      return;
    }
    officialResult = null;
    target.textContent = 'Consultando a PokéAPI…';
    const btn = document.getElementById('megaOfficialBtn');
    if (btn) btn.disabled = true;
    try {
      const fetchPokemon = async name => {
        const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name)}/`);
        if (!r.ok) throw Error(r.status === 404 ? 'Pokémon não encontrado. Confira o nome original.' : `PokéAPI indisponível (${r.status}).`);
        return r.json();
      };
      let p = await fetchPokemon(/^\d+$/.test(query) ? query : slug(query));
      if (p.species?.name && p.species.name !== p.name) p = await fetchPokemon(p.species.name);
      // Não exibir um resultado antigo se o GM já mudou a busca ou fechou a janela.
      if (query !== baseQuery() || !document.getElementById('megaRemoteResult')) return;
      if (!p.species?.name || !Number.isInteger(p.id) || !Array.isArray(p.stats) || p.stats.length < 6 || !Array.isArray(p.types)) {
        throw Error('Dados incompletos da PokéAPI.');
      }
      officialResult = p;
      const existing = (app.items || []).find(s => s.slug === slug(p.species.name) ||
        (s.classification === 'official' && s.dex === p.id));
      const pic = p.sprites?.other?.['official-artwork']?.front_default || p.sprites?.front_default || '';
      target.innerHTML = `<div class="mega-official">
        ${/^https:\/\//.test(pic) ? `<img alt="Pokémon oficial" src="${esc(pic)}">` : ''}
        <div><b>${esc(titleCase(p.species.name))} <small>#${esc(p.id)}</small></b>
          <small>${p.types.slice().sort((a,b)=>a.slot-b.slot).map(x=>esc(titleCase(x.type.name))).join(' / ')}</small>
          <small>${existing ? 'Já está no seu banco GM: a nova Mega será anexada ao registro existente.' : 'A espécie base será preenchida automaticamente e vinculada à sua Mega.'}</small>
        </div>
        <button class="btn btn-primary" data-action="megaSelectOfficial">＋ Criar Mega</button>
      </div>`;
    } catch (err) {
      if (document.getElementById('megaRemoteResult')) target.textContent = err.message || 'Falha ao consultar a PokéAPI.';
    } finally {
      const b = document.getElementById('megaOfficialBtn');
      if (b) b.disabled = false;
    }
  }

  function useOfficial() {
    const p = officialResult;
    if (!p) return toast('Pesquise primeiro a espécie original na PokéAPI.', 'warning');
    const existing = (app.items || []).find(s => s.slug === slug(p.species.name) ||
      (s.classification === 'official' && s.dex === p.id));
    if (existing) return useExisting(existing.id);
    openEditor();
    if (!app.editor) return;
    const s = app.editor.model;
    s.name = titleCase(p.species.name);
    s.slug = slug(p.species.name);
    s.dex = p.id;
    s.classification = 'official';
    s.type1 = titleCase(p.types.slice().sort((a,b)=>a.slot-b.slot)[0].type.name);
    s.type2 = p.types.length > 1 ? titleCase(p.types.slice().sort((a,b)=>a.slot-b.slot)[1].type.name) : '';
    const mapping = {hp:'hp', attack:'atk', defense:'def', 'special-attack':'spa', 'special-defense':'spd', speed:'spe'};
    s.baseStats = {hp:0, atk:0, def:0, spa:0, spd:0, spe:0};
    for (const entry of p.stats) if (mapping[entry.stat.name]) s.baseStats[mapping[entry.stat.name]] = entry.base_stat;
    s.abilities = (p.abilities || []).map(a => ({name:titleCase(a.ability.name), text:''}));
    s.notes = 'Espécie base oficial vinculada automaticamente pela PokéAPI para cadastro de formas personalizadas. Moves e efeitos de Abilities podem ser completados pelo GM.';
    // Uma única referência por slug; o registro só será gravado quando o GM salvar.
    attachForm(s);
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || !actionNames.has(button.dataset.action)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const act = button.dataset.action;
    if (act === 'megaWizard') openWizard();
    else if (act === 'megaSelectExisting') useExisting(button.dataset.id);
    else if (act === 'megaSearchOfficial') searchOfficial();
    else if (act === 'megaSelectOfficial') useOfficial();
  }, true);
  document.addEventListener('input', event => {
    if (event.target.id !== 'megaBaseSearch') return;
    officialResult = null;
    const remote = document.getElementById('megaRemoteResult');
    if (remote) remote.textContent = '';
    renderExisting(event.target.value.trim());
  });
  document.addEventListener('keydown', event => {
    if (event.target.id === 'megaBaseSearch' && event.key === 'Enter') {
      event.preventDefault();
      searchOfficial();
    }
  });
  if (!document.getElementById('megaPickerStyles')) {
    const style = document.createElement('style');
    style.id = 'megaPickerStyles';
    style.textContent = `
      .mega-wizard .field {margin: 13px 0 19px}
      .mega-wizard .field input {width: 100%;margin: 8px 0 5px}
      .mega-wizard .subheading {margin-top: 24px}
      .mega-results {display: grid;gap: 8px;margin: 10px 0 19px}
      .mega-muted {font-size: 12px;color: #95a9be;line-height: 1.6}
      .mega-pick {display: flex;justify-content: space-between;align-items: center;gap: 12px;width: 100%;
        padding: 14px 16px;border-radius: 10px;text-align: left;cursor: pointer;
        border: 1px solid #35495e;background: #152439;color: #f1f5fb}
      .mega-pick:hover {border-color: #55c7a1;background: #1c3343}
      .mega-pick b,.mega-official b {display: block;font-size: 14px}
      .mega-pick small,.mega-official small {display: block;margin-top: 5px;font-size: 11px;
        color: #a8bacb;line-height: 1.45}
      .mega-pick strong {color: #71ddb4;white-space: nowrap;font-size: 12px}
      .mega-official {display: flex;align-items: center;gap: 15px;border: 1px solid #317460;
        background: #15332e;border-radius: 12px;padding: 16px}
      .mega-official > img {width: 88px;height: 88px;object-fit: contain}
      .mega-official > div {flex: 1;min-width: 0}
      .mega-official > .btn {flex-shrink: 0}
      @media (max-width: 700px) {
        .mega-official {flex-wrap: wrap}
        .mega-official > .btn {width: 100%}
        .mega-pick {align-items: flex-start;flex-wrap: wrap}
      }`;
    document.head.append(style);
  }
  addButtons();
};