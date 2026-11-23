# Instalação na VM de produção — TBA 2026

Execução pelo usuário no Oracle Cloud Shell/SSH. Nenhum voto da planilha será importado.

## 1. Auditoria sem alterar serviços

Execute na VM de produção e confira o resultado antes de criar recursos:

    hostname
    uname -m
    free -h
    df -h /
    docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'
    docker network ls
    docker network inspect portais-net --format '{{range .Containers}}{{println .Name}}{{end}}'
    find /srv/portais/infra -maxdepth 3 -type f -name '*Caddyfile*'
    find /srv/portais/projetos -maxdepth 2 -name compose.yml -o -name docker-compose.yml

Não envie .env, docker inspect completo, senhas, tokens ou chaves privadas. Confirme o nome do container PostgreSQL, a rede, o caminho do Caddyfile e a imagem/versão do PostgreSQL. Os comandos abaixo pressupõem os nomes portais-postgres e portais-net descritos no documento; adapte apenas após a auditoria.

## 2. Banco e usuário exclusivos

No terminal interativo:

    docker exec -it portais-postgres psql -U postgres

Confira antes se os nomes já existem. Crie somente se não existirem:

    CREATE ROLE tba_votacao_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
    \password tba_votacao_app
    CREATE DATABASE tba2026 OWNER tba_votacao_app;
    ALTER ROLE tba_votacao_app LOGIN;
    \q

O comando \password solicita a senha sem gravá-la na linha de comando. Se a autenticação do container ou seu administrador tiver outro nome, use a configuração existente. Não use bancos dos outros portais.

## 3. Código versionado

Somente se a pasta de destino ainda não existir:

    cd /srv/portais/projetos
    git clone --branch feat/postgres-vm https://github.com/Brendo20/SelecaoMelhores2026TBA.git tba-votacao
    cd tba-votacao
    git status --short --branch
    git log -1 --oneline

Se a pasta já existir, verifique remote, branch e alterações antes de fazer checkout/pull. Não use reset ou limpeza forçada. Para uma atualização, fixe e registre o commit implantado.

## 4. Configuração privada

    cp .env.example .env
    chmod 600 .env
    nano .env

Preencha DATABASE_URL com host interno portais-postgres, usuário tba_votacao_app e banco tba2026. A senha na URI precisa estar percent-encoded caso contenha caracteres especiais. APP_ORIGIN=https://votacao-tba.estacaolab.com.br.

Gere SESSION_SECRET aleatório, configure ADMIN_PASSWORD e não envie esses valores pelo chat nem os coloque no Git.

## 5. Build, migration e seed

    docker compose build app
    docker compose run --rm --no-deps app node scripts/migrate.mjs
    docker compose run --rm --no-deps app node scripts/seed.mjs
    docker compose up -d app
    docker compose ps

O estado inicial é fechado e não publicado. O seed insere atletas; não cria eleitores nem votos.

Para validar sem expor porta, dentro do container:

    docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/healthz').then(async r=>{console.log(r.status,await r.text());process.exit(r.ok?0:1)})"

## 6. Caddy e DNS

- Crie o registro A de votacao-tba.estacaolab.com.br apontando para o IP público confirmado da VM de produção. Confira também registros AAAA para não manter destino IPv6 incorreto.
- Faça uma cópia do Caddyfile existente antes de editar.
- Acrescente o bloco de deploy/Caddyfile.example ao arquivo existente. Não substitua os blocos dos outros portais.
- O Caddy e a aplicação precisam participar de portais-net.
- Valide o Caddyfile antes de recarregar. O container, comando e caminho exatos dependem da auditoria.
- Teste HTTPS, /admin e /api/config, além dos portais existentes.

## 7. Conferência funcional

Antes de compartilhar o link da votação:

- Login do admin funciona e não permite parciais sem sessão.
- Na votação pública, informe um nome de teste, perfil e time. Confira que Organização seleciona automaticamente o time Organização e que os pesos não aparecem.
- Abra a votação pelo admin, envie Seleção e ranking e confira o peso somente no painel privado. Faça um novo envio com o mesmo nome e confira o alerta de possível duplicidade.
- Desconsidere a cédula de teste com motivo e confira todos os totais.
- Mantenha as cédulas de teste desconsideradas: não apague seu histórico. Não há cadastro prévio nem códigos no fluxo atual.
- Abra para os eleitores reais somente depois da conferência.

A versão antiga da planilha não deve continuar recebendo votos. Encerrar seu recebimento não exige apagar dados da planilha.

## 8. Backup e atualização

Configure BACKUP_DB_PASSWORD no .env com a senha original do usuário do banco. BACKUP_DB_HOST, BACKUP_DB_NAME e BACKUP_DB_USER devem corresponder ao banco criado. Use valores entre aspas simples no .env para preservar caracteres especiais. Crie/confira BACKUP_DIR no host e restrinja o acesso aos dumps. Depois:

    docker compose --profile tools run --rm --no-deps backup

O serviço usa pg_dump em formato custom. Verifique o arquivo gerado e programe cópia para fora da VM, com retenção e teste de restauração em um banco separado. Não restaure sobre produção para testar.

Antes de migrations futuras: backup → registrar commit → aplicar migration → subir a versão → verificar saúde e fluxos. A migration inicial é aditiva e cria somente tabelas no banco exclusivo.

## 9. Rollback

- Registre a tag/commit e a imagem anteriores.
- Não execute down -v, não apague banco, não apague cédulas.
- Se houver erro após abertura, encerre novos envios antes de intervir.
- Esta migração começa sem votos da planilha. Não volte automaticamente para o Google depois de receber votos no PostgreSQL, porque isso dividiria os registros.
- Para esta primeira entrada em produção, rollback operacional significa manter a eleição fechada e corrigir/reimplantar. Se for indispensável voltar ao sistema antigo, reconcilie explicitamente os votos recebidos.
- Em versões futuras, prefira migrations compatíveis com a imagem anterior; restauração de dump só com análise dos votos posteriores ao backup.

## Atualização: botão Ver voto

Esta atualização não muda o schema e não requer migration nem seed.

Na pasta do projeto da VM, confira alterações locais e depois execute um comando de cada vez:

    git status --short --branch
    git pull --ff-only origin feat/postgres-vm
    docker compose build app
    docker compose up -d --no-deps app
    docker compose exec -T app node -e "fetch('http://127.0.0.1:3000/healthz').then(async r=>{console.log(r.status,await r.text());process.exit(r.ok?0:1)})"

Se algum comando falhar, interrompa e confira a mensagem antes de continuar. Depois atualize a página /admin e use Ver voto na lista de cédulas. Somente o container da aplicação é recriado; banco e Caddy não precisam ser reiniciados.
