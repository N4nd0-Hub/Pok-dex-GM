# Pokémon criados no chat

Esta pasta recebe os Pokémon preparados para Heaven & Hell. Cada arquivo `*.pokemon.json` descreve uma espécie. As artes ficam em `artes/`. O catálogo gerado aparece automaticamente na Pokédex e na integração pública com a ficha.

O arquivo `modelo.pokemon.json.example` é uma referência e não aparece no site. Para começar uma criação, copie seu conteúdo para um arquivo terminado em `.pokemon.json` e substitua os dados de exemplo pelos dados do Pokémon solicitado.

## Campos da espécie

- `schema`: sempre `pokedex-pokemon-v1`.
- `key`: identificador estável, como `tyranitar-elysium`. Letras minúsculas, números e hífens. Não mude ao atualizar o mesmo Pokémon.
- `name`: nome exibido, sem acrescentar “(Rework)”.
- `classification`: `fakemon`, `rework` ou `official`.
- `status`: `published` para aparecer nas consultas públicas, `draft` para a visualização GM, ou `archived` para arquivar a origem.
- `dex`: número oficial ou regional, opcional. Use `null` quando não houver.
- `type1` e `type2`: nomes dos tipos em inglês. O segundo tipo é opcional.
- `baseStats`: os seis valores numéricos `hp`, `atk`, `def`, `spa`, `spd` e `spe`. O site calcula o BST.
- `abilities`: lista de nomes ou objetos `{ "name": "Ability", "text": "Efeito em português" }`. Os nomes existentes resolvem os efeitos do banco da ficha.
- `moves`: lista de nomes ou objetos. Por exemplo, `"Swords Dance"` usa o efeito alterado de Heaven & Hell. `{"name":"Flamethrower","learn":"Lv. 30"}` busca os outros dados automaticamente.
- `evolution`: `previous`, `next`, `level` e `requirements`, em texto; pode usar o nome/slug das outras etapas.
- `art`: `artes/nome.png`, JPEG/WebP, uma URL HTTPS pública, ou texto vazio enquanto a arte não foi solicitada. Arquivos locais precisam existir e ter até 10 MB.
- `category`, `description` e `specialRules`: textos em português.
- `forms`: lista de formas, descrita abaixo.
- `revision`: inteiro positivo opcional, começando em 1; refere-se ao registro e não à versão da ficha/site.
- `updatedAt`: data ISO opcional para o histórico.

Uma Ability nova precisa do efeito escrito. Um Move autoral novo precisa de `name`, `type`, `category`, `power`, `accuracy` e `text`. Categorias são `Physical`, `Special` e `Status`; `accuracy: null` indica ausência de teste. Os nomes continuam em inglês e os efeitos em português. Valores de Accuracy acima de 90 são preservados como referência canônica e limitados a 90 na ficha.

## Formas e Megas

Cada forma usa `key`, `name`, `kind`, `type1`, `type2`, `baseStats`, `abilities`, `specialRules` e `art`. O `kind` pode ser `mega`, `regional`, `alternate`, `shiny`, `primal`, `gigantamax` ou `other`. A forma herda o status da espécie, mas pode indicar seu próprio `status`.

As formas recebem ID próprio e ficam vinculadas à espécie. Uma espécie com várias evoluções continua usando um arquivo por etapa; uma Mega permanece dentro de `forms`.

Quando `evolution.previous` ou `evolution.next` referenciar a key, slug ou nome de outra espécie nesta pasta, o compilador cria os vínculos e a linha evolutiva automaticamente. Várias evoluções alternativas podem ser separadas por ` / `. Ciclos e pré-evoluções conflitantes são rejeitados.

## Publicar

```sh
node scripts/build-pokemon-catalog.cjs
node scripts/build-pokemon-catalog.cjs --check
node --test tests/*.test.cjs
```

Inclua as fontes, artes e `catalogo.json` no mesmo commit. O compilador valida os dados, resolve Abilities/Moves, gera IDs determinísticos e atualiza o índice consumido pelo site. Novos Moves oficiais podem exigir conexão à PokéAPI na primeira compilação; consultas posteriores reutilizam os dados já resolvidos.

## Edição pelo painel GM

Pokémon mantidos por arquivos exibem a marca **Git** e podem ser abertos no editor. Ao salvar, o painel usa sua sessão GM para criar a versão no banco, levando também as artes e formas. A versão do banco passa a ter preferência. Consultar um Pokémon não escreve no banco.

IDs e slugs impedem duplicação. Alterações publicadas em arquivos não sobrescrevem uma versão já salva no painel. Para retirar uma origem do Git, arquive/remova o arquivo e recompile. Uma versão que já foi salva no banco é administrada separadamente; remova a origem antes de arquivar/excluir essa versão pelo GM.

Arquivos deste repositório são públicos, incluindo os que tiverem status de rascunho. Use o Supabase/painel para notas ou rascunhos privados. O backup ZIP do painel reúne os registros salvos no banco; os arquivos fonte e suas artes permanecem versionados no Git.
