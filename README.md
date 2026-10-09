<div align="center">

# Marcin Podyma · Portfolio

**Kod, fotografia i pomysły — w jednym miejscu.**

Responsywne portfolio z niebieskim motywem, interaktywną galerią<br />
i własnym panelem do zarządzania treścią.

![HTML5](https://img.shields.io/badge/HTML5-e34f26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572b6?style=flat-square&logo=css&logoColor=white)
![Vanilla JS](https://img.shields.io/badge/Vanilla_JS-f7df1e?style=flat-square&logo=javascript&logoColor=black)
![Node.js 24+](https://img.shields.io/badge/Node.js-24%2B-5fa04e?style=flat-square&logo=nodedotjs&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003b57?style=flat-square&logo=sqlite&logoColor=white)

[Wyróżniki](#wyrozniki) · [Uruchomienie](#start) · [Panel admina](#panel) · [Publikacja](#publikacja)

</div>

---

Portfolio łączy projekty i kompetencje z fotografią oraz zainteresowaniami po godzinach. Strona główna prezentuje osiągnięcia i aktualne prace, a osobne podstrony prowadzą do korepetycji, hobby i kontaktu. Treści galerii i projektów można zmieniać z panelu administratora, bez ręcznej edycji HTML.

<a id="wyrozniki"></a>

## ✨ Co wyróżnia stronę

| Rozwiązanie | Jak działa |
| :--- | :--- |
| **Poświata dopasowana do zdjęcia** | Canvas analizuje kolorystykę fotografii i wybiera dominujący odcień do neonowej poświaty w lightboxie. Czerwone światło sceny daje inną aurę niż niebieskie. Wyniki są buforowane, a zapisany kolor stanowi wariant zapasowy. |
| **Zmiana motywu jak fala** | Przejście między baby blue i navy blue rozchodzi się od góry ekranu dzięki View Transitions API. Ikona księżyca płynnie zmienia się w słońce. |
| **Nawigacja zamieniająca się w wyspę** | Podczas przewijania na komputerze pasek skraca się do samych linków. Na telefonie logo otwiera animowane menu. |
| **Galeria z poziomym przewijaniem** | Filtry pozwalają wybrać koncerty, naturę, ludzi lub miejsca. Powtarzane zestawy zdjęć tworzą wrażenie przewijania w pętli. |
| **Swipe & Info Bottom** | Na telefonie otwarte zdjęcia tworzą karuzelę ze scroll snap. Paginacja i szczegóły znajdują się pod fotografią oraz aktualizują po przesunięciu. |
| **Kafelki dopasowane do treści** | Karty projektów rozwijają szczegóły po najechaniu lub dotknięciu. Przy nieparzystej liczbie wpisów ostatni kafelek zajmuje pełną szerokość siatki na komputerze. |
| **Jedna treść, dwa sposoby publikacji** | Lokalnie strona korzysta z API i SQLite. Panel równolegle eksportuje dane do plików JS, które pozwalają wyświetlać portfolio na hostingu statycznym. |

### Detale, które budują całość

- **Glassmorphism** — półprzezroczyste elementy, rozmycie i delikatne ramki w obu motywach.
- **PL / EN** — przełączanie języka oraz zapamiętywanie języka i motywu w przeglądarce.
- **Czytelna metryczka** — koncerty mają artystę, wydarzenie, miejsce i datę; pozostałe kategorie pokazują miejsce oraz opcjonalny opis.
- **Dopasowanie tekstu** — Container Queries i skalowanie czcionki pomagają zmieścić długie wartości w kartach lightboxa.
- **Obsługa klawiatury** — strzałki zmieniają zdjęcia, Escape zamyka modal; po zamknięciu fokus wraca do galerii.
- **Mniej ruchu na życzenie** — strona uwzględnia ustawienie `prefers-reduced-motion`.
- **Szybki kontakt** — pływający przycisk prowadzi do kontaktu, a w sekcji powitalnej można pobrać CV.

<a id="start"></a>

## 🚀 Uruchomienie lokalne

**Wymagania:** Node.js 24 lub nowszy. Projekt korzysta z wbudowanych modułów Node.js, w tym SQLite — nie wymaga instalowania pakietów npm.

W folderze repozytorium uruchom:

```sh
npm start
```

Na Windows możesz też użyć skryptu, który wybierze lokalny runtime z `.local/`, jeśli jest dostępny:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-gallery.ps1
```

| Widok | Adres lokalny |
| :--- | :--- |
| Portfolio | [localhost:3000](http://localhost:3000) |
| Hobby i fotografia | [localhost:3000/hobby.html](http://localhost:3000/hobby.html) |
| Panel administratora | [localhost:3000/admin.html](http://localhost:3000/admin.html) |

Serwer nasłuchuje na `127.0.0.1`. Zatrzymasz go przez **Ctrl + C** w terminalu. Skrypt [stop-gallery.ps1](scripts/stop-gallery.ps1) służy do zatrzymania instancji uruchomionej w tle i zapisanej w pliku PID.

<a id="panel"></a>

## 🛠️ Panel administratora

Przy pierwszym wejściu ustaw własne hasło dla loginu **`admin`** — minimum 10 znaków. Następnie wybierz jedną z dwóch zakładek:

| Galeria zdjęć | Projekty |
| :--- | :--- |
| Dodawanie fotografii i usuwanie wpisów | Dodawanie, edycja i usuwanie projektów |
| Edycja tytułu, kategorii i metryczki | Tytuł, krótki i pełny opis, technologie oraz link |
| Miejsce i opcjonalny opis dla natury, ludzi i miejsc | Przypisanie do „Aktualnych projektów” lub „Projektów i kompetencji” |
| Opcjonalne teksty w języku angielskim | Dodawanie, podmiana i usuwanie zdjęcia z kafelka |
| Zmniejszanie nowych zdjęć do maks. 2400 px | Rok, symbol kafelka i opcjonalna wersja angielska |

Hasło jest przechowywane jako skrót **scrypt z losową solą**. Sesja używa ciasteczka `HttpOnly` i `SameSite=Strict`, trwa do 8 godzin i wygasa po restarcie serwera. Operacje zmieniające dane wymagają logowania oraz zgodnego nagłówka `Origin`.

Panel i API służą do pracy lokalnej. Na hostingu statycznym można przeglądać wyeksportowane treści; zarządzanie nimi odbywa się przez lokalny serwer.

<a id="publikacja"></a>

## 📦 Od panelu do GitHuba

```mermaid
flowchart LR
    A[Panel administratora] --> B[(Lokalna baza SQLite)]
    B --> C[Eksport galerii i projektów do JS]
    A --> D[Zdjęcia w assets/uploads]
    C --> E[Commit i push]
    D --> E
    E --> F[Portfolio na hostingu statycznym]
```

Po zapisaniu zmian panel aktualizuje pliki:

- `assets/js/gallery-data.js` — zdjęcia i ich metryczki.
- `assets/js/projects-data.js` — projekty i kompetencje.
- `assets/uploads/` — obrazy dodane przez panel.

**Publikacja wymaga commita i pusha.** Panel nie wysyła zmian automatycznie na GitHub. Po skonfigurowaniu GitHub Pages strona może korzystać z eksportów bez uruchomionego backendu.

Baza w `data/`, hasło administratora oraz lokalny runtime w `.local/` są wykluczone z Git. Usunięcie wpisu z panelu pozostawia jego zdjęcie na dysku. Szczegóły pracy z bazą i kopii zapasowych opisuje [LOCAL-GALLERY.md](LOCAL-GALLERY.md).

## 🗂️ Struktura projektu

```text
├── index.html              # Portfolio: projekty i kompetencje
├── knowledge.html          # Korepetycje
├── hobby.html              # Hobby, galeria i lightbox
├── contact.html            # Kontakt
├── admin.html              # Panel: galeria + projekty
├── server.cjs              # Lokalny serwer, API i SQLite
├── assets/
│   ├── css/                # Style podstron i komponentów
│   ├── js/                 # Interakcje, panel i eksporty danych
│   ├── images/             # Portret
│   ├── hobby/              # Początkowe zdjęcia galerii
│   └── uploads/            # Zdjęcia dodane przez panel
├── data/                   # Lokalna baza — poza Git
├── scripts/                # Uruchamianie i kontrola projektu
└── tests/                  # Testy API, danych i eksportów
```

## ✅ Sprawdzanie projektu

```sh
npm run check
npm test
```

- `check` sprawdza składnię JavaScript, odnośniki, kotwice, identyfikatory HTML i pliki zdjęć galerii.
- `test` weryfikuje zapis i trwałość danych, eksporty, logowanie, kontrolę dostępu oraz operacje na zdjęciach i projektach. Testy korzystają z osobnych, tymczasowych baz.

Zasady formatowania znajdują się w [.editorconfig](.editorconfig) i [.prettierrc.json](.prettierrc.json).

---

<div align="center">

**Marcin Podyma** · [Instagram @47.cinek](https://www.instagram.com/47.cinek/)

</div>
