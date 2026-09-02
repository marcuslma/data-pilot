const starwars = db.getSiblingDB('starwars');

starwars.createUser({
  user: 'data_pilot',
  pwd: 'data_pilot',
  roles: [{ role: 'readWrite', db: 'starwars' }],
});

starwars.createCollection('characters');
starwars.createCollection('planets');

starwars.characters.createIndex({ slug: 1 }, { unique: true });
starwars.characters.createIndex({ episodes: 1 });
starwars.planets.createIndex({ slug: 1 }, { unique: true });
starwars.planets.createIndex({ episodes: 1 });

starwars.characters.insertMany([
  {
    slug: 'luke-skywalker',
    name: 'Luke Skywalker',
    episodes: ['IV', 'V', 'VI'],
    species: 'Human',
    homeworld: 'tatooine',
  },
  {
    slug: 'leia-organa',
    name: 'Leia Organa',
    episodes: ['IV', 'V', 'VI'],
    species: 'Human',
    homeworld: 'alderaan',
  },
  {
    slug: 'han-solo',
    name: 'Han Solo',
    episodes: ['IV', 'V', 'VI'],
    species: 'Human',
  },
  {
    slug: 'chewbacca',
    name: 'Chewbacca',
    episodes: ['IV', 'V', 'VI'],
    species: 'Wookiee',
  },
  {
    slug: 'darth-vader',
    name: 'Darth Vader',
    episodes: ['IV', 'V', 'VI'],
    species: 'Human',
  },
  {
    slug: 'obi-wan-kenobi',
    name: 'Obi-Wan Kenobi',
    episodes: ['IV'],
    species: 'Human',
  },
  {
    slug: 'c-3po',
    name: 'C-3PO',
    episodes: ['IV', 'V', 'VI'],
    species: 'Droid',
  },
  {
    slug: 'r2-d2',
    name: 'R2-D2',
    episodes: ['IV', 'V', 'VI'],
    species: 'Droid',
  },
  {
    slug: 'wilhuff-tarkin',
    name: 'Wilhuff Tarkin',
    episodes: ['IV'],
    species: 'Human',
  },
  {
    slug: 'owen-lars',
    name: 'Owen Lars',
    episodes: ['IV'],
    species: 'Human',
    homeworld: 'tatooine',
  },
  {
    slug: 'beru-whitesun-lars',
    name: 'Beru Whitesun Lars',
    episodes: ['IV'],
    species: 'Human',
    homeworld: 'tatooine',
  },
  {
    slug: 'wedge-antilles',
    name: 'Wedge Antilles',
    episodes: ['IV', 'V', 'VI'],
    species: 'Human',
  },
  {
    slug: 'biggs-darklighter',
    name: 'Biggs Darklighter',
    episodes: ['IV'],
    species: 'Human',
    homeworld: 'tatooine',
  },
  {
    slug: 'garven-dreis',
    name: 'Garven Dreis',
    episodes: ['IV'],
    species: 'Human',
  },
  {
    slug: 'dutch-vander',
    name: 'Dutch Vander',
    episodes: ['IV'],
    species: 'Human',
  },
  {
    slug: 'jek-porkins',
    name: 'Jek Porkins',
    episodes: ['IV'],
    species: 'Human',
  },
  {
    slug: 'greedo',
    name: 'Greedo',
    episodes: ['IV'],
    species: 'Rodian',
  },
  {
    slug: 'ponda-baba',
    name: 'Ponda Baba',
    episodes: ['IV'],
    species: 'Aqualish',
  },
  {
    slug: 'cornelius-evazan',
    name: 'Cornelius Evazan',
    episodes: ['IV'],
    species: 'Human',
  },
  {
    slug: 'conan-motti',
    name: 'Conan Motti',
    episodes: ['IV'],
    species: 'Human',
  },
  {
    slug: 'cassio-tagge',
    name: 'Cassio Tagge',
    episodes: ['IV'],
    species: 'Human',
  },
  {
    slug: 'jan-dodonna',
    name: 'Jan Dodonna',
    episodes: ['IV'],
    species: 'Human',
  },
  {
    slug: 'lando-calrissian',
    name: 'Lando Calrissian',
    episodes: ['V', 'VI'],
    species: 'Human',
  },
  {
    slug: 'yoda',
    name: 'Yoda',
    episodes: ['V', 'VI'],
    species: 'Unknown',
  },
  {
    slug: 'boba-fett',
    name: 'Boba Fett',
    episodes: ['V', 'VI'],
    species: 'Human',
  },
  {
    slug: 'palpatine',
    name: 'Palpatine',
    episodes: ['V', 'VI'],
    species: 'Human',
  },
  {
    slug: 'firmus-piett',
    name: 'Firmus Piett',
    episodes: ['V', 'VI'],
    species: 'Human',
  },
  {
    slug: 'kendal-ozzel',
    name: 'Kendal Ozzel',
    episodes: ['V'],
    species: 'Human',
  },
  {
    slug: 'maximilian-veers',
    name: 'Maximilian Veers',
    episodes: ['V'],
    species: 'Human',
  },
  {
    slug: 'dak-ralter',
    name: 'Dak Ralter',
    episodes: ['V'],
    species: 'Human',
  },
  {
    slug: 'lobot',
    name: 'Lobot',
    episodes: ['V'],
    species: 'Human',
  },
  {
    slug: 'dengar',
    name: 'Dengar',
    episodes: ['V'],
    species: 'Human',
  },
  {
    slug: 'ig-88',
    name: 'IG-88',
    episodes: ['V'],
    species: 'Droid',
  },
  {
    slug: 'bossk',
    name: 'Bossk',
    episodes: ['V'],
    species: 'Trandoshan',
  },
  {
    slug: '4-lom',
    name: '4-LOM',
    episodes: ['V'],
    species: 'Droid',
  },
  {
    slug: 'zuckuss',
    name: 'Zuckuss',
    episodes: ['V'],
    species: 'Gand',
  },
  {
    slug: 'mon-mothma',
    name: 'Mon Mothma',
    episodes: ['VI'],
    species: 'Human',
  },
  {
    slug: 'ackbar',
    name: 'Ackbar',
    episodes: ['VI'],
    species: 'Mon Calamari',
  },
  {
    slug: 'nien-nunb',
    name: 'Nien Nunb',
    episodes: ['VI'],
    species: 'Sullustan',
  },
  {
    slug: 'wicket-w-warrick',
    name: 'Wicket W. Warrick',
    episodes: ['VI'],
    species: 'Ewok',
    homeworld: 'endor',
  },
  {
    slug: 'bib-fortuna',
    name: 'Bib Fortuna',
    episodes: ['VI'],
    species: 'Twi\'lek',
  },
  {
    slug: 'jabba-desilijic-tiure',
    name: 'Jabba Desilijic Tiure',
    episodes: ['VI'],
    species: 'Hutt',
  },
  {
    slug: 'salacious-b-crumb',
    name: 'Salacious B. Crumb',
    episodes: ['VI'],
    species: 'Kowakian monkey-lizard',
  },
  {
    slug: 'arvel-crynyd',
    name: 'Arvel Crynyd',
    episodes: ['VI'],
    species: 'Human',
  },
]);

