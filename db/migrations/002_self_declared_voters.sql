-- Identificação autodeclarada: múltiplas cédulas por nome são permitidas.
-- Preserva registros anteriores e não altera pesos já registrados.
ALTER TABLE ballots ALTER COLUMN voter_id DROP NOT NULL;
ALTER TABLE ballots ALTER COLUMN team DROP NOT NULL;
ALTER TABLE ballots ADD COLUMN name_key text;
UPDATE ballots SET name_key=regexp_replace(regexp_replace(normalize(lower(trim(name)), NFD), U&'[\0300-\036f]', '', 'g'), '\s+', ' ', 'g');
ALTER TABLE ballots ALTER COLUMN name_key SET NOT NULL;
CREATE INDEX ballots_name_key_idx ON ballots(name_key);
