# TBA — Votação 2026

Aplicação para Vercel com banco no Google Planilhas via Apps Script. Sem dependências de pacotes. Node.js 22 ou superior.

## Regras implementadas

- Seleção: exatamente 1 goleiro e 6 jogadores de linha, com menus separados para cada etapa.
- Bola de Ouro: ranking de exatamente 10 atletas diferentes, incluindo goleiros. 1º recebe 10 pontos, 2º recebe 9, até o 10º receber 1 ponto. A apuração soma os pontos de todas as cédulas (55 pontos por cédula). A ordem escolhida é preservada na planilha.
- 54 atletas: 48 de linha e 6 goleiros. Junior (goleiro do Vermelho) é distinto de Junior Valenca (linha do Preto).
- Identificação por nome e seleção do time: Preto, Branco, Vermelho ou Azul.
- Nome e time são autodeclarados. Não há autenticação nem garantia de um voto por pessoa; eleitores podem fazer novos envios.
- Cada envio possui um UUID interno para impedir duplicação em uma tentativa de reenvio por falha de rede. Isso não é um código exigido do eleitor.
- Resultados públicos apenas após executar encerrarEApurar. Não há endpoint de apuração parcial.
- Classificação da Seleção ordenada por votos e da Bola de Ouro por pontos, com empates mantidos; a organização define o desempate.

## 1. Criar a planilha

Crie uma planilha vazia no Google Planilhas. Mantenha o compartilhamento **restrito** à organização.
Abra **Extensões → Apps Script**, substitua o conteúdo por google-apps-script/Code.gs e salve.

Em **Configurações do projeto → Propriedades do script**, adicione:

| Propriedade | Valor |
| --- | --- |
| SPREADSHEET_ID | Trecho entre /d/ e /edit na URL da planilha |
| SHARED_SECRET | Segredo aleatório longo (pelo menos 32 caracteres), usado apenas entre servidores |

Execute configurarPlanilha no editor e autorize o acesso à planilha. As abas e cabeçalhos abaixo serão criados automaticamente.

### Aba Jogadores

| Coluna | Significado |
| --- | --- |
| id_jogador | Identificador usado pelo sistema |
| time | Preto, Branco, Azul ou Vermelho |
| nome | Nome do atleta |
| posicao | Goleiro ou Linha |

Os 54 atletas são preenchidos pelo script. Alterar a aba não modifica a lista do sistema: alterações de elenco devem ser feitas em public/players.json e ATHLETES no Apps Script.

### Aba Votos

| Coluna | Significado |
| --- | --- |
| data_hora | Data e hora do registro |
| protocolo | Identificador único do voto |
| categoria | ballot: cédula com as duas categorias |
| nome_eleitor | Nome informado no formulário |
| time_eleitor | Time selecionado pelo eleitor |
| ids_jogadores | Objeto JSON com selection (7 IDs) e gold (10 IDs em ordem) |
| id_envio | UUID interno que impede duplicação do mesmo envio |

A aba é preenchida pelo sistema. Não altere nem remova registros durante a votação.

### Aba Resultados

| Coluna | Significado |
| --- | --- |
| categoria | selection ou gold |
| posicao | Goleiro ou Linha |
| id_jogador | ID do atleta |
| nome | Nome do atleta |
| time | Time |
| votos | Quantidade recebida na categoria |

Na aba Resultados, categoria continua sendo selection ou gold. Preenchida somente por encerrarEApurar. A Seleção deve ser interpretada como o goleiro mais votado e os 6 atletas de linha mais votados. O site exibe a classificação completa.

## 2. Publicar o Apps Script

1. Clique em **Implantar → Nova implantação → Aplicativo da Web**.
2. Executar como: **você**. Acesso: **qualquer pessoa** (a API exige o SHARED_SECRET).
3. Copie a URL que termina em /exec.
4. Não cole esse endereço nem o segredo no JavaScript do navegador.
5. Ao alterar o script, atualize a implantação para uma **nova versão**. Apenas salvar o código não atualiza o aplicativo publicado.

## 3. Publicar na Vercel

1. Envie esta pasta para um repositório GitHub da sua conta.
2. Na Vercel, crie um projeto importando esse repositório.
3. Framework Preset: **Other**. Build Command: **npm run build**. Output Directory: **public**. Não escolha public como Root Directory; a raiz deve conter api e package.json.
4. Use Node.js 22 ou superior.
5. Configure estas variáveis de ambiente no projeto:

| Variável | Valor |
| --- | --- |
| GOOGLE_SCRIPT_URL | URL /exec da implantação do Apps Script |
| GOOGLE_SCRIPT_SECRET | Mesmo valor de SHARED_SECRET |
| VOTING_OPEN | false durante a configuração; true para habilitar |

6. Publique. Mudanças nas variáveis exigem nova implantação.

## 4. Abrir, encerrar e apurar

