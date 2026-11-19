-- Mantém os IDs antigos para não transferir votos entre pessoas.
ALTER TABLE players ADD COLUMN active boolean NOT NULL DEFAULT true;
UPDATE players SET active=false WHERE id='goleiro-4';
INSERT INTO players(id,name,team,position,active)
 VALUES('goleiro-7','Rodolfo','Branco','goalkeeper',true);
