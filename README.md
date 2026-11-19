# TBA 2026 — PostgreSQL / VM

Versão 2 em desenvolvimento na branch feat/postgres-vm. Domínio planejado: https://votacao-tba.estacaolab.com.br. A eleição começa vazia; os votos da planilha eram testes e não serão importados.

## Fluxo público

1. Informar nome, perfil e time, sem senha ou código.
2. Montar a Seleção: um goleiro e seis jogadores de linha.
3. Revisar a Seleção.
4. Montar o ranking da Bola de Ouro: dez atletas distintos em ordem.
5. Revisar tudo e enviar uma única cédula.

Perfis: capitão, organização, atleta e técnico. Quem seleciona organização recebe automaticamente o time Organização. Os demais escolhem Preto, Branco, Vermelho ou Azul. Organização é um time de identificação dos eleitores; não altera o elenco de candidatos.

Nome, perfil e time são autodeclarados. O sistema permite novos envios com o mesmo nome e os sinaliza para avaliação manual; não afirma que um nome corresponde a uma pessoa verificada. Maiúsculas, acentos e espaços são normalizados para sugerir possíveis duplicidades, sem excluir votos automaticamente.

Repetir a mesma requisição por falha de rede devolve o mesmo protocolo. Um novo envio intencional recebe um novo identificador e é registrado, mesmo com o mesmo nome.

## Cálculo interno

Os pesos de perfil são configurados somente no servidor: capitão 2×, organização 1,5×, atleta e técnico 1×. Eles não são mostrados nas telas públicas nem enviados em um mapa de pesos pela API pública. O eleitor só escolhe seu perfil, sem informar multiplicadores.

Seleção: cada indicação soma o peso da cédula. Bola de Ouro: posição-base de 10 a 1 ponto multiplicada pelo peso. A cédula preserva o perfil, o time e o peso aplicado no envio. O navegador não controla o valor numérico do peso.

A base armazena pesos em unidades inteiras (4,3,2,2) e usa somas exatas no PostgreSQL, convertidas para a escala de exibição no final.

## Admin

O painel continua protegido por senha. Somente a votação pública dispensa senha.

- Cédulas recebidas, válidas e desconsideradas.
- Participação válida por perfil e por time, incluindo Organização.
- Busca por nome/time e filtro de possíveis duplicidades.
- Nome, time, perfil informado, peso, data e alerta de repetições por cédula.
- Seleção em lote para desconsiderar/restaurar, sempre com motivo.
- Registros originais preservados e histórico das alterações.
- Classificações atualizadas a partir das cédulas válidas.
- Controles de abertura, encerramento e publicação.
- Histórico das últimas 100 ações na tela; histórico completo mantido no banco.

Nome repetido é um alerta, não prova de fraude. Desconsiderar retira a cédula inteira das duas eleições, sem apagar escolhas. Restaurar reinclui o peso original. Rankings e participação válida são recalculados; os resultados públicos também refletem alterações após publicação.

A atualização automática pausa quando há seleção de cédulas ou uma confirmação aberta. O painel não cadastra eleitores nem gera códigos nesta versão.

## Arquitetura e configuração

Caddy existente → container Node.js → PostgreSQL compartilhado, com banco e usuário exclusivos.

Rotas: /, /admin, /api/config, /api/vote, /api/results, /api/admin e /healthz. A pasta google-apps-script é somente referência histórica.

Variáveis do servidor, fora do Git:

| Variável | Uso |
| --- | --- |
| DATABASE_URL | Banco exclusivo PostgreSQL |
| APP_ORIGIN | Origem HTTPS exata, sem barra final |
| ADMIN_PASSWORD | Senha do admin |
| SESSION_SECRET | Segredo aleatório de 32 caracteres ou mais |
| APP_NETWORK_ALIAS | Alias do container na rede interna |
| APP_VERSION | Identificador da imagem |
| BACKUP_DIR | Pasta privada de backups no host |
| BACKUP_DB_HOST / NAME / USER / PASSWORD | Conexão do job de backup |

O servidor aplica cabeçalhos de segurança, não depende da Vercel e usa um pool de até cinco conexões. A sessão admin é HttpOnly, SameSite=Strict e Secure em HTTPS. Limites de tentativas são locais ao processo; revise-os antes de usar várias réplicas.

## Banco e migrations

- 001_initial.sql: estrutura inicial.
- 002_self_declared_voters.sql: permite cédulas sem cadastro prévio e adiciona chave normalizada de nome.
- 003_organization_team.sql: identifica eleitores da organização no time Organização.

As migrations preservam cédulas existentes. A estrutura antiga de voters é mantida por compatibilidade, mas não é usada no fluxo atual. Não edite migrations já aplicadas; crie novas.

## Desenvolvimento

Configure .env.local com banco local e a origem correta:

    npm ci
    npm run db:migrate
    npm run db:seed
    npm run dev

O seed inclui os 54 atletas, sem inserir cédulas. Os rascunhos do eleitor ficam só na memória da página e são descartados ao atualizar/fechar antes do envio.

## Verificação

    npm test
    npm run build

A integração real roda com TEST_DATABASE_URL apontando para um banco local descartável cujo nome termina em _test. Os testes limpam suas tabelas de teste.

Cobertura: pesos, time Organização automático, perfis inválidos, reenvios concorrentes, novos envios pelo mesmo nome, sugestões de duplicidade, moderação, auditoria, publicação e APIs HTTP.

## Produção

Veja deploy/PRODUCAO.md. A instalação será executada pelo usuário no shell de produção após conferir containers, rede, PostgreSQL e Caddy existentes. Nenhuma alteração remota foi aplicada.

Use um banco novo e vazio. Não importe os testes do Google. A votação antiga deve deixar de receber envios ao ativar a nova.

Antes de migrations futuras: backup, registrar commit, aplicar migration, publicar e conferir os fluxos. Nunca apague cédulas ou execute down -v como rollback. Não volte automaticamente para o Google depois de receber votos reais no PostgreSQL sem reconciliar os registros.

## Atualização dos goleiros

A migration 004 retira Junior (goleiro do Vermelho, goleiro-4) dos candidatos e inclui Rodolfo (Branco, goleiro-7). Os IDs não são reutilizados e votos antigos não são transferidos. Eventuais cédulas com atleta retirado são preservadas e sinalizadas no admin para revisão. O elenco ativo continua com 54 atletas e 6 goleiros.