- Depois de configurar a planilha, execute **abrirVotacao** no Apps Script.
- Defina **VOTING_OPEN=true** na Vercel e reimplante. A votação só aceita votos se estiver aberta nos dois lados.
- Faça uma votação de teste antes de abrir para o público. Para uma eleição real, prefira uma planilha nova para não misturar votos de teste.
- Para encerrar, execute **encerrarEApurar**. Isso bloqueia novos votos, calcula a classificação e libera os resultados no site. Atualize a página do site para vê-los.
- Por organização, depois defina VOTING_OPEN=false na Vercel e reimplante; o encerramento no Apps Script já bloqueia novos registros imediatamente.
- Reabrir preserva os votos existentes e oculta os resultados. Não use a mesma planilha para outra edição.
- A apuração é feita na planilha privada; somente a classificação com nomes de atletas e contagem é entregue ao público. Nomes e times dos eleitores não têm endpoint público.

## Desenvolvimento e verificação

Execute no terminal da pasta:

```text
npm run dev
npm test
npm run build
```

A prévia fica em http://127.0.0.1:3000. Sem configuração, é possível explorar os atletas e montar escolhas; o envio permanece desabilitado.
Para integração local, copie .env.example para .env.local e preencha os dados reais. Esse arquivo é ignorado pelo Git.

O backend valida as escolhas nos dois lados. O Apps Script usa LockService para serializar consulta e gravação e impedir registros duplicados do mesmo envio. Os testes automatizados verificam regras, validação de time, reenvio, duplicação e segredo da API, com mocks do Google. A conexão real com Google e Vercel precisa ser validada após criar os recursos.

Google Planilhas/Apps Script está sujeito às cotas da sua conta; esta solução foi preparada para votação de campeonato de pequeno porte.

Referências: https://vercel.com/docs/functions/runtimes/node-js e https://developers.google.com/apps-script/guides/web e https://developers.google.com/apps-script/reference/lock/

## Atualização do modelo anterior

A aba Eleitores deixou de ser necessária. Para uma planilha já criada com codigo_hash, mantenha uma cópia do histórico e use uma nova planilha com os cabeçalhos atuais. Não reutilize a aba Votos antiga sem migrar os dados. Atualize a implantação do Apps Script e as variáveis da Vercel para a nova planilha.

## Ranking da Bola de Ouro

Os atletas entram no ranking na ordem dos cliques. Use as setas para subir ou descer antes de confirmar. Só é possível enviar com 10 atletas distintos. O servidor calcula os pontos a partir da ordem; o navegador não envia a pontuação. O goleiro da Seleção fica em um menu próprio e não altera as opções da Bola de Ouro.

Se já houver votos do formato anterior de um único atleta, use uma planilha nova para a votação atual. A apuração recusa cédulas antigas de Bola de Ouro em vez de misturar regras. A aba Resultados agora possui a coluna G, pontos. Atualize a implantação do Apps Script antes de abrir a votação.

## Fluxo guiado e envio único

1. Montar a Seleção (goleiro e seis jogadores de linha).
2. Revisar a Seleção e continuar.
3. Montar o ranking da Bola de Ouro.
4. Revisar as duas categorias, informar nome/time e clicar em Enviar meus votos.

Voltar ou editar preserva as escolhas durante a sessão na página. Não há gravação nas revisões intermediárias. A API aceita apenas cédulas completas e grava as duas categorias em uma única linha da aba Votos, com categoria ballot e um único protocolo. Reenvios do mesmo id_envio devolvem o protocolo, sem duplicar. A apuração continua separando selection e gold nos resultados. A aba Resultados mantém categoria selection ou gold. Atualize a implantação do Apps Script ao publicar esta versão. As escolhas ficam em memória; atualizar ou fechar a página antes de enviar descarta o rascunho.

## Painel privado da organização

Acesse /admin para consultar cédulas completas, participação por time, últimas 20 cédulas e as classificações parciais. As parciais não são publicadas para os eleitores. O painel não altera, apaga, abre ou encerra a votação.

1. Em Vercel → Settings → Environment Variables, crie ADMIN_PASSWORD com a senha escolhida para o painel. Não coloque a senha no repositório, no frontend, na URL nem em SHARED_SECRET.
2. Reimplante a aplicação após configurar a variável.
3. Substitua o código do Apps Script pelo Code.gs atualizado. Salve, vá em Implantar → Gerenciar implantações → Editar → Nova versão → Implantar. Preserve as propriedades existentes e a URL /exec.
4. Entre em /admin com a senha configurada. A sessão dura 4 horas, usa cookie HttpOnly e SameSite=Strict, com Secure na Vercel. Sair apaga o cookie. Trocar ADMIN_PASSWORD invalida as sessões depois da nova implantação.
5. A atualização automática consulta a cada 30 segundos enquanto a página está visível e a opção está marcada. Também existe Atualizar agora.

Os rankings mostram votos na Seleção e pontos/indicações na Bola de Ouro. Empates recebem a mesma posição. Os totais contam cédulas, não pessoas únicas. Votos de teste existentes também entram na contagem. Login tem limite de tentativas por IP em cada instância da função; em múltiplas instâncias, o limite não é global. O endpoint público de resultados continua bloqueado antes do encerramento. O segredo entre Vercel e Apps Script também autoriza a consulta administrativa e deve permanecer privado.
