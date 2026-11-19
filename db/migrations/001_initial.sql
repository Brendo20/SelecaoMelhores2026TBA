CREATE TABLE election (
 id integer PRIMARY KEY CHECK (id=1),
 title text NOT NULL DEFAULT 'TBA 2026',
 is_open boolean NOT NULL DEFAULT false,
 results_published boolean NOT NULL DEFAULT false,
 CHECK (NOT (is_open AND results_published))
);
INSERT INTO election(id) VALUES(1);
CREATE TABLE players (
 id text PRIMARY KEY,
 name text NOT NULL,
 team text NOT NULL CHECK(team IN ('Preto','Branco','Vermelho','Azul')),
 position text NOT NULL CHECK(position IN ('line','goalkeeper'))
);
CREATE TABLE voters (
 id uuid PRIMARY KEY,
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 100),
 team text NOT NULL CHECK(team IN ('Preto','Branco','Vermelho','Azul')),
 role text NOT NULL CHECK(role IN ('capitao','organizacao','atleta','tecnico')),
 token_hash text NOT NULL UNIQUE,
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ballots (
 id uuid PRIMARY KEY,
 request_id uuid NOT NULL UNIQUE,
 voter_id uuid NOT NULL UNIQUE REFERENCES voters(id),
 name text NOT NULL,
 team text NOT NULL,
 role text NOT NULL CHECK(role IN ('capitao','organizacao','atleta','tecnico')),
 weight_units smallint NOT NULL,
 payload_hash text NOT NULL,
 excluded boolean NOT NULL DEFAULT false,
 exclusion_reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK (weight_units=CASE role WHEN 'capitao' THEN 4 WHEN 'organizacao' THEN 3 ELSE 2 END),
 CHECK (NOT excluded OR length(trim(exclusion_reason))>=3)
);
CREATE TABLE choices (
 ballot_id uuid NOT NULL REFERENCES ballots(id),
 category text NOT NULL CHECK(category IN ('selection','gold')),
 player_id text NOT NULL REFERENCES players(id),
 rank smallint,
 PRIMARY KEY(ballot_id,category,player_id),
 UNIQUE(ballot_id,category,rank),
 CHECK ((category='selection' AND rank IS NULL) OR (category='gold' AND rank BETWEEN 1 AND 10))
);
CREATE TABLE audit_events (
 id bigserial PRIMARY KEY,
 actor text NOT NULL,
 action text NOT NULL,
 target_id uuid,
 reason text NOT NULL,
 before_state jsonb,
 after_state jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ballots_created_at_idx ON ballots(created_at DESC);
CREATE INDEX choices_results_idx ON choices(category,player_id);
