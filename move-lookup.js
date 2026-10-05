/* Busca de Moves da Pokédex GM.
   Banco do sistema e tradução reutilizados da Ficha Pokémon Heaven & Hell.
   Nomes em inglês, efeitos em português e Accuracy RPG limitada a 90%. */
(function(){
  'use strict';
  const CUSTOM_MOVE_BANK=[
  {
    "name": "Cinder Lock",
    "type": "Fire",
    "category": "Special",
    "power": 60,
    "accuracy": 85,
    "effectChance": 100,
    "tags": [
      "Trapping",
      "Anti-Switch",
      "Flinch Setup",
      "Especial"
    ],
    "learnableBy": [
      "Litwick",
      "Lampent",
      "Chandelure",
      "Larvesta",
      "Volcarona",
      "Salandit",
      "Salazzle",
      "Houndour",
      "Houndoom",
      "Charcadet",
      "Armarouge"
    ],
    "learnRule": "O Pokémon precisa produzir chamas em seu corpo ou ser capaz de aprender moves do tipo Fire.",
    "description": "O alvo fica Preso, sem trocar, por 2 turnos. Se sair de campo por qualquer motivo durante esse período, inclusive usando U-Turn, Volt Switch, Flip Turn, Parting Shot ou Teleport, o próximo Pokémon inimigo a entrar sofre Flinch garantido na primeira ação. Respeita imunidades a Flinch como Inner Focus e Shield Dust. Não é contato. Screens reduzem o dano normalmente. Clima, Terreno e Domínio não removem o estado Preso. Em crítico, apenas o dano base é maximizado."
  },
  {
    "name": "Serrated Lunge",
    "type": "Steel",
    "category": "Physical",
    "power": 90,
    "accuracy": 75,
    "effectChance": 30,
    "tags": [
      "Contato",
      "Corte / Sharpness",
      "Debuff Reativo"
    ],
    "learnableBy": [
      "Pawniard",
      "Bisharp",
      "Kingambit",
      "Honedge",
      "Doublade",
      "Aegislash",
      "Scyther",
      "Scizor",
      "Kleavor"
    ],
    "learnRule": "Pokémon capazes de causar cortes fisicamente podem aprender. Pokémon com Sharpness também podem aprender.",
    "description": "Contato. Corte. Ao acertar, 30% de chance de aplicar Lacerado por 3 turnos. Lacerado: sempre que o alvo usar um golpe de contato, sofre 1d6 de dano; não acumula e ativa no máximo 1 vez por ação. Conta como golpe de corte: Sharpness adiciona +2d6. Não é Punch e não ativa Iron Fist. Em crítico, apenas o dano base é maximizado."
  },
  {
    "name": "Blight Bloom",
    "type": "Poison",
    "category": "Special",
    "power": 20,
    "accuracy": 90,
    "effectChance": 100,
    "tags": [
      "Status On-Hit 100%",
      "Scaling Power",
      "Especial"
    ],
    "description": "100% de chance de aplicar Poison, não Toxic. Se o alvo já estiver envenenado, ganha +20 de Power para cada rodada completa sob Poison, até Power 120. Sob Toxic, ganha +40 de Power por rodada. Escala 20→40→60→80→100→120, equivalendo a 1d6→2d6→3d6→4d6→5d6→6d6 base. Se o status for removido, volta a Power 20. Alvos Poison ou Steel imunes a Poison não recebem o status. O escalonamento funciona com Poison de qualquer fonte."
  },
  {
    "name": "Aerial Tag",
    "type": "Flying",
    "category": "Status",
    "power": 0,
    "powerLabel": "—",
    "accuracy": 90,
    "effectChance": 0,
    "tags": [
      "Status",
      "Switch",
      "Auto-Cast"
    ],
    "description": "Após a checagem de acerto, o usuário sai de campo e um aliado entra imediatamente. Esse aliado usa automaticamente o 1º move da Move Pool de combate, o slot 1 entre os 5 escolhidos, ainda neste turno. O auto-cast resolve normalmente. Falha se o usuário não puder trocar. O auto-cast não pode ser Z-Move nem OHKO. Hazards aplicam antes do auto-cast."
  },
  {
    "name": "Shatter Frost",
    "type": "Ice",
    "category": "Special",
    "power": 45,
    "accuracy": 90,
    "effectChance": 40,
    "tags": [
      "Freeze",
      "Especial",
      "Dano Condicional"
    ],
    "description": "40% de chance de causar Freeze. Se o alvo já estiver Congelado, não role o dano base normal: use 12 de dano fixo como base. STAB, bônus de Sp.Atk, habilidades e reduções defensivas ainda se aplicam. Não é contato. Em crítico contra alvo não congelado, o dano base 3d6 é maximizado em 18; contra alvo congelado, o crítico altera os 12 fixos para +20 de dano."
  },
  {
    "name": "Steadfast Guard",
    "type": "Normal",
    "category": "Status",
    "power": 0,
    "powerLabel": "—",
    "accuracy": 100,
    "accuracyLabel": "100%",
    "effectChance": 0,
    "tags": [
      "Status",
      "Mitigação",
      "Stack"
    ],
    "description": "O usuário se concentra por 1 turno e não ataca. A partir do próximo turno, reduz 5 de dano fixo de todos os golpes recebidos. Acumula por uso: -5, -10 e -15, máximo -15. Só pode ser ativado acima de 50% do HP Máximo. Persiste até sair de campo ou ficar abaixo de 50% do HP Máximo. A redução fixa é aplicada no final do cálculo."
  },
  {
    "name": "Glamour Hex",
    "type": "Fairy",
    "category": "Physical",
    "power": 90,
    "accuracy": 60,
    "effectChance": 100,
    "tags": [
      "Debuff Exclusivo",
      "Anti-STAB",
      "Anti-Priority",
      "Físico"
    ],
    "description": "Ao acertar, aplica Fae Seal por 2 turnos. Enquanto estiver sob Fae Seal, o alvo não recebe STAB nem modificadores de STAB como Adaptability. Moves de prioridade usados pelo alvo perdem a prioridade e atuam como prioridade normal. Reaplicar apenas renova a duração. Não é contato. Clear Body e White Smoke não bloqueiam. Magic Bounce não reflete."
  },
  {
    "name": "Chitin Boomer",
    "type": "Bug",
    "category": "Special",
    "power": 60,
    "accuracy": 90,
    "effectChance": 0,
    "tags": [
      "Retry on Miss",
      "Especial",
      "Projétil",
      "Não é Multi-Hit"
    ],
    "description": "Se a primeira tentativa errar, o projétil retorna na próxima rodada e realiza uma nova tentativa gratuita contra o mesmo alvo com 45% de Precisão. O retorno não consome ação. Apenas 1 retorno por uso. Não é contato. Evasiva vale separadamente para cada tentativa. Cada tentativa pode critar normalmente."
  },
  {
    "name": "Mind Partition",
    "type": "Psychic",
    "category": "Status",
    "power": 0,
    "powerLabel": "—",
    "accuracy": 0,
    "accuracyLabel": "Reação",
    "effectChance": 0,
    "tags": [
      "Status",
      "Reação",
      "Priority +3",
      "Damage Split",
      "Anti-OHKO"
    ],
    "description": "Priority +3. Pode ser usado como Reação quando o usuário é alvo de um golpe. Se o golpe acertar, ambos os Pokémon recebem metade do dano total calculado contra a parede. Na divisão, o dano é neutro para ambos e ignora reduções em dados de fraqueza ou resistência. Multi-Hit resolve hit a hit. OHKO ou efeito de KO imediato é anulado e tratado como Power 120, 6d6 base, antes da divisão. Não pode ser usado em turnos consecutivos; recarga de 1 turno."
  },
  {
    "name": "Rivet Breaker",
    "type": "Steel",
    "category": "Physical",
    "power": 100,
    "accuracy": 65,
    "effectChance": 100,
    "tags": [
      "Contato",
      "Corte / Sharpness",
      "Screen Break",
      "Debuff: Sunder"
    ],
    "description": "Ao acertar, quebra Reflect, Light Screen e Aurora Veil e aplica Sunder por 2 turnos. Sunder: na próxima vez que o alvo for atingido, ignore -1d6 da Defense ou Sp.Def dele no cálculo de redução; o efeito é consumido. Se errar, causa 3 de dano fixo por estilhaços. Contato. Corte. Sharpness adiciona +2d6. Não é Punch."
  },
  {
    "name": "Draco Finality",
    "type": "Dragon",
    "category": "Physical",
    "power": 120,
    "powerLabel": "OHKO",
    "accuracy": 25,
    "accuracyLabel": "25% Fixa",
    "effectChance": 100,
    "tags": [
      "OHKO",
      "Precisão Fixa 25%",
      "Ignora Evasiva",
      "Físico"
    ],
    "description": "Ao acertar, causa OHKO. Precisão fixa de 25%, ignorando modificadores de Precisão e Evasiva Reativa ou Ativa. Se o alvo for imune a OHKO, trate como Power 120: 6d6 base + bônus de Attack + STAB. Crítico não altera a checagem de OHKO; se convertido em dano, maximiza apenas os 6d6 base para 36. OHKO não pode ser transformado em Z-Move."
  },
  {
    "name": "Stagger Hit",
    "type": "Normal",
    "category": "Physical",
    "power": 60,
    "accuracy": 90,
    "accuracyLabel": "Nunca erra",
    "alwaysHits": true,
    "effectChance": 0,
    "tags": [
      "Nunca Erra",
      "Debuff Defesa",
      "Físico"
    ],
    "description": "Ignora modificadores de Precisão e Evasiva. Em usos ímpares do mesmo usuário no combate, causa dano normalmente. Em usos pares, não causa dano e reduz a Defense do alvo em -1 Estágio, equivalente a -1d6 na Redução de Dano. Alterna sempre: Dano → Quebra de Defesa → Dano → Quebra de Defesa."
  },
  {
    "name": "Mind Shatter",
    "type": "Psychic",
    "category": "Special",
    "power": 60,
    "accuracy": 90,
    "effectChance": 100,
    "tags": [
      "Screen Break",
      "Ignora Screen",
      "Especial",
      "Anti-Setup"
    ],
    "description": "Causa dano ignorando completamente Light Screen, Reflect e Aurora Veil ativos no lado do alvo. Após causar dano, destrói todas as Screens do lado do alvo. Não ignora outros efeitos defensivos. Em crítico, o dano base é maximizado."
  },
  {
    "name": "Veil Reversal",
    "type": "Dark",
    "category": "Physical",
    "power": 75,
    "accuracy": 90,
    "effectChance": 100,
    "tags": [
      "Screen Steal",
      "Anti-Setup",
      "Físico",
      "Dark"
    ],
    "description": "Ao acertar, rouba Light Screen, Reflect e Aurora Veil do lado do alvo e transfere para o lado do usuário, mantendo a duração restante. As Screens passam a usar o Nível do usuário. Se o usuário já tiver Screens, elas são substituídas."
  },
  {
    "name": "Static Surge",
    "type": "Electric",
    "category": "Special",
    "power": 60,
    "accuracy": 90,
    "accuracyLabel": "Nunca erra",
    "alwaysHits": true,
    "effectChance": 0,
    "tags": [
      "Nunca Erra",
      "Punir Paralysis",
      "Especial"
    ],
    "description": "Ignora Precisão e Evasiva. Se o alvo estiver Paralyzed, causa +2d6 de dano."
  },
  {
    "name": "Flame Barrage",
    "type": "Fire",
    "category": "Physical",
    "power": 25,
    "accuracy": 90,
    "effectChance": 0,
    "tags": [
      "Follow-Up Hits",
      "Punch",
      "Físico",
      "Multi-hit"
    ],
    "description": "Atinge de 2 a 6 hits. O 1º hit causa 1d6 base + bônus de Attack + STAB + bônus aplicáveis. Hits extras causam 1d6 base + STAB + bônus aplicáveis, sem bônus de Attack. Conta como Punch e ativa Iron Fist. Em crítico natural 1–5, o dano base de cada hit vira 6. Se um hit nocautear, os hits restantes não ocorrem."
  },
  {
    "name": "Recover",
    "type": "Normal",
    "category": "Status",
    "power": 0,
    "powerLabel": "—",
    "accuracy": 0,
    "accuracyLabel": "—",
    "effectChance": 0,
    "tags": [
      "Rework",
      "Cura",
      "3 usos",
      "Recarga 1 turno"
    ],
    "description": "Cura 50% do HP Máximo do usuário. Máximo de 3 usos por combate. Não pode ser usado em turnos consecutivos: recarga de 1 turno. Se tentado durante a recarga, falha e consome a ação, mas não gasta um dos 3 usos."
  },
  {
    "name": "Drain Punch",
    "type": "Fighting",
    "category": "Physical",
    "power": 75,
    "accuracy": 90,
    "effectChance": 0,
    "tags": [
      "Rework",
      "Contato",
      "Punch",
      "Cura"
    ],
    "description": "Um soco que drena a vitalidade do alvo. Cura 25% do dano final causado, após resistências e defesas. É Contato e Punch, portanto recebe sinergia de Iron Fist. Em crítico, apenas o dano base é maximizado; a cura continua sendo 25% do dano final causado."
  },
  {
    "name": "Light Screen",
    "type": "Psychic",
    "category": "Status",
    "power": 0,
    "powerLabel": "—",
    "accuracy": 0,
    "accuracyLabel": "—",
    "effectChance": 0,
    "tags": [
      "Rework",
      "Screen",
      "Redução Especial",
      "Time Side"
    ],
    "description": "Dura 3 turnos e protege todos os aliados do lado do usuário; com Light Clay dura 5 turnos. Quando um aliado sofre dano de golpe Especial, reduz o dano final em Nível do usuário ÷ 2 como dano fixo. Críticos ignoram Light Screen. Super efetivo continua aplicando suas regras normalmente; a Screen entra apenas no final como corte fixo."
  },
  {
    "name": "Reflect",
    "type": "Psychic",
    "category": "Status",
    "power": 0,
    "powerLabel": "—",
    "accuracy": 0,
    "accuracyLabel": "—",
    "effectChance": 0,
    "tags": [
      "Rework",
      "Screen",
      "Redução Física",
      "Time Side"
    ],
    "description": "Dura 3 turnos e protege todos os aliados do lado do usuário; com Light Clay dura 5 turnos. Quando um aliado sofre dano de golpe Físico, reduz o dano final em Nível do usuário ÷ 2 como dano fixo. Críticos ignoram Reflect. Super efetivo continua aplicando suas regras normalmente; Reflect reduz apenas no final."
  },
  {
    "name": "Aurora Veil",
    "type": "Ice",
    "category": "Status",
    "power": 0,
    "powerLabel": "—",
    "accuracy": 0,
    "accuracyLabel": "—",
    "effectChance": 0,
    "tags": [
      "Rework",
      "Screen Híbrida",
      "Clima: Hail/Snow",
      "Redução Física & Especial"
    ],
    "description": "Só pode ser usado se Snow ou Hail estiver ativo. Dura 3 turnos e protege todos os aliados; com Light Clay dura 5 turnos. Golpes Físicos e Especiais têm o dano final reduzido em Nível do usuário ÷ 2 como dano fixo. Críticos ignoram Aurora Veil. Não acumula com Light Screen ou Reflect: uma Screen substitui a outra."
  },
  {
    "name": "Dragon Dance",
    "type": "Dragon",
    "category": "Status",
    "power": 0,
    "powerLabel": "—",
    "accuracy": 0,
    "accuracyLabel": "—",
    "effectChance": 0,
    "tags": [
      "Rework",
      "Setup",
      "Ritmo",
      "Precisão",
      "Pierce"
    ],
    "description": "O usuário entra em Ritmo por 2 turnos. Durante o Ritmo, pode receber 1 Comando de Treinador gratuitamente e seus golpes Dragon recebem +10 de Precisão. No primeiro golpe de dano que acertar durante o Ritmo, aplica Breakthrough e ignora -3d6 da redução de dano do alvo. O efeito termina após 2 turnos ou se o usuário ficar Incapacitado."
  },
  {
    "name": "Swords Dance",
    "type": "Normal",
    "category": "Status",
    "power": 0,
    "powerLabel": "—",
    "accuracy": 0,
    "accuracyLabel": "—",
    "effectChance": 0,
    "tags": [
      "Rework",
      "Setup",
      "Next Hit x2",
      "Físico"
    ],
    "description": "O usuário entra em Postura Ofensiva até o fim do próximo turno. O primeiro move Físico de dano usado no próximo turno causa o dobro do dano final. Após ativar a dobra, acertando ou errando, o efeito termina. Se o usuário ficar Incapacitado por Sleep, Freeze ou Flinch antes de atacar, o efeito é perdido."
  },
  {
    "name": "Iron Defense",
    "type": "Steel",
    "category": "Status",
    "power": 0,
    "powerLabel": "—",
    "accuracy": 0,
    "accuracyLabel": "—",
    "effectChance": 0,
    "tags": [
      "Rework",
      "Setup",
      "Damage Cut 50%",
      "Físico"
    ],
    "description": "O usuário entra em Postura Defensiva até ser atingido. O próximo golpe Físico que acertar tem o dano final reduzido pela metade. Após reduzir 1 golpe, o efeito termina. Se o próximo golpe Físico errar, a postura não é gasta."
  },
  {
    "name": "Calm Mind",
    "type": "Psychic",
    "category": "Status",
    "power": 0,
    "powerLabel": "—",
    "accuracy": 0,
    "accuracyLabel": "—",
    "effectChance": 0,
    "tags": [
      "Rework",
      "Setup",
      "Defensivo",
      "Anti-Debuff",
      "Consistência"
    ],
    "description": "O usuário entra em Concentração por 2 turnos. Durante a Concentração, pode receber 1 Comando de Treinador gratuitamente. Sua Sp.Def não pode ser reduzida por inimigos; se tentarem, cura 10 HP, no máximo 1 vez por turno. Enquanto durar, inimigos sofrem -10 de Precisão contra o usuário. Termina após 2 turnos ou se o usuário ficar Incapacitado."
  },
  {
    "name": "Rotation Kick",
    "type": "Fighting",
    "category": "Physical",
    "power": 60,
    "accuracy": 90,
    "effectChance": 100,
    "tags": [
      "Exclusivo",
      "Físico",
      "Forced Switch",
      "Kick"
    ],
    "learnableBy": [
      "Hitmonlee"
    ],
    "learnRule": "Golpe exclusivo de Hitmonlee.",
    "description": "Após causar dano, força o alvo a trocar com um aliado aleatório do mesmo time, de forma semelhante a Roar. Se o golpe nocautear o alvo, o novo inimigo que entrar sofre -1 estágio de Defense. STAB se aplica normalmente e pode ativar Relentless Combo. Não funciona contra Suction Cups, Ingrain ou Domínios de Campo fixos."
  },
  {
    "name": "Banana Barrage",
    "type": "Grass",
    "category": "Special",
    "power": 80,
    "accuracy": 60,
    "effectChance": 100,
    "tags": [
      "Exclusivo",
      "Grass",
      "Efeito Aleatório",
      "Clima"
    ],
    "learnableBy": [
      "Tropius",
      "Aipom",
      "Ambipom",
      "Infernape",
      "Rillaboom",
      "Passimian",
      "Oranguru"
    ],
    "learnRule": "Tropius e Pokémon primatas podem aprender. Para usuários primatas, pode ser tratado como golpe Físico.",
    "description": "Após acertar, role 1d6: 1-2 o alvo sofre Flinch; 3-4 o usuário come uma banana e recupera 1d6 HP; 5-6 cria Grassy Terrain por 3 turnos. Em clima ensolarado, recebe +1d6 de dano. Para Pokémon primatas, o Mestre pode considerar a categoria Física em vez de Especial."
  },
  {
    "id": "dirge-whistle",
    "name": "Dirge Whistle",
    "type": "Ghost",
    "category": "Special",
    "power": 80,
    "powerLabel": "",
    "accuracy": 90,
    "accuracyLabel": "",
    "alwaysHits": false,
    "effectChance": 0,
    "source": "custom",
    "tags": [
      "Sonoro"
    ],
    "learnableBy": [
      "monomoi",
      "soulito",
      "thesilbon"
    ],
    "learnRule": "É considerado um move sonoro. Apenas o maior bônus de dano é aplicado.",
    "specialRules": [
      "É considerado um move sonoro.",
      "Apenas o maior bônus de dano é aplicado."
    ],
    "description": "O usuário produz um assobio fúnebre que atravessa o corpo do alvo. Se o alvo estiver com a Precisão reduzida, o golpe recebe +1d6 de dano. Caso o alvo esteja sob Confusion, Infatuation ou outra condição mental, o bônus aumenta para +2d6. Apenas o maior bônus é aplicado."
  },
  {
    "id": "lost-lullaby",
    "name": "Lost Lullaby",
    "type": "Ghost",
    "category": "Status",
    "power": 0,
    "powerLabel": "—",
    "accuracy": 90,
    "accuracyLabel": "",
    "alwaysHits": false,
    "effectChance": 0,
    "source": "custom",
    "tags": [
      "Sonoro"
    ],
    "learnableBy": [
      "monomoi",
      "soulito",
      "thesilbon"
    ],
    "learnRule": "É considerado um move sonoro.",
    "specialRules": [
      "É considerado um move sonoro."
    ],
    "description": "O usuário assobia uma melodia incompleta que faz o alvo perder a noção de direção. Aplica Confusion por 1d3 turnos. Caso o alvo já esteja com a Precisão reduzida, também sofre -1 Estágio de Sp.Def. Não pode aplicar novamente Confusion enquanto a condição anterior ainda estiver ativa."
  }
];
  const normalizeApiSlug=value=>String(value||'').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'')
    .replace(/[\s_]+/g,'-').replace(/-+/g,'-');
  const prettyName=value=>String(value||'').split('-')
    .map(word=>word?word[0].toUpperCase()+word.slice(1):'').join(' ');

const MOVE_EFFECT_EXACT_PT={
  "inflicts regular damage with no additional effect.":"Causa dano normal sem efeito adicional.",
  "inflicts regular damage.":"Causa dano normal.",
  "never misses.":"Este Move nunca erra.",
  "power doubles every turn this move is used in succession after the first, resetting after five turns.":"O Poder dobra a cada turno em que este Move é usado consecutivamente após o primeiro, sendo reiniciado depois de cinco turnos.",
  "user recovers half the hp inflicted on opponent.":"O usuário recupera HP equivalente à metade do dano causado ao alvo.",
  "user sleeps for two turns, completely healing itself.":"O usuário dorme por 2 turnos e recupera completamente seu HP.",
  "forces the target to switch out.":"Força o alvo a sair de campo e ser substituído.",
  "protects the user from attacks.":"Protege o usuário contra ataques.",
  "hits 2-5 times in one turn.":"Atinge de 2 a 5 vezes no mesmo turno."
};

function moveStatLabelPt(value){
  const key=String(value||"").toLowerCase().replace(/[_-]+/g," ");
  const labels={
    "attack":"Ataque",
    "defense":"Defesa",
    "special attack":"Ataque Especial",
    "special defense":"Defesa Especial",
    "speed":"Velocidade",
    "accuracy":"Precisão",
    "evasion":"Evasão"
  };
  return labels[key]||value;
}

function moveDescriptionLooksPortuguese(value){
  return /\b(usuário|alvo|golpe|dano|turno|rodada|poder|precisão|aumenta|reduz|causa|recupera|estágio)\b/i
    .test(String(value||""));
}

function translateMoveEffectPt(value){
  let text=String(value||"")
    .replace(/\[(.*?)\]\{.*?\}/g,"$1")
    .replace(/\$effect_chance%?/gi,"")
    .replace(/\s+/g," ")
    .trim();

  if(!text)return "";

  const exact=MOVE_EFFECT_EXACT_PT[text.toLowerCase()];
  if(exact)return exact;

  if(moveDescriptionLooksPortuguese(text)){
    return text
      .replace(/\bMoves?\b/g,"Moves")
      .replace(/\bPower\b/g,"Poder")
      .replace(/\bAccuracy\b/g,"Precisão")
      .replace(/\bPhysical\b/g,"Físico")
      .replace(/\bSpecial\b/g,"Especial")
      .replace(/\bAttack\b/g,"Ataque")
      .replace(/\bDefense\b/g,"Defesa")
      .replace(/\bSpeed\b/g,"Velocidade");
  }

  let match=text.match(/^Has a (\d+)% chance to make the target flinch\.?$/i);
  if(match)return `Tem ${match[1]}% de chance de causar Flinch no alvo.`;

  match=text.match(/^Has a (\d+)% chance to lower the target'?s (.+?) by (one|two|three) stages?\.?$/i);
  if(match){
    const amount={one:1,two:2,three:3}[match[3].toLowerCase()]||1;
    return `Tem ${match[1]}% de chance de reduzir ${moveStatLabelPt(match[2])} do alvo em ${amount} estágio${amount===1?"":"s"}.`;
  }

  match=text.match(/^Has a (\d+)% chance to raise the user'?s (.+?) by (one|two|three) stages?\.?$/i);
  if(match){
    const amount={one:1,two:2,three:3}[match[3].toLowerCase()]||1;
    return `Tem ${match[1]}% de chance de aumentar ${moveStatLabelPt(match[2])} do usuário em ${amount} estágio${amount===1?"":"s"}.`;
  }

  match=text.match(/^Lowers the target'?s (.+?) by (one|two|three) stages?\.?$/i);
  if(match){
    const amount={one:1,two:2,three:3}[match[2].toLowerCase()]||1;
    return `Reduz ${moveStatLabelPt(match[1])} do alvo em ${amount} estágio${amount===1?"":"s"}.`;
  }

  match=text.match(/^Raises the user'?s (.+?) by (one|two|three) stages?\.?$/i);
  if(match){
    const amount={one:1,two:2,three:3}[match[2].toLowerCase()]||1;
    return `Aumenta ${moveStatLabelPt(match[1])} do usuário em ${amount} estágio${amount===1?"":"s"}.`;
  }

  match=text.match(/^Has a (\d+)% chance to (burn|poison|paralyze|freeze|confuse) the target\.?$/i);
  if(match){
    const status={
      burn:"causar Burn",
      poison:"causar Poison",
      paralyze:"causar Paralysis",
      freeze:"causar Freeze",
      confuse:"causar Confusion"
    }[match[2].toLowerCase()];
    return `Tem ${match[1]}% de chance de ${status} no alvo.`;
  }

  match=text.match(/^Power is doubled if (.+)\.?$/i);
  if(match)return `O Poder é dobrado se ${match[1]}.`;

  const replacements=[
    [/\bInflicts regular damage\b/gi,"Causa dano normal"],
    [/\bwith no additional effect\b/gi,"sem efeito adicional"],
    [/\bThis move\b/gi,"Este Move"],
    [/\bthe user\b/gi,"o usuário"],
    [/\bthe target\b/gi,"o alvo"],
    [/\bthe opponent\b/gi,"o oponente"],
    [/\bthe target's\b/gi,"do alvo"],
    [/\bthe user's\b/gi,"do usuário"],
    [/\bhas a\b/gi,"tem"],
    [/\bchance to\b/gi,"chance de"],
    [/\bpower\b/gi,"Poder"],
    [/\bdamage\b/gi,"dano"],
    [/\baccuracy\b/gi,"Precisão"],
    [/\battack\b/gi,"Ataque"],
    [/\bdefense\b/gi,"Defesa"],
    [/\bspeed\b/gi,"Velocidade"],
    [/\braises\b/gi,"aumenta"],
    [/\blowers\b/gi,"reduz"],
    [/\brecovers\b/gi,"recupera"],
    [/\brestores\b/gi,"restaura"],
    [/\bcauses\b/gi,"causa"],
    [/\bcan hit\b/gi,"pode atingir"],
    [/\bfor two turns\b/gi,"por 2 turnos"],
    [/\bfor three turns\b/gi,"por 3 turnos"],
    [/\bby one stage\b/gi,"em 1 estágio"],
    [/\bby two stages\b/gi,"em 2 estágios"],
    [/\bcritical hit\b/gi,"acerto crítico"],
    [/\bcritical hits\b/gi,"acertos críticos"],
    [/\bflinch\b/gi,"Flinch"],
    [/\bburn\b/gi,"Burn"],
    [/\bpoison\b/gi,"Poison"],
    [/\bparalysis\b/gi,"Paralysis"],
    [/\bconfusion\b/gi,"Confusion"],
    [/\bfreeze\b/gi,"Freeze"],
    [/\brecoil\b/gi,"recuo"],
    [/\bturn\b/gi,"turno"],
    [/\bturns\b/gi,"turnos"]
  ];

  replacements.forEach(([pattern,replacement])=>{text=text.replace(pattern,replacement);});
  text=text
    .replace(/\s+([,.!?])/g,"$1")
    .replace(/\bde o\b/gi,"do")
    .replace(/\bde a\b/gi,"da")
    .trim();

  return text.charAt(0).toUpperCase()+text.slice(1);
}

function moveDescriptionFromApi(data){
  const effect=(data.effect_entries||[]).find(x=>x?.language?.name==="en");
  const flavor=(data.flavor_text_entries||[]).find(x=>x?.language?.name==="en");
  let text=effect?.short_effect || effect?.effect || flavor?.flavor_text || "";
  text=String(text).replace(/\$effect_chance/g,String(data.effect_chance??0));
  if(data.effect_chance!=null)text=text.replace(/\bHas a chance to\b/i,`Has a ${data.effect_chance}% chance to`);
  return translateMoveEffectPt(text);
}

  const detailsCache=new Map();
  let officialNamesPromise=null;

  async function fetchJson(url){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(url,{signal:controller.signal});
      if(!response.ok)throw Error(response.status===404
        ?'Move não encontrado. Você pode preencher um golpe próprio manualmente.'
        :'A PokéAPI está indisponível. Tente buscar novamente.');
      return await response.json();
    }catch(error){
      if(error.name==='AbortError')throw Error('A busca demorou demais. Tente novamente.');
      if(error instanceof TypeError)throw Error('Não foi possível conectar à PokéAPI. Tente novamente ou preencha manualmente.');
      throw error;
    }finally{clearTimeout(timer)}
  }

  function systemMove(move,source){
    const rawAccuracy=('canonicalAccuracy' in move||'accuracyCanonical' in move)
      ?move.canonicalAccuracy??move.accuracyCanonical??null:move.accuracy;
    const accuracy=move.alwaysHits||move.accuracy==null||Number(move.accuracy)<=0
      ?null:Math.min(90,Number(move.accuracy));
    const extra=[];
    if(move.accuracyLabel)extra.push('Precisão especial: '+move.accuracyLabel+'.');
    if(move.tags?.length)extra.push('Tags: '+move.tags.join(' • ')+'.');
    if(move.learnableBy?.length)extra.push('Pokémon listados: '+move.learnableBy.join(', ')+'.');
    if(move.learnRule)extra.push('Regra de aprendizado: '+move.learnRule);
    return {
      name:move.name,type:move.type,category:move.category,
      power:Number(move.power||0),accuracy,
      accuracyCanonical:rawAccuracy==null||Number(rawAccuracy)<=0?null:Number(rawAccuracy),
      text:(move.description||move.text||'')+(extra.length?'\n\n'+extra.join('\n'):''),
      source
    };
  }

  async function lookup(query,library=[]){
    const key=normalizeApiSlug(query);
    if(!key)throw Error('Digite o nome do movimento.');
    const local=library.find(move=>normalizeApiSlug(move.name)===key);
    if(local)return systemMove(local,'Biblioteca GM');
    const custom=CUSTOM_MOVE_BANK.find(move=>normalizeApiSlug(move.name)===key);
    if(custom)return systemMove(custom,'Banco do Sistema');
    if(!detailsCache.has(key)){
      const pending=fetchJson('https://pokeapi.co/api/v2/move/'+encodeURIComponent(key)+'/')
        .then(data=>({
          name:(data.names||[]).find(entry=>entry.language?.name==='en')?.name||prettyName(data.name),
          type:prettyName(data.type?.name||'normal'),
          category:prettyName(data.damage_class?.name||'status'),
          power:Number(data.power||0),
          accuracy:data.accuracy==null?null:Math.min(90,Number(data.accuracy)),
          accuracyCanonical:data.accuracy==null?null:Number(data.accuracy),
          text:moveDescriptionFromApi(data),source:'PokéAPI'
        }));
      detailsCache.set(key,pending);
      pending.catch(()=>{if(detailsCache.get(key)===pending)detailsCache.delete(key)});
    }
    return {...await detailsCache.get(key)};
  }

  function names(library=[]){
    if(!officialNamesPromise){
      officialNamesPromise=fetchJson('https://pokeapi.co/api/v2/move?limit=2000')
        .then(data=>(data.results||[]).map(move=>prettyName(move.name)))
        .catch(()=>{officialNamesPromise=null;return []});
    }
    return officialNamesPromise.then(official=>[...new Set([
      ...library.map(move=>move.name),...CUSTOM_MOVE_BANK.map(move=>move.name),...official
    ])].filter(Boolean).sort((a,b)=>a.localeCompare(b)));
  }

  window.POKEDEX_MOVE_LOOKUP={lookup,names,normalize:normalizeApiSlug};
})();
