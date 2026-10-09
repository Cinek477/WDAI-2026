// Dodaj swoje zdjęcia: src: 'assets/hobby/nazwa-zdjecia.jpg'.
// Wpisy z src: null są miejscami na kolejne fotografie.
window.portfolioPhotos = [
  {
    id: 'concert-1',
    category: 'concerts',
    shape: 'tall',
    src: 'assets/hobby/quebonafide-warszawa-2025-06-28.jpg',
    glowColor: 'rgba(54, 22, 220, 0.65)',
    title: {
      pl: 'Ostatni Koncert Quebonafide - Warszawa PGE Narodowy',
      en: 'Quebonafide Final Concert - Warsaw PGE Narodowy',
    },
    artist: 'Quebonafide',
    event: { pl: 'Ostatni koncert', en: 'Final concert' },
    place: { pl: 'PGE Narodowy - Warszawa', en: 'PGE Narodowy - Warsaw' },
    venue: 'PGE Narodowy',
    city: { pl: 'Warszawa', en: 'Warsaw' },
    date: '28.06.2025',
    description: {
      pl: 'Finałowy koncert wśród świateł i unoszącego się konfetti.',
      en: 'A final concert surrounded by lights and floating confetti.',
    },
  },
  {
    id: 'nature-1',
    category: 'nature',
    shape: 'wide',
    src: null,
    title: { pl: 'Natura / kadr 02', en: 'Nature / frame 02' },
  },
  {
    id: 'people-1',
    category: 'people',
    shape: 'regular',
    src: null,
    title: { pl: 'Ludzie / kadr 03', en: 'People / frame 03' },
  },
  {
    id: 'places-1',
    category: 'places',
    shape: 'tall',
    src: null,
    title: { pl: 'Miejsca / kadr 04', en: 'Places / frame 04' },
  },
  {
    id: 'concert-2',
    category: 'concerts',
    shape: 'tall',
    src: 'assets/hobby/mata-warszawa-2026-05-16.jpg',
    glowColor: 'rgba(220, 18, 64, 0.65)',
    title: {
      pl: 'Mata - Finał Mata2040 - PGE Narodowy - Warszawa',
      en: 'Mata - Mata2040 Finale - PGE Narodowy - Warsaw',
    },
    artist: 'Mata',
    event: { pl: 'Finał Mata2040', en: 'Mata2040 Finale' },
    place: { pl: 'PGE Narodowy - Warszawa', en: 'PGE Narodowy - Warsaw' },
    venue: 'PGE Narodowy',
    city: { pl: 'Warszawa', en: 'Warsaw' },
    date: '16.05.2026',
    description: {
      pl: 'Koncertowy kadr w czerwonym świetle sceny.',
      en: 'A concert frame in the red stage light.',
    },
  },
  {
    id: 'nature-2',
    category: 'nature',
    shape: 'regular',
    src: null,
    title: { pl: 'Natura / kadr 06', en: 'Nature / frame 06' },
  },
  {
    id: 'people-2',
    category: 'people',
    shape: 'tall',
    src: null,
    title: { pl: 'Ludzie / kadr 07', en: 'People / frame 07' },
  },
  {
    id: 'places-2',
    category: 'places',
    shape: 'wide',
    src: null,
    title: { pl: 'Miejsca / kadr 08', en: 'Places / frame 08' },
  },
];
// Opcjonalne pola każdego zdjęcia: artist, event, place, date, description.
// Teksty można podać jako { pl: '...', en: '...' } lub jako zwykły napis.
