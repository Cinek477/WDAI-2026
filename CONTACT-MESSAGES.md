# Wiadomości z formularza

Formularz na `contact.html` zapisuje wiadomości przez `POST /api/contact` w lokalnej bazie SQLite. Po zalogowaniu otwórz zakładkę **Wiadomości** w panelu: zobaczysz treść, e-mail, temat, datę, stan przeczytania i status powiadomienia pocztowego. Skrzynka odświeża się co 30 sekund; przycisk „Odśwież” pobiera wiadomości od razu. Link „Odpowiedz” otwiera aplikację pocztową.

Wiadomości są prywatne: API wymaga zalogowania do odczytu, a eksporty galerii i projektów ich nie zawierają. Nie trafiają na GitHub. Kopia folderu `data/` po zatrzymaniu serwera obejmuje również skrzynkę.

## Powiadomienia na pocztę

Integracja korzysta z [API Resend](https://resend.com/docs/api-reference/emails/send-email), bez dodatkowych pakietów npm.

1. Utwórz konto Resend i klucz API z uprawnieniem wysyłania.
2. Skopiuj `.env.example` do `.env` w katalogu projektu.
3. Wpisz klucz do `RESEND_API_KEY` oraz zaakceptowany przez Resend adres nadawcy do `CONTACT_MAIL_FROM`. Dla własnej domeny nadawcy wymagana jest jej weryfikacja w Resend. Przy testowym nadawcy `onboarding@resend.dev` obowiązują ograniczenia usługi, w tym wysyłka do adresu konta Resend.
4. Odbiorca `CONTACT_MAIL_TO` jest ustawiony na `podyma.marcin33@gmail.com`.
5. Zrestartuj lokalny serwer. Panel pokaże, czy konfiguracja poczty jest obecna.

Klucza nie wpisuj do HTML/JS przeglądarki ani na czacie. `.env` jest wykluczony z Git i niedostępny przez lokalny serwer.

Wiadomość zapisuje się także wtedy, gdy powiadomienie pocztowe się nie powiedzie. Panel pokazuje błąd i pozwala ponowić powiadomienie. Status „przyjęte przez pocztę” oznacza przyjęcie przez usługę wysyłającą, a nie potwierdzenie dostarczenia do skrzynki. Adres nadawcy formularza jest ustawiany jako Reply-To; odbiorca powiadomienia jest zawsze brany z konfiguracji serwera.

## Zakres lokalny

Wysyłanie działa przez lokalny serwer, np. `http://localhost:3000/contact.html`. GitHub Pages nie uruchamia tego API. Publiczne przyjmowanie wiadomości wymaga osobnego wdrożenia backendu. Formularz ogranicza rozmiar danych i liczbę nowych zgłoszeń do 5 na 15 minut z jednego adresu; ponowienie identycznego żądania z tym samym identyfikatorem nie tworzy duplikatu.
