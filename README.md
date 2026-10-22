# Pok-dex-GM

Pokédex GM do Pokémon Heaven & Hell.

As criações do chat podem entrar pelo catálogo da pasta [pokemons/](pokemons/README.md): um arquivo por Pokémon, artes próprias, formas e preenchimento de Abilities/Moves pelo nome. Depois de compilar e publicar os arquivos, a Pokédex e a integração com a ficha recebem os registros automaticamente.

O editor consulta as Abilities, os Moves próprios/alterados e as regras do banco público da [Ficha Pokémon](https://n4nd0-hub.github.io/ficha-pokemon/). O conteúdo é lido como JSON; os scripts da ficha não são executados. Versões criadas na biblioteca do GM têm preferência sobre as entradas de mesmo nome da ficha.

`system-bank.json` fornece uma cópia inicial e permite usar a biblioteca quando a ficha estiver indisponível. Ao abrir a Pokédex, o banco é conferido com a ficha publicada. O botão **Atualizar da ficha** repete essa sincronização. A consulta dos outros Moves continua usando a PokéAPI.

Para regenerar a cópia inicial a partir do HTML da ficha:

```sh
python3 scripts/export-system-bank.py --input /caminho/da/ficha/index.html
```

Para verificar a leitura do banco, o uso offline e a prioridade das versões:

```sh
node --test tests/system-library.test.cjs
```
