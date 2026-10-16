# Backend portfolio w Sites

Źródło wspólnego interfejsu jest w nadrzędnym repozytorium. Zasady pracy i publikacji: [SITES.md](../SITES.md).

Ten folder zawiera kod API Workers, schemat oraz migracje D1, obsługę zdjęć R2 i integrację logowania Sites. Dane online nie są synchronizowane z lokalną bazą. Powiadomienia e-mail nie są skonfigurowane; formularz zapisuje zgłoszenia w prywatnej skrzynce.

Przed testami i budowaniem uruchom `npm run sites:prepare` z głównego katalogu repozytorium. Nie edytuj generowanych `public/`, `lib/normalize.js` ani `lib/seed.json`.

Samodzielny checkout publikacyjny jest przygotowywany przez `scripts/stage-sites.cjs`; zawiera gotowe pliki wejściowe i może być budowany niezależnie od GitHuba. W takim checkoutcie `npm run build` oraz `node --test api.test.mjs` działają bez nadrzędnego repozytorium.