starwars.planets.insertMany([
  {
    slug: 'alderaan',
    name: 'Alderaan',
    episodes: ['IV'],
    classification: 'terrestrial planet',
    terrain: 'mountains and grasslands',
    climate: 'temperate',
  },
  {
    slug: 'bespin',
    name: 'Bespin',
    episodes: ['V'],
    classification: 'gas giant',
    terrain: 'gas giant',
    climate: 'temperate',
  },
  {
    slug: 'dagobah',
    name: 'Dagobah',
    episodes: ['V'],
    classification: 'terrestrial planet',
    terrain: 'swamp and jungle',
    climate: 'humid',
  },
  {
    slug: 'endor',
    name: 'Endor',
    episodes: ['VI'],
    classification: 'forest moon',
    terrain: 'forest',
    climate: 'temperate',
  },
  {
    slug: 'hoth',
    name: 'Hoth',
    episodes: ['V'],
    classification: 'terrestrial planet',
    terrain: 'tundra and ice caves',
    climate: 'frozen',
  },
  {
    slug: 'tatooine',
    name: 'Tatooine',
    episodes: ['IV', 'VI'],
    classification: 'terrestrial planet',
    terrain: 'desert',
    climate: 'arid',
  },
  {
    slug: 'yavin-iv',
    name: 'Yavin IV',
    episodes: ['IV'],
    classification: 'jungle moon',
    terrain: 'jungle and forest',
    climate: 'tropical',
  },
]);

const allowedEpisodes = ['IV', 'V', 'VI'];
const charactersCount = starwars.characters.countDocuments();
const planetsCount = starwars.planets.countDocuments();
const invalidEpisodes = starwars.characters.countDocuments({
  episodes: { $elemMatch: { $nin: allowedEpisodes } },
});
const invalidPlanetEpisodes = starwars.planets.countDocuments({
  episodes: { $elemMatch: { $nin: allowedEpisodes } },
});
const invalidHomeworlds = starwars.characters.aggregate([
  { $match: { homeworld: { $exists: true } } },
  {
    $lookup: {
      from: 'planets',
      localField: 'homeworld',
      foreignField: 'slug',
      as: 'planet',
    },
  },
  { $match: { planet: { $eq: [] } } },
]).toArray();

if (charactersCount !== 44 || planetsCount !== 7) {
  throw new Error(
    'Expected exactly 44 original-trilogy characters and 7 planetary bodies.',
  );
}

if (invalidEpisodes !== 0 || invalidPlanetEpisodes !== 0) {
  throw new Error('The Star Wars seed contains an unsupported episode.');
}

if (invalidHomeworlds.length !== 0) {
  throw new Error('A character homeworld does not exist in the planets fixture.');
}
