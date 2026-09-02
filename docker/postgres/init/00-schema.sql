CREATE TABLE regions (
  id SMALLINT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  generation SMALLINT NOT NULL CHECK (generation = 1)
);

CREATE TABLE cities (
  id SMALLINT PRIMARY KEY,
  region_id SMALLINT NOT NULL REFERENCES regions(id),
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('town', 'city', 'island', 'plateau'))
);

CREATE TABLE pokemon (
  pokedex_number SMALLINT PRIMARY KEY CHECK (pokedex_number BETWEEN 1 AND 151),
  name TEXT NOT NULL UNIQUE,
  region_id SMALLINT NOT NULL REFERENCES regions(id)
);

CREATE TABLE pokemon_types (
  pokemon_id SMALLINT NOT NULL REFERENCES pokemon(pokedex_number) ON DELETE CASCADE,
  slot SMALLINT NOT NULL CHECK (slot IN (1, 2)),
  type_name TEXT NOT NULL CHECK (
    type_name IN (
      'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting',
      'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon'
    )
  ),
  PRIMARY KEY (pokemon_id, slot),
  UNIQUE (pokemon_id, type_name)
);

CREATE INDEX cities_region_id_idx ON cities(region_id);
CREATE INDEX pokemon_region_id_idx ON pokemon(region_id);
CREATE INDEX pokemon_types_type_name_idx ON pokemon_types(type_name);
