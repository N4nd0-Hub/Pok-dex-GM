const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const snapshot = JSON.parse(fs.readFileSync(path.join(root, 'system-bank.json'), 'utf8'));
const sourceHTML = data => '<script>window.naoExecutar=true;\n' +
  'const CUSTOM_ABILITY_BANK = ' + JSON.stringify(data.abilities, null, 2) + ';\n' +
  'const CUSTOM_MOVE_BANK=' + JSON.stringify(data.moves) + ';\n' +
  'const HHRPG_RULES = ' + JSON.stringify(data.rules) + ';\n</script>';

function runtime(fetch) {
  const saved = new Map();
  const window = { dispatchEvent() {} };
  return vm.createContext({ window, fetch, setTimeout, clearTimeout, AbortController,
    CustomEvent: class { constructor(type) { this.type = type; } },
    localStorage: { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) }
  });
}

test('a falha da ficha preserva o banco incluído e uma nova sincronização o atualiza', async () => {
  let online = false;
  const context = runtime(async (url, options) => {
    if (url === './system-bank.json') return { ok: true, json: async () => snapshot };
    if (!online) throw Error('offline');
    return { ok: true, headers: { get: key => key === 'etag' ? 'nova-revisao' : null },
      text: async () => sourceHTML(snapshot) };
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'system-library.js'), 'utf8'), context);
  const library = context.window.POKEDEX_SYSTEM_LIBRARY;
  await library.ready;
  await assert.rejects(library.refresh());
  assert.equal(library.status, 'offline');
  assert.equal(library.data.abilities.length, snapshot.abilities.length);
  assert.equal(library.normalize("  Battle Armour  "), 'battle-armor');
  online = true;
  await library.refresh();
  assert.equal(library.status, 'synced');
  assert.equal(library.data.revision, 'nova-revisao');
  assert.equal(context.window.naoExecutar, undefined);
});

test('resposta incompleta não substitui um banco válido', async () => {
  const context = runtime(async url => ({ ok: true,
    headers: { get: () => 'incompleto' }, json: async () => snapshot,
    text: async () => sourceHTML({ ...snapshot, abilities: [] }) }));
  vm.runInContext(fs.readFileSync(path.join(root, 'system-library.js'), 'utf8'), context);
  const library = context.window.POKEDEX_SYSTEM_LIBRARY;
  await library.ready;
  await assert.rejects(library.refresh());
  assert.equal(library.data.revision, snapshot.revision);
  assert.equal(library.status, 'offline');
});

test('a ficha inalterada é conferida pelo ETag sem baixar novamente o HTML', async () => {
  let downloads = 0;
  const local = { ...snapshot, sourceETag: 'mesma-ficha' };
  const context = runtime(async (url, options) => {
    if (url === './system-bank.json') return { ok: true, json: async () => local };
    if (options.method === 'HEAD') return { ok: true, headers: { get: () => 'mesma-ficha' } };
    downloads++; throw Error('O HTML não deveria ser baixado.');
  });
  vm.runInContext(fs.readFileSync(path.join(root, 'system-library.js'), 'utf8'), context);
  const library = context.window.POKEDEX_SYSTEM_LIBRARY;
  await library.ready;
  await library.refresh();
  assert.equal(library.status, 'synced');
  assert.equal(downloads, 0);
});

test('a versão GM tem preferência; os moves da ficha preservam efeitos e precisão especial', async () => {
  const requests = [];
  const context = runtime(async url => {
    requests.push(url);
    return { ok: true, json: async () => ({ name: 'flamethrower', names: [], power: 90, accuracy: 100,
      type: { name: 'fire' }, damage_class: { name: 'special' }, effect_entries: [] }) };
  });
  context.window.POKEDEX_SYSTEM_LIBRARY = { ready: Promise.resolve(), data: snapshot };
  vm.runInContext(fs.readFileSync(path.join(root, 'move-lookup.js'), 'utf8'), context);
  const lookup = context.window.POKEDEX_MOVE_LOOKUP.lookup;
  const swords = await lookup('swords-dance');
  assert.match(swords.text, /Postura Ofensiva/);
  assert.equal(swords.category, 'Status');
  assert.equal(swords.accuracy, null);
  assert.equal(requests.length, 0);
  const custom = await lookup('Swords Dance', [{ name: 'Swords Dance', type: 'Normal', category: 'Status',
    power: 0, accuracy: null, description: 'Minha versão privada' }]);
  assert.equal(custom.text, 'Minha versão privada');
  const flamethrower = await lookup('Flamethrower');
  assert.equal(flamethrower.accuracy, 90);
  assert.equal(flamethrower.accuracyCanonical, 100);
  assert.equal(requests.length, 1);
  for (const move of snapshot.moves) {
    const mapped = await lookup(move.name);
    assert.ok(mapped.accuracy === null || mapped.accuracy >= 1 && mapped.accuracy <= 90, move.name);
    assert.ok(mapped.text.includes(move.description), move.name);
  }
});
