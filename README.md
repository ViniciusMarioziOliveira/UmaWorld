# UmaWorld

Jogo web **single player** de coleção e treino, inspirado em Uma Musume. Você anda pela Academia Tracen com a sua própria corredora, entra nos prédios para recrutar, treinar e cuidar da fazenda, e acompanha o servidor inteiro por um **Chat Global em tempo real**.

```
Luna conseguiu [5★ Mejiro McQueen] com 78 pity.
Mario alcançou Rank Ouro.
O servidor chegou a 10.000 pulls!
```

> Projeto de portfólio, feito por fã e sem fins lucrativos. Uma Musume Pretty Derby © Cygames, Inc.
> Dados e artes oficiais obtidos pela API pública do [umapyoi.net](https://umapyoi.net).

## O mundo

A tela principal é um mapa em visão de cima. A câmera segue a sua corredora, que é uma das personagens que você conseguiu no gacha (dá pra trocar a qualquer momento).

```
  [Templo]  [Loja] [Refeitório]   [ Academia Tracen ]   [Hall da Fama]   [Treino]
     |________|_________|_________________|________________|_______________|
   lago          mesas          [   Praça Central   ] ──── [Missões]    pista de treino
     |                                    |                       [Dormitório]
  [Fazenda]     [Casa] ─── jardim central ─┼─── [Armazém]   [Clube] [Jardim do Chá]
  ═══════════════════════ calçadão ══ [Mirante] ══ calçadão ════════════════════
  ~~~~~~~~ cerca: daqui para baixo é a Pista de Corrida, só para olhar ~~~~~~~~
```

- **Tamanho:** 3600×3360 px. Um **minimapa** no canto mostra tudo, e clicar nele leva a corredora até o ponto. No celular ele começa fechado.
- **Controles:** WASD ou setas para andar, Shift para correr e E para entrar ou falar. Também dá pra clicar ou tocar em qualquer ponto: a corredora acha o caminho sozinha (A* com desvio de obstáculos).
- **Entrar nos prédios:** clique no prédio ou passe pela porta. Ao voltar, a corredora reaparece na porta de onde saiu.
- **Velocidade:** o atributo Velocidade da corredora deixa a corrida no mapa um pouco mais rápida.
- **NPCs da Academia:**
  - a **Tazuna** abre o quadro de avisos;
  - a repórter **Etsuko** anuncia as 5★ do servidor em balões de fala;
  - a diretora **Yayoi** dá conselhos.
- **Umas pela Academia:** 15 personagens espalhadas pelo mapa, cada uma no seu canto:
  - a Special Week e a Oguri Cap no refeitório;
  - a Gold Ship pescando no lago;
  - a Fukukitaru lendo a sorte no Templo;
  - a Tokai Teio e a Agnes Tachyon na pista de treino, entre outras.
  
  Quando você chega perto, elas viram, dão um pulinho, mostram um ícone e puxam conversa. Com E, cada uma conta as suas falas. A Forever Young e a Marche Lorraine ficam na porta do Templo e levam você até o banner delas.
- **Pista de Corrida:** fica fora da cerca, grande o bastante para ser uma pista de verdade. Tem grama por fora e areia por dentro, arquibancada, poste de chegada, portão de largada e um telão anunciando a Dupla Estelar. Seis Umas correm voltas e se ultrapassam. No **Mirante**, no fim do eixo central, a câmera se afasta e desce para mostrar a pista inteira.
- **Outros jogadores online** aparecem passeando pela Praça com as corredoras deles. Se alguém tira uma 5★, um balão aparece sobre a cabeça dessa pessoa.

## Áreas

| Prédio | O que tem |
|---|---|
| **Praça Central** (quadro de avisos) | Atalhos, eventos ativos com contagem regressiva, avisos do servidor, jogadores online e estatísticas globais |
| **Templo da Sorte** (gacha) | Três banners: o Holofote (limitado, troca toda semana), a **Dupla Estelar** (limitado com duas 5★ em destaque, Forever Young e Marche Lorraine) e o permanente. Os dois limitados dividem o mesmo pity e a mesma garantia; na Dupla Estelar, ganhar o 50/50 ou usar a garantia entrega uma das duas, sorteada. Pity de 90 com pity suave a partir do 74, 4★ garantida a cada 10, regra 50/50 e histórico paginado. De 1 a 10 pulls por vez: tickets são gastos primeiro e o resto sai em carats (6 tickets + 600 carats fecham um 10x), e com 2 a 9 tickets aparece um botão para usar todos de uma vez. A revelação começa com um bilhete que você rasga: a luz do picote mostra a maior raridade (azul, roxa ou cromado holográfico na 5★), as cartas viram uma a uma e a arte da 5★ sai da própria carta |
| **Centro de Treinamento** | Nível com manuais (com prévia), treino de atributos, habilidades, ascensão em 4 estágios, equipamentos e **Ficha** com os dados oficiais (aniversário, altura, dormitório, curiosidades) |
| **Fazenda** | Produção por tempo, com limite de armazém e coleta. Ajudantes aumentam a eficiência. Dá pra melhorar a fazenda e o armazém |
| **Armazém** | Personagens, itens, materiais, equipamentos e moedas, com filtros |
| **Escritório de Missões** | Diárias, semanais e conquistas |
| **Loja** | Ofertas em moedas, carats e fragmentos, com limites por período, além de cosméticos e personagens específicas |
| **Sua Casa** | Nível e rank, título, moldura, favoritas, estatísticas, conquistas e coleção (as que faltam aparecem como silhueta) |
| **Hall da Fama** | Ranking por nível, personagens mais fortes, pulls, coleção e quantidade de 5★ |

## Stack

- **Backend:** Python 3.11+, FastAPI, SQLAlchemy 2, WebSocket nativo do Starlette.
- **Banco:** PostgreSQL no [Supabase](https://supabase.com), ou SQLite local se nenhum banco for configurado. A troca é feita só pelo `.env`. As tabelas são criadas sozinhas, com RLS ligado. Passo a passo em [GUIA_BANCO_DE_DADOS.md](GUIA_BANCO_DE_DADOS.md).
- **Autenticação:** apelido e senha, com bcrypt e JWT.
- **Frontend:** HTML, CSS e JavaScript puro com ES modules. Não tem etapa de build.
- **Mundo:** SVG desenhado em código (prédios, árvores, lago, pista e plantação) mais um motor próprio com movimento, colisão, A*, câmera com zoom e ordenação de profundidade. A arte das corredoras é uma imagem parada; o andar é procedural (quique no ritmo da velocidade, inclinação, troca de peso entre os pés e virada "de papel"). As NPCs viram para olhar quem chega perto, e as Umas passeiam, fazem ronda e puxam conversa.
- **Ícones:** [game-icons.net](https://game-icons.net) (CC BY 3.0) e [Phosphor](https://phosphoricons.com) (MIT), num único sprite SVG local.

## Como rodar (Windows / PowerShell)

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
uvicorn app.main:app --reload
```

Abra **http://127.0.0.1:8000** e crie uma conta. Para ver os outros jogadores na Praça e o Chat Global ao vivo, abra uma segunda janela anônima com outra conta.

> Se você já tinha um `umaworld.db` da versão anterior, ele é **migrado automaticamente** (coluna nova para a corredora do mundo e ícones antigos do feed convertidos).

### Testes

```powershell
pytest
```

42 testes cobrem gacha (pity, 50/50, a Dupla Estelar com pity compartilhado, cópias, pagamento misto de tickets e carats, pulls em lote), o WebSocket (anúncio de 5★ e presença com a corredora), Fazenda, missões, loja, treino, perfil, ranking, a troca de corredora, a ficha oficial, a migração de um banco da versão 1, a montagem da URL do Supabase, a cópia de jogadores do SQLite, o backup do banco e quantas leituras cada tela faz no banco (para nenhuma voltar a fazer uma consulta por item). Eles sempre usam um SQLite temporário, nunca o banco do `.env`.

## Dados do umapyoi.net (e por que eles ficam em JSON)

O jogo **nunca chama o umapyoi em tempo de execução**. A ferramenta `tools/sync_umapyoi.py` roda uma vez e salva tudo localmente:

```powershell
python -m tools.sync_umapyoi           # baixa só o que falta
python -m tools.sync_umapyoi --force   # baixa tudo de novo
```

- **`app/game/data/umas.json`**: cores oficiais, aniversário, altura, perfil, pontos fortes e fracos e curiosidades das 36 personagens e das 3 NPCs.
- **`static/img/umas/<id>/`**: as imagens de cada personagem, já recortadas e em WebP:
  - `icon` (avatar);
  - `card` (busto);
  - `sprite` (corpo inteiro pequeno, que anda no mundo);
  - `full` (corpo inteiro grande).

As artes oficiais ficam no CDN do microCMS, que aceita parâmetros de transformação. A ferramenta pede cada imagem já recortada (`trim=auto`), redimensionada e em WebP. A arte de corpo inteiro cai de **~680 KB** (PNG 1125×1980) para **~16 KB** (WebP 112×320). O conjunto inteiro tem uns 4,6 MB, e o navegador só baixa o que aparece na tela.

> As imagens pertencem à Cygames. Se preferir não versioná-las no Git, adicione `static/img/umas/` ao `.gitignore` e rode o sync no build do deploy.

Os ícones seguem a mesma ideia: `python -m tools.build_icons` monta `static/img/icons.svg` a partir da API do Iconify. Para adicionar um ícone, inclua uma linha no dicionário `ICONS` e rode o script de novo.

## Arquitetura

```
Navegador ── HTTP /api/* ──► FastAPI (rotas síncronas) ──► SQLAlchemy ──► PostgreSQL (Supabase) ou SQLite
    ▲                               │
    └──── WebSocket /ws ◄── Hub ◄───┘  (broadcast só depois do COMMIT)
```

- **Toda regra roda no servidor.** O sorteio, os custos e as recompensas são calculados no backend. Assim o "conseguiu 5★" do chat não pode ser forjado pelo console.
- **O feed é transacional.** O evento é gravado na mesma transação da ação, e só é publicado no WebSocket depois do commit (hook `after_commit`).
- **Não há gasto duplo.** As ações começam com um `UPDATE` na linha do jogador (`locked_user`), então dois cliques simultâneos são executados em sequência.
- **A presença carrega a corredora.** Cada conexão do WebSocket informa qual personagem anda pelo mundo. Quando alguém troca de corredora, todos recebem a atualização e a sprite muda na Praça.
- **O mundo roda no navegador.** O servidor não sabe onde cada pessoa está no mapa: é um jogo single player. Os outros jogadores passeiam pela Praça de forma aleatória, calculada em cada navegador.
- **A Fazenda não roda em loop.** O servidor guarda só a hora da última coleta, e a produção é `taxa × min(tempo, capacidade)`.

### Estrutura

```
app/
  main.py, config.py, database.py, models.py, migrate.py, realtime.py, security.py, schemas.py
  game/
    catalog.py       # personagens, itens, missões, loja e avisos: edite aqui
    registry.py      # catálogo em memória + dados oficiais (data/umas.json)
    data/umas.json   # gerado por tools/sync_umapyoi.py
    gacha.py, training.py, afk.py, missions.py, shop.py, rewards.py, progression.py, feed.py
  routers/           # um arquivo por área + ws.py
static/
  img/icons.svg      # sprite de ícones (tools/build_icons.py)
  img/umas/          # artes oficiais otimizadas (tools/sync_umapyoi.py)
  js/world/          # layout.js (mapa), art.js (SVG), engine.js (movimento, A*, câmera)
  js/views/          # uma tela por área + world.js
tools/               # sync_umapyoi.py, build_icons.py, migrar_sqlite.py
tests/
```

### Protocolo do WebSocket (`/ws?token=...`)

| Direção | Mensagem |
|---|---|
| servidor → cliente | `{"type": "hello", "feed": [...], "online": [{"nickname", "level", "avatar"}], "viewers": n}` |
| servidor → cliente | `{"type": "feed", "event": {"kind": "five_star", "icon": "star-burst", "nickname": "Luna", "message": "conseguiu [5★ ...] com 78 pity."}}` |
| servidor → cliente | `{"type": "presence", "online": [...], "viewers": n}` |
| cliente → servidor | `"ping"` |

## Deploy

O Chat Global e a presença online ficam na memória de **um único processo**, que precisa ficar ligado. Use **Render**, **Railway** ou **Fly.io**. A Vercel aceita WebSocket desde 2026 (em beta), mas espalha as conexões por várias cópias do servidor, e o Chat e a presença precisam de todos os jogadores no mesmo processo.

O caminho pronto é **Render + Supabase**. O `render.yaml` cria o Web Service e pede a URI e a senha do Supabase na criação do Blueprint. O passo a passo completo, com as tabelas, onde fica cada chave e como levar o progresso do SQLite (`python -m tools.migrar_sqlite`), está em **[GUIA_BANCO_DE_DADOS.md](GUIA_BANCO_DE_DADOS.md)**. Detalhes:

- rode **uma instância com um worker** (o `render.yaml` já usa `--workers 1`), porque a presença online fica na memória do processo;
- use a URI do **Session pooler** do Supabase: a conexão direta é só IPv6, e o Render só conecta por IPv4;
- o banco fica em **São Paulo**, e o Render não tem São Paulo: cada consulta leva uns 120 ms. O jogo foi ajustado para fazer poucas consultas por ação (um 10x leva uns 2,5 s, abrir a Praça, cerca de 1 s). Os números estão no começo da Parte D do guia;
- o Python (3.13) vem do `.python-version`, e as bibliotecas têm versões fixas no `requirements.txt`, as mesmas em que os testes passaram;
- o Supabase gratuito pausa o projeto depois de 7 dias sem uso. Para voltar, é só restaurar pelo painel;
- para guardar uma cópia do banco, rode `python -m tools.backup_banco`. O arquivo vai para `backups/`, que fica fora do Git.

## Créditos

- Uma Musume Pretty Derby © Cygames, Inc. Todas as artes e nomes das personagens pertencem à Cygames.
- Dados e imagens: [umapyoi.net](https://umapyoi.net).
- Ícones: [game-icons.net](https://game-icons.net) (Lorc, Delapouite e colaboradores, CC BY 3.0) e [Phosphor Icons](https://phosphoricons.com) (MIT).
- Fontes: Zen Maru Gothic e M PLUS Rounded 1c (Google Fonts, SIL OFL).
