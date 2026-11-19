-- Organização é um time de identificação de eleitores, não de candidatos.
UPDATE ballots SET team='Organização' WHERE role='organizacao';
ALTER TABLE ballots ADD CONSTRAINT ballots_declared_team_check
 CHECK ((role='organizacao' AND team='Organização')
 OR (role<>'organizacao' AND (team IS NULL OR team IN ('Preto','Branco','Vermelho','Azul'))));
