# Pokémon criados para esta Pokédex

Este repositório publica a Pokédex GM de Pokémon Heaven & Hell. Quando o usuário pedir para criar/adicionar Pokémon, reworks, formas ou uma linha evolutiva ao site, use o fluxo abaixo. Não altere o número V5.0 sem solicitação explícita.

## Cadastro por arquivos

1. Consulte `pokemons/README.md` e use `pokemons/modelo.pokemon.json.example` como referência. Crie um arquivo `pokemons/<key>.pokemon.json` por espécie. O exemplo não é um Pokémon publicado.
2. Reúna todos os dados que o usuário fornecer. Preserve nomes, tipos, BST, efeitos próprios e desenhos aprovados. Crie o restante de acordo com o pedido e as regras atuais; não invente alterações em criaturas já existentes.
3. Confira se a espécie já existe no catálogo/banco. Não crie um arquivo duplicado para contornar uma edição existente do GM. Use uma `key` estável e exclusiva. Ao atualizar uma espécie já criada por arquivo, edite seu arquivo mantendo a mesma `key`. Nunca gere uma key nova para a mesma espécie. O compilador produz IDs UUID estáveis para a espécie e suas formas.
4. Salve as artes em `pokemons/artes/`, preferindo PNG transparente quando esse for o pedido. Não deixe imagens aprovadas apenas em caminhos temporários. A propriedade `art` aponta para `artes/<arquivo>.png`. Para binários, use o suporte a blobs/base64 do GitHub; não converta PNG em texto nem exponha credenciais.
5. Abilities existentes podem ser informadas só pelo nome em inglês; os efeitos vêm de `system-bank.json`. Uma Ability autoral nova usa `{ "name": "English Name", "text": "Efeito em português" }`.
6. Moves existentes podem ser informados só pelo nome em inglês. O compilador consulta primeiro os moves próprios/alterados da ficha; depois a PokéAPI, com a mesma tradução usada pelo editor. Preserve efeitos e números específicos enviados pelo usuário em objetos completos. Precisão RPG tem teto 90%; `accuracy: null` representa ausência de teste de precisão.
7. Para linhas evolutivas, crie todas as espécies solicitadas e preencha `evolution`. Megas e formas alternativas pertencem à propriedade `forms` da espécie e têm `key` própria. Não substitua as Abilities da base pelas da Mega.
8. Use `status: "published"` quando o pedido for colocar a criação no site. Use `draft` quando o usuário pedir rascunho. O Git é público: informações privadas ficam apenas no painel GM.
9. Execute `node scripts/build-pokemon-catalog.cjs`. Inclua **os arquivos fonte, as artes e `pokemons/catalogo.json` no mesmo commit**. O site e a ponte para a ficha leem esse catálogo compilado; escrever só o JSON fonte não conclui a publicação.
10. Execute `node scripts/build-pokemon-catalog.cjs --check` e `node --test tests/*.test.cjs`. Confira as imagens e os dados essenciais antes de publicar. Publique no repositório indicado pelo usuário e confirme o resultado do GitHub Pages.

## Banco e edições

As criações dos arquivos entram no catálogo automaticamente. Registros já salvos no Supabase têm preferência por ID ou slug, evitando duplicatas e sobrescrita de ajustes do GM. Editar uma criação do Git pelo painel salva uma versão no banco com o mesmo ID. Esse processo usa a sessão GM e as políticas existentes; não exige service_role no navegador nem mudança em RLS.

Para atualizar conteúdo cuja versão já foi editada no painel, confira a versão atual do banco. Não sobrescreva silenciosamente os ajustes feitos pelo usuário. Para retirar uma publicação mantida pelo Git, atualize/remova a origem e recompile. Se houver uma versão independente salva no banco, ela também deve ser administrada pelo painel GM.

Não altere o repositório da ficha ou o de Overwatch para cadastrar Pokémon. A integração com a ficha é servida pelo `pokedex-gm-bridge.js` deste repositório.
