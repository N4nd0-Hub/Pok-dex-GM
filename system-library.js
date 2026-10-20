/* Banco compartilhado pela Ficha Pokémon Heaven & Hell e pela Pokédex GM. */
(function () {
  'use strict';
  const SOURCE = 'https://n4nd0-hub.github.io/ficha-pokemon/';
  const CACHE = 'pokedex-gm-system-bank-v1';
  let bank = { abilities: [], moves: [], rules: [] };
  let status = 'loading', syncedAt = null, pending = null;

  const normalize = value => String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/armour/g, 'armor')
    .replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  function validate(data) {
    if (data?.schema !== 'heaven-and-hell-system-v1' || !data.revision)
      throw Error('Formato do banco da ficha incompatível.');
    for (const [kind, field] of [['abilities', 'name'], ['moves', 'name'], ['rules', 'id']]) {
      if (!Array.isArray(data[kind]) || !data[kind].length ||
          data[kind].some(row => !row || typeof row[field] !== 'string' || !row[field].trim()))
        throw Error('O banco da ficha está incompleto.');
    }
    if (data.abilities.some(row => typeof row.description !== 'string') ||
        data.moves.some(row => typeof row.description !== 'string' ||
          !['Physical', 'Special', 'Status'].includes(row.category) ||
          row.power != null && (!Number.isFinite(row.power) || row.power < 0 || row.power > 999) ||
          row.accuracy != null && (!Number.isFinite(row.accuracy) || row.accuracy < 0 || row.accuracy > 100)) ||
        data.rules.some(row => typeof row.title !== 'string' || typeof row.content !== 'string'))
      throw Error('O banco da ficha contém uma entrada incompatível.');
    return data;
  }

  function notify() { window.dispatchEvent(new CustomEvent('pokedex-system-update')); }
  function apply(data, nextStatus) {
    bank = validate(data);
    status = nextStatus;
    notify();
  }

  async function fetchBank(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { cache: 'no-cache', signal: controller.signal });
      if (!response.ok) throw Error('Não foi possível atualizar o banco da ficha.');
      return validate(await response.json());
    } finally { clearTimeout(timer); }
  }

  // Lê somente os arrays JSON da ficha. Nenhum script do HTML é executado.
  function extractArray(html, name) {
    const match = new RegExp('\\bconst\\s+' + name + '\\s*=\\s*(\\[)').exec(html);
    if (!match) throw Error('Banco não encontrado na ficha: ' + name);
    const start = match.index + match[0].length - 1;
    let depth = 0, quoted = false, escaped = false;
    for (let i = start; i < html.length; i++) {
      const char = html[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (char === '\\') escaped = true;
        else if (char === '"') quoted = false;
      } else if (char === '"') quoted = true;
      else if (char === '[') depth++;
      else if (char === ']' && --depth === 0) return JSON.parse(html.slice(start, i + 1));
    }
    throw Error('O banco da ficha está incompleto: ' + name);
  }

  async function fetchFromSheet() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      let tag = '';
      try {
        const head = await fetch(SOURCE, { method: 'HEAD', cache: 'no-cache', signal: controller.signal });
        if (head.ok) tag = head.headers?.get('etag') || '';
      } catch (error) { if (error.name === 'AbortError') throw error; }
      if (tag && bank.sourceETag === tag) return bank;
      const response = await fetch(SOURCE, { cache: 'no-cache', signal: controller.signal });
      if (!response.ok) throw Error('Não foi possível ler o banco da ficha.');
      const html = await response.text();
      return validate({
        schema: 'heaven-and-hell-system-v1', title: 'Ficha Pokémon · Heaven & Hell',
        sourceUrl: SOURCE, revision: tag || response.headers?.get('last-modified') || 'ficha-atual',
        sourceETag: tag || response.headers?.get('etag') || '',
        abilities: extractArray(html, 'CUSTOM_ABILITY_BANK'),
        moves: extractArray(html, 'CUSTOM_MOVE_BANK'),
        rules: extractArray(html, 'HHRPG_RULES')
      });
    } finally { clearTimeout(timer); }
  }

  const ready = (async () => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE) || 'null');
      if (cached) { bank = validate(cached.bank); syncedAt = cached.syncedAt || null; status = 'cached'; }
    } catch { /* A cópia incluída no site também funciona sem armazenamento local. */ }
    if (!bank.abilities.length) {
      try { apply(await fetchBank('./system-bank.json'), 'bundled'); }
      catch { status = 'unavailable'; notify(); }
    }
    return bank;
  })();

  async function refresh() {
    if (pending) return pending;
    pending = (async () => {
      await ready;
      status = 'syncing'; notify();
      try {
        const data = await fetchFromSheet();
        syncedAt = new Date().toISOString();
        try { localStorage.setItem(CACHE, JSON.stringify({ bank: data, syncedAt })); } catch { /* Sem cache. */ }
        apply(data, 'synced');
        return data;
      } catch (error) {
        status = bank.abilities.length ? 'offline' : 'unavailable'; notify();
        throw error;
      } finally { pending = null; }
    })();
    return pending;
  }

  window.POKEDEX_SYSTEM_LIBRARY = {
    normalize, ready, refresh,
    get data() { return bank; },
    get status() { return status; },
    get syncedAt() { return syncedAt; },
    get sourceUrl() { return SOURCE; }
  };
  ready.then(() => refresh().catch(() => {}));
})();
