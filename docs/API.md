# Dokumentacja API — QuizyDB

Base URL: `http://localhost:3000/api`

Wszystkie endpointy wymagające autoryzacji przyjmują nagłówek:
```
Authorization: Bearer <jwt_token>
```

Token JWT zwracany jest przy rejestracji i logowaniu. Wygasa po czasie ustawionym w `JWT_EXPIRES_IN` (domyślnie 24h).

**Role użytkowników:** `student` | `instructor` | `admin`

---

## Spis treści

- [Auth](#auth)
- [Users](#users)
- [Groups](#groups)
- [Quizzes](#quizzes)
- [Questions](#questions)
- [Pools](#pools)
- [Attempts](#attempts)
- [Health](#health)
- [Kody błędów](#kody-błędów)

---

## Auth

### POST `/auth/register`

Rejestracja nowego użytkownika. Hasło hashowane przez `hash_password()` w PostgreSQL (pgcrypto, Blowfish).

**Body:**
```json
{
  "email": "jan@example.com",
  "username": "jan123",
  "password": "haslo1234",
  "first_name": "Jan",
  "last_name": "Kowalski",
  "role": "student"
}
```

> `role` może być `student` lub `instructor`. Każda inna wartość (w tym pominięcie) daje `student`.
> `first_name`, `last_name` są opcjonalne.

**Odpowiedź 201:**
```json
{
  "message": "Konto utworzone pomyslnie",
  "token": "<jwt>",
  "user": {
    "id": 1,
    "email": "jan@example.com",
    "username": "jan123",
    "role": "student"
  }
}
```

**Błędy:**
| Kod | Opis |
|---|---|
| 400 | Brak wymaganego pola lub hasło < 8 znaków |
| 409 | Email lub username już zajęty |

---

### POST `/auth/login`

Logowanie. Weryfikacja przez `verify_password()` w DB. Blokada po 5 nieudanych próbach (15 min).

**Body:**
```json
{
  "email": "jan@example.com",
  "password": "haslo1234"
}
```

**Odpowiedź 200:**
```json
{
  "token": "<jwt>",
  "user": {
    "id": 1,
    "email": "jan@example.com",
    "username": "jan123",
    "role": "student"
  }
}
```

**Błędy:**
| Kod | Opis |
|---|---|
| 400 | Brak email lub hasła |
| 401 | Nieprawidłowe dane logowania lub konto usunięte |
| 403 | Konto zablokowane przez administratora |
| 429 | Zbyt wiele nieudanych prób — konto tymczasowo zablokowane, zwraca `locked_until` |

---

### GET `/auth/me`

Dane zalogowanego użytkownika. Wymaga tokenu JWT.

**Odpowiedź 200:**
```json
{
  "id": 1,
  "email": "jan@example.com",
  "username": "jan123",
  "first_name": "Jan",
  "last_name": "Kowalski",
  "role": "student",
  "email_verified": false,
  "created_at": "2026-01-01T00:00:00.000Z"
}
```

---

### POST `/auth/forgot-password`

Wysyła email z linkiem resetu hasła (przez Resend). Odpowiedź jest zawsze taka sama — nie ujawnia czy email istnieje.

**Body:**
```json
{
  "email": "jan@example.com"
}
```

**Odpowiedź 200:**
```json
{
  "message": "Jesli email istnieje, wyslalismy link resetu"
}
```

> Link w emailu prowadzi do `${FRONTEND_URL}/reset?token=<uuid>`. Token ważny 15 minut.

---

### POST `/auth/reset-password`

Ustawia nowe hasło na podstawie tokenu z emaila. Wykonuje transakcję: zmiana hasła + oznaczenie tokenu jako użytego.

**Body:**
```json
{
  "token": "uuid-z-emaila",
  "password": "nowe-haslo-1234"
}
```

**Odpowiedź 200:**
```json
{
  "message": "Haslo zostalo zmienione pomyslnie"
}
```

**Błędy:**
| Kod | Opis |
|---|---|
| 400 | Brak tokenu/hasła, hasło < 8 znaków, lub token nieważny/wygasły |

---

## Users

### GET `/users` *(admin)*

Lista wszystkich użytkowników.

**Odpowiedź 200:** tablica obiektów użytkownika z polami: `id`, `email`, `username`, `first_name`, `last_name`, `role`, `email_verified`, `is_deleted`, `is_blocked`, `created_at`.

---

### GET `/users/:id`

Profil użytkownika. Student może widzieć tylko swój profil. Instruktor/admin może widzieć każdy.

**Odpowiedź 200:**
```json
{
  "id": 1,
  "email": "jan@example.com",
  "username": "jan123",
  "first_name": "Jan",
  "last_name": "Kowalski",
  "role": "student",
  "email_verified": false,
  "created_at": "2026-01-01T00:00:00.000Z"
}
```

---

### PUT `/users/:id`

Edytuj profil. Użytkownik może edytować tylko swój profil. Wszystkie pola opcjonalne — `COALESCE` w SQL nie zmienia pól których nie podano.

**Body:**
```json
{
  "first_name": "Jan",
  "last_name": "Kowalski",
  "username": "jan_nowy",
  "email": "nowy@example.com"
}
```

**Odpowiedź 200:** zaktualizowany obiekt użytkownika.

**Błędy:**
| Kod | Opis |
|---|---|
| 403 | Student próbuje edytować cudzy profil |
| 409 | Username już zajęty |

---

### PUT `/users/:id/password`

Zmiana hasła. Weryfikacja starego przez `verify_password()`, nowe hashowane przez `hash_password()`. Tylko właściciel konta.

**Body:**
```json
{
  "current_password": "stare-haslo",
  "new_password": "nowe-haslo-1234"
}
```

**Odpowiedź 200:**
```json
{ "message": "Hasło zmienione pomyślnie" }
```

**Błędy:**
| Kod | Opis |
|---|---|
| 400 | Brak pól lub nowe hasło < 8 znaków |
| 401 | Nieprawidłowe aktualne hasło |
| 403 | Próba zmiany hasła innego użytkownika |

---

### DELETE `/users/:id`

Soft delete konta (`is_deleted = true`). Dane pozostają w bazie. Użytkownik może usunąć swoje konto, admin może usunąć każde.

**Odpowiedź 200:**
```json
{ "message": "Konto zostało dezaktywowane" }
```

---

### PATCH `/users/:id/block` *(admin)*

Blokada lub odblokowanie konta.

**Body:**
```json
{ "is_blocked": true }
```

**Odpowiedź 200:**
```json
{ "message": "Konto zablokowane" }
```

---

## Groups

### GET `/groups`

Lista grup użytkownika. Instruktor widzi grupy które prowadzi (z liczbą studentów). Student widzi grupy do których należy (ze swoim statusem).

**Odpowiedź 200:** tablica obiektów grupy z polami: `id`, `name`, `join_code` *(tylko instruktor)*, `instructor_username`, `student_count`, `created_at`, oraz `my_status` (dla studenta).

---

### POST `/groups` *(instructor/admin)*

Utwórz nową grupę. Kod dołączenia generowany automatycznie (8 znaków alfanumerycznych, uppercase).

**Body:**
```json
{ "name": "Bazy danych 2026" }
```

**Odpowiedź 201:** pełny obiekt grupy z `join_code`.

---

### GET `/groups/:id`

Szczegóły grupy z listą członków. Student musi należeć do grupy. Instruktor musi być właścicielem.

**Odpowiedź 200:**
```json
{
  "id": 1,
  "name": "Bazy danych 2026",
  "join_code": "ABCD1234",
  "instructor_id": 2,
  "instructor_username": "prof_nowak",
  "created_at": "...",
  "members": [
    {
      "id": 5,
      "username": "jan123",
      "first_name": "Jan",
      "last_name": "Kowalski",
      "email": "jan@example.com",
      "status": "accepted",
      "joined_at": "..."
    }
  ]
}
```

---

### POST `/groups/join` *(student)*

Dołącz do grupy przez kod. Tworzy rekord z `status = 'pending'` — wymaga akceptacji instruktora.

**Body:**
```json
{ "join_code": "ABCD1234" }
```

**Odpowiedź 201:**
```json
{
  "message": "Prośba o dołączenie wysłana, oczekuj akceptacji instruktora",
  "group": { "id": 1, "name": "Bazy danych 2026" }
}
```

**Błędy:**
| Kod | Opis |
|---|---|
| 404 | Nieprawidłowy kod grupy |
| 409 | Już jesteś w tej grupie (podaje aktualny status) |

---

### PATCH `/groups/:id/members/:userId` *(instructor/admin)*

Akceptuj lub cofnij akceptację członka grupy.

**Body:**
```json
{ "status": "accepted" }
```

> `status` musi być `accepted` lub `pending`.

**Odpowiedź 200:** zaktualizowany rekord `group_users`.

---

### DELETE `/groups/:id/members/:userId` *(instructor/admin)*

Usuń użytkownika z grupy.

**Odpowiedź 200:**
```json
{ "message": "Użytkownik usunięty z grupy" }
```

---

## Quizzes

### GET `/quizzes`

Lista quizów. Instruktor widzi swoje quizy ze statystykami (z widoku `v_quiz_statistics`). Student widzi quizy ze swoich zaakceptowanych grup, w oknie czasowym (`visible_from`/`visible_until`), z liczbą własnych podejść.

**Odpowiedź 200:** tablica obiektów quizu. Pola instruktora zawierają: `question_count`, `attempt_count`, `student_count`, `avg_score`, `max_score`, `min_score`.

---

### POST `/quizzes` *(instructor/admin)*

Utwórz quiz. Obsługuje dwa tryby: ręczne pytania (pytania dodawane przez `/quizzes/:id/questions`) i tryb puli (`question_pool_id` + `draw_count`).

**Body:**
```json
{
  "title": "Kolokwium 1",
  "group_id": 1,
  "time_limit_sec": 1800,
  "max_attempts": 2,
  "visible_from": "2026-06-01T08:00:00Z",
  "visible_until": "2026-06-30T23:59:00Z",
  "is_draft": true,
  "question_pool_id": null,
  "draw_count": null
}
```

> `is_draft: true` (domyślnie) — quiz niewidoczny dla studentów dopóki nie zmienisz na `false`.
> `draw_count: 0` lub `null` — losuj wszystkie pytania z puli.

**Odpowiedź 201:** pełny obiekt quizu.

---

### GET `/quizzes/:id`

Szczegóły quizu z pytaniami i odpowiedziami. Studenci **nie widzą pola `is_correct`** w odpowiedziach. Studenci widzą tylko quizy do których mają dostęp (grupa + okno czasowe).

**Odpowiedź 200:**
```json
{
  "id": 1,
  "title": "Kolokwium 1",
  "group_id": 1,
  "time_limit_sec": 1800,
  "max_attempts": 2,
  "is_draft": false,
  "question_count": 10,
  "my_attempts": 1,
  "questions": [
    {
      "id": 5,
      "content": "Czym jest klucz obcy?",
      "question_type": "single",
      "position": 1,
      "answers": [
        { "id": 20, "content": "Ograniczenie integralności referencyjnej" },
        { "id": 21, "content": "Indeks bazy danych" }
      ]
    }
  ]
}
```

---

### PUT `/quizzes/:id` *(instructor/admin)*

Edytuj quiz. Wykonuje transakcję z `SET LOCAL app.editor_id` — trigger `trg_quiz_edit_log` automatycznie zapisuje historię zmian do `quiz_edit_history`.

**Body:** dowolne pola quizu (analogiczne do POST). Pola niepodane zachowują poprzednią wartość (`COALESCE`).

**Odpowiedź 200:** zaktualizowany obiekt quizu.

---

### POST `/quizzes/:id/questions` *(instructor/admin)*

Dodaj pytanie z banku pytań do quizu (tryb ręczny).

**Body:**
```json
{
  "question_id": 5,
  "position": 3
}
```

> `position` opcjonalna — domyślnie następna po ostatniej.

**Odpowiedź 201:**
```json
{ "message": "Pytanie dodane do quizu" }
```

---

### DELETE `/quizzes/:id/questions/:questionId` *(instructor/admin)*

Usuń pytanie z quizu.

**Odpowiedź 200:**
```json
{ "message": "Pytanie usuniete z quizu" }
```

---

### GET `/quizzes/:id/history` *(instructor/admin)*

Historia edycji quizu — zapisywana automatycznie przez trigger `trg_quiz_edit_log`.

**Odpowiedź 200:**
```json
[
  {
    "id": 1,
    "edited_at": "2026-06-01T10:30:00Z",
    "edited_by_username": "prof_nowak",
    "change_summary": "title: 'Stary tytuł' → 'Nowy tytuł'"
  }
]
```

---

## Questions

### GET `/questions` *(instructor/admin)*

Bank pytań — pytania stworzone przez instruktora plus pytania publiczne (`is_public = true`).

**Odpowiedź 200:** tablica pytań z polami: `id`, `content`, `latex_content`, `question_type` (`single`/`multiple`), `is_public`, `answer_count`, `created_by_username`, `created_at`.

---

### POST `/questions` *(instructor/admin)*

Utwórz pytanie z odpowiedziami. Transakcja: INSERT do `question_bank` + INSERT do `answer_options`.

**Body:**
```json
{
  "content": "Czym jest klucz główny?",
  "latex_content": null,
  "question_type": "single",
  "is_public": false,
  "answers": [
    { "content": "Unikalny identyfikator wiersza", "is_correct": true },
    { "content": "Nazwa tabeli", "is_correct": false },
    { "content": "Indeks pełnotekstowy", "is_correct": false }
  ]
}
```

> `question_type`: `single` (jedna odpowiedź) lub `multiple` (wiele odpowiedzi).
> Minimum 2 odpowiedzi, przynajmniej 1 musi być `is_correct: true`.

**Odpowiedź 201:** pytanie z osadzonymi odpowiedziami.

---

### GET `/questions/:id` *(instructor/admin)*

Szczegóły pytania z odpowiedziami (z `is_correct`).

---

### PUT `/questions/:id` *(instructor/admin)*

Edytuj pytanie. Jeśli podano `answers` — stare odpowiedzi są usuwane i zastępowane nowymi.

**Body:** analogiczne do POST, wszystkie pola opcjonalne.

**Odpowiedź 200:** zaktualizowane pytanie z odpowiedziami.

---

### DELETE `/questions/:id` *(instructor/admin)*

Usuń pytanie. Tylko właściciel lub admin.

**Błędy:**
| Kod | Opis |
|---|---|
| 409 | Pytanie używane w quizie — nie można usunąć |

---

## Pools

### GET `/pools` *(instructor/admin)*

Lista pul pytań instruktora z liczbą pytań i liczbą quizów które je używają.

**Odpowiedź 200:**
```json
[
  {
    "id": 1,
    "name": "Pula BD 2026",
    "description": "Pytania z baz danych",
    "question_count": 50,
    "used_in_quizzes_count": 3,
    "created_at": "..."
  }
]
```

---

### POST `/pools` *(instructor/admin)*

Utwórz pulę pytań.

**Body:**
```json
{
  "name": "Pula BD 2026",
  "description": "Pytania z baz danych"
}
```

**Odpowiedź 201:** pełny obiekt puli.

---

### GET `/pools/:id` *(instructor/admin)*

Szczegóły puli z listą pytań i statystykami (z widoku `v_question_pool_stats`).

**Odpowiedź 200:**
```json
{
  "id": 1,
  "name": "Pula BD 2026",
  "question_count": 50,
  "questions": [
    {
      "id": 5,
      "content": "Czym jest klucz obcy?",
      "question_type": "single",
      "is_public": false,
      "used_in_quizzes": 2,
      "times_answered": 15,
      "answer_count": 4,
      "answers": [...]
    }
  ]
}
```

---

### PUT `/pools/:id` *(instructor/admin)*

Zmień nazwę lub opis puli.

**Body:**
```json
{
  "name": "Nowa nazwa",
  "description": "Nowy opis"
}
```

---

### DELETE `/pools/:id` *(instructor/admin)*

Usuń pulę. Nie można usunąć puli używanej przez quiz.

**Błędy:**
| Kod | Opis |
|---|---|
| 409 | Pula używana przez quiz |

---

### POST `/pools/:id/questions` *(instructor/admin)*

Dodaj istniejące pytanie z banku do puli.

**Body:**
```json
{ "question_id": 5 }
```

---

### DELETE `/pools/:id/questions/:questionId` *(instructor/admin)*

Usuń pytanie z puli (nie usuwa pytania z banku).

---

### POST `/pools/:id/import` *(instructor/admin)*

Zbiorczy import pytań — tworzy pytania w `question_bank` i od razu dodaje do puli. Transakcja atomowa. Błędy poszczególnych pytań nie przerywają importu — zwracane są w tablicy `errors`.

**Body:**
```json
{
  "questions": [
    {
      "content": "Czym jest normalizacja?",
      "question_type": "single",
      "answers": [
        { "content": "Proces organizacji danych w bazie", "is_correct": true },
        { "content": "Tworzenie indeksów", "is_correct": false },
        { "content": "Backup bazy danych", "is_correct": false }
      ]
    }
  ]
}
```

**Odpowiedź 200:**
```json
{
  "message": "Zaimportowano 1 pytan",
  "imported": 1,
  "errors": []
}
```

---

## Attempts

### POST `/attempts` *(student)*

Rozpocznij podejście do quizu. Trigger `trg_attempt_randomize` automatycznie losuje kolejność pytań i zapisuje do `attempt_question_order`. Obsługuje blokadę race condition (`SELECT FOR UPDATE`).

**Body:**
```json
{ "quiz_id": 1 }
```

**Odpowiedź 201:**
```json
{
  "attempt": {
    "id": 10,
    "quiz_id": 1,
    "user_id": 5,
    "status": "in_progress",
    "started_at": "2026-06-01T10:00:00Z",
    "score": null,
    "finished_at": null
  },
  "quiz": {
    "id": 1,
    "title": "Kolokwium 1",
    "time_limit_sec": 1800
  },
  "questions": [
    {
      "id": 5,
      "content": "Czym jest klucz obcy?",
      "question_type": "single",
      "position": 1,
      "answers": [
        { "id": 20, "content": "Ograniczenie integralności referencyjnej" },
        { "id": 21, "content": "Nazwa tabeli" }
      ]
    }
  ]
}
```

**Błędy:**
| Kod | Opis |
|---|---|
| 403 | Quiz w drafcie, poza oknem czasowym, brak dostępu do grupy, lub wyczerpany limit podejść |
| 404 | Quiz nie istnieje |
| 409 | Aktywne podejście już istnieje — zwraca `attempt_id` i `time_remaining` |

---

### POST `/attempts/:id/answers` *(student)*

Zapisz odpowiedź na pytanie. Zastępuje poprzednią odpowiedź na to samo pytanie. Sprawdza czy pytanie należy do tego podejścia (z `attempt_question_order`).

**Body:**
```json
{
  "question_id": 5,
  "answer_ids": [20]
}
```

> Dla pytań `multiple` można podać wiele ID: `"answer_ids": [20, 22]`.

**Odpowiedź 200:**
```json
{ "message": "Odpowiedz zapisana" }
```

**Błędy:**
| Kod | Opis |
|---|---|
| 400 | Podejście zakończone, czas wygasł, lub pytanie nie należy do podejścia |
| 404 | Podejście nie znalezione |

---

### POST `/attempts/:id/finish` *(student)*

Zakończ podejście. Trigger `trg_attempt_auto_score` automatycznie oblicza wynik przez `calculate_attempt_score()` i ustawia `finished_at`. Wyniki pobierane z widoku `v_student_quiz_results`.

**Odpowiedź 200:**
```json
{
  "attempt": {
    "id": 10,
    "status": "completed",
    "score": 8,
    "finished_at": "2026-06-01T10:25:00Z"
  },
  "score": 8,
  "total_questions": 10,
  "percentage": 80,
  "status": "completed"
}
```

---

### GET `/attempts`

Historia podejść. Student widzi swoje podejścia. Instruktor widzi podejścia do swoich quizów. Opcjonalny filtr: `?quiz_id=1`.

**Odpowiedź 200:** tablica rekordów z widoku `v_student_quiz_results`: `attempt_id`, `quiz_id`, `quiz_title`, `user_id`, `username`, `score`, `total_questions`, `percentage`, `status`, `started_at`, `finished_at`.

---

### GET `/attempts/:id`

Szczegóły podejścia. Student może widzieć tylko swoje podejście. Dla zakończonych podejść zwraca też listę odpowiedzi z informacją czy były poprawne.

**Odpowiedź 200:**
```json
{
  "attempt_id": 10,
  "quiz_title": "Kolokwium 1",
  "score": 8,
  "total_questions": 10,
  "percentage": 80,
  "status": "completed",
  "answers": [
    {
      "question_id": 5,
      "question_content": "Czym jest klucz obcy?",
      "question_type": "single",
      "answer_id": 20,
      "answer_content": "Ograniczenie integralności referencyjnej",
      "is_correct": true,
      "position": 1
    }
  ]
}
```

---

## Health

### GET `/health`

Status serwera i połączenia z bazą danych.

**Odpowiedź 200:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-01T10:00:00.000Z",
  "database": "connected"
}
```

**Odpowiedź 503:** brak połączenia z bazą danych.

---

## Kody błędów

| Kod | Znaczenie |
|---|---|
| 400 | Bad Request — brakujące lub nieprawidłowe dane wejściowe |
| 401 | Unauthorized — brak tokenu lub nieprawidłowe dane logowania |
| 403 | Forbidden — brak uprawnień do zasobu |
| 404 | Not Found — zasób nie istnieje |
| 409 | Conflict — konflikt (duplikat, zasób w użyciu) |
| 429 | Too Many Requests — za wiele nieudanych prób logowania |
| 500 | Internal Server Error — błąd serwera |
| 503 | Service Unavailable — brak połączenia z bazą danych |

Wszystkie błędy zwracają JSON:
```json
{ "error": "Opis błędu" }
```
