# QuizyDB — Platforma quizów edukacyjnych

Webowa platforma quizów oparta na bazie danych PostgreSQL, zaprojektowana jako projekt zaliczeniowy z baz danych na Politechnice Wrocławskiej. System demonstruje zaawansowane funkcje baz danych: triggery, widoki, funkcje składowane i pgcrypto.

---

## Spis treści

- [Architektura](#architektura)
- [Funkcje bazy danych](#funkcje-bazy-danych)
- [Technologie](#technologie)
- [Szybki start](#szybki-start)
- [Zmienne środowiskowe](#zmienne-środowiskowe)
- [Skrypty](#skrypty)
- [Trasy frontendu](#trasy-frontendu)
- [API](#api)
- [Autorzy](#autorzy)

---

## Architektura

```
Frontend (Vue 3)  →  Backend (Node.js/Express)  →  PostgreSQL
```

Backend jest **cienką warstwą** — wykonuje surowe zapytania SQL bez ORM. Większość logiki biznesowej (hashowanie haseł, obliczanie wyników, losowanie pytań, historia edycji) dzieje się **w bazie danych** przez triggery i funkcje składowane.

---

## Funkcje bazy danych

To jest centralny punkt projektu — demonstracja zaawansowanych cech PostgreSQL.

### Triggery

| Trigger | Tabela | Zdarzenie | Działanie |
|---|---|---|---|
| `trg_users_updated_at` | `users` | BEFORE UPDATE | Automatycznie ustawia `updated_at = NOW()` |
| `trg_quizzes_updated_at` | `quizzes` | BEFORE UPDATE | Automatycznie ustawia `updated_at = NOW()` |
| `trg_attempt_randomize` | `quiz_attempts` | AFTER INSERT | Wypełnia `attempt_question_order` losową kolejnością pytań (uwzględnia `draw_count` z puli) |
| `trg_attempt_auto_score` | `quiz_attempts` | BEFORE UPDATE (status→completed/expired) | Wywołuje `calculate_attempt_score()` i ustawia `finished_at` |
| `trg_quiz_edit_log` | `quizzes` | AFTER UPDATE | Zapisuje diff zmian do `quiz_edit_history`, czyta ID edytora z `app.editor_id` |

### Funkcje składowane

| Funkcja | Opis |
|---|---|
| `hash_password(plain TEXT)` | Hashuje hasło algorytmem Blowfish przez pgcrypto |
| `verify_password(plain TEXT, hash TEXT)` | Weryfikuje hasło w czasie stałym |
| `calculate_attempt_score(attempt_id INT)` | Oblicza wynik podejścia na podstawie `user_answers` i `answer_options` |
| `fn_randomize_attempt_questions()` | Funkcja triggera — losuje pytania z puli lub quizu |
| `fn_auto_score_attempt()` | Funkcja triggera — oblicza i zapisuje wynik |
| `fn_log_quiz_edit()` | Funkcja triggera — buduje i zapisuje summary zmian |
| `fn_update_timestamp()` | Funkcja triggera — aktualizuje `updated_at` |

### Widoki

| Widok | Opis |
|---|---|
| `v_quiz_statistics` | Statystyki quizów: liczba pytań, podejść, studentów, avg/max/min score |
| `v_student_quiz_results` | Wyniki podejść studentów z procentem i statusem |
| `v_question_pool_stats` | Statystyki pul pytań: liczba pytań, użycia w quizach |
| `v_login_activity` | Historia logowań użytkowników |

### Bezpieczeństwo w bazie

- Hasła hashowane przez `hash_password()` (pgcrypto, Blowfish) — bcrypt nie jest używany w aplikacji
- Blokada konta po 5 nieudanych próbach logowania w ciągu 15 minut (tabela `login_attempts`)
- Tokeny resetu hasła wygasają po 15 minutach (`TIMESTAMPTZ`, `expires_at`)
- Soft delete użytkowników (`is_deleted = true`) — dane nie są usuwane z bazy

---

## Technologie

### Backend
- Node.js 18+
- Express 4
- PostgreSQL 14+
- node-postgres (`pg`) — surowe SQL, bez ORM
- JSON Web Tokens (`jsonwebtoken`)
- Resend — wysyłanie emaili (reset hasła)
- dotenv

### Frontend
- Vue 3 (Composition API)
- Vue Router
- Axios
- Vite

---

## Szybki start

### Wymagania
- Node.js 18+
- PostgreSQL 14+ (z rozszerzeniem pgcrypto)
- Konto Resend (do resetowania hasła przez email)

### 1. Klonowanie i instalacja

```bash
git clone https://github.com/Electro5218/quizy-bazydanych.git
cd quizy-bazydanych

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Konfiguracja zmiennych środowiskowych

```bash
cd backend
cp .env.example .env
# Uzupełnij wartości w .env
```

### 3. Inicjalizacja bazy danych

```bash
cd backend
npm run db:init    # Tworzy tabele, triggery, widoki, funkcje
npm run db:seed    # Wypełnia przykładowymi danymi
```

### 4. Uruchomienie

```bash
# Backend (port 3000)
cd backend
npm run dev

# Frontend (port 5173) — w osobnym terminalu
cd frontend
npm run dev
```

Otwórz: http://localhost:5173

---

## Zmienne środowiskowe

Plik `backend/.env` (szablon w `backend/.env.example`):

| Zmienna | Opis | Przykład |
|---|---|---|
| `DATABASE_URL` | Connection string PostgreSQL | `postgresql://user:pass@localhost:5432/quizy` |
| `JWT_SECRET` | Sekret do podpisywania tokenów JWT | `tajny-klucz-min-32-znaki` |
| `JWT_EXPIRES_IN` | Czas ważności tokenu | `24h` |
| `RESEND_API_KEY` | Klucz API Resend (reset hasła) | `re_...` |
| `RESEND_FROM` | Adres nadawcy emaili | `noreply@twojadomena.com` |
| `FRONTEND_URL` | URL frontendu (CORS + linki w emailach) | `http://localhost:5173` |
| `PORT` | Port backendu | `3000` |
| `NODE_ENV` | Środowisko | `development` |

---

## Skrypty

### Backend (`cd backend`)

| Komenda | Opis |
|---|---|
| `npm run dev` | Uruchom serwer deweloperski (nodemon) |
| `npm start` | Uruchom serwer produkcyjny |
| `npm run db:init` | Utwórz schemat bazy (tabele, triggery, widoki, funkcje) |
| `npm run db:seed` | Wypełnij bazę przykładowymi danymi |
| `npm run db:reset` | **Usuń cały schemat** i utwórz go od nowa (⚠️ niszczy dane) |

### Frontend (`cd frontend`)

| Komenda | Opis |
|---|---|
| `npm run dev` | Uruchom serwer deweloperski Vite |
| `npm run build` | Zbuduj wersję produkcyjną |
| `npm run preview` | Podgląd wersji produkcyjnej |

---

## Trasy frontendu

| Ścieżka | Widok | Dostęp |
|---|---|---|
| `/` | `HomeView` | Publiczny |
| `/login` | `LoginView` | Publiczny |
| `/register` | `RegisterView` | Publiczny |
| `/reset` | `PassResetView` | Publiczny (token z emaila) |
| `/groups` | `GroupsView` | Zalogowany |
| `/groups/:id` | `GroupDetailView` | Zalogowany |
| `/add-quiz` | `AddQuizView` | Instruktor |
| `/quiz/:id` | `QuizTakeView` | Student |
| `/results/:id` | `QuizResultsView` | Zalogowany |
| `/pools` | `PoolsView` | Instruktor |
| `/change-info` | `ChangeInfoView` | Zalogowany |
| `/delete-account` | `AccDeleteView` | Zalogowany |

---

## API

Pełna dokumentacja endpointów: [docs/API.md](docs/API.md)

Wszystkie endpointy wymagające autoryzacji przyjmują nagłówek:
```
Authorization: Bearer <jwt_token>
```

Base URL: `http://localhost:3000/api`

### Przegląd endpointów

| Metoda | Ścieżka | Opis |
|---|---|---|
| `POST` | `/auth/register` | Rejestracja |
| `POST` | `/auth/login` | Logowanie |
| `GET` | `/auth/me` | Dane zalogowanego użytkownika |
| `POST` | `/auth/forgot-password` | Wyślij link resetu hasła |
| `POST` | `/auth/reset-password` | Ustaw nowe hasło tokenem |
| `GET` | `/users/:id` | Profil użytkownika |
| `PUT` | `/users/:id` | Edytuj profil |
| `PUT` | `/users/:id/password` | Zmień hasło |
| `DELETE` | `/users/:id` | Usuń konto (soft delete) |
| `GET` | `/groups` | Lista grup |
| `POST` | `/groups` | Utwórz grupę |
| `GET` | `/groups/:id` | Szczegóły grupy z członkami |
| `POST` | `/groups/join` | Dołącz do grupy kodem |
| `PATCH` | `/groups/:id/members/:userId` | Akceptuj/odrzuć członka |
| `DELETE` | `/groups/:id/members/:userId` | Usuń członka z grupy |
| `GET` | `/quizzes` | Lista quizów |
| `POST` | `/quizzes` | Utwórz quiz |
| `GET` | `/quizzes/:id` | Szczegóły quizu z pytaniami |
| `PUT` | `/quizzes/:id` | Edytuj quiz |
| `POST` | `/quizzes/:id/questions` | Dodaj pytanie do quizu |
| `DELETE` | `/quizzes/:id/questions/:qId` | Usuń pytanie z quizu |
| `GET` | `/quizzes/:id/history` | Historia edycji quizu |
| `GET` | `/questions` | Bank pytań |
| `POST` | `/questions` | Utwórz pytanie |
| `GET` | `/questions/:id` | Szczegóły pytania |
| `PUT` | `/questions/:id` | Edytuj pytanie |
| `DELETE` | `/questions/:id` | Usuń pytanie |
| `GET` | `/pools` | Lista pul pytań |
| `POST` | `/pools` | Utwórz pulę |
| `GET` | `/pools/:id` | Szczegóły puli z pytaniami |
| `PUT` | `/pools/:id` | Edytuj pulę |
| `DELETE` | `/pools/:id` | Usuń pulę |
| `POST` | `/pools/:id/questions` | Dodaj pytanie do puli |
| `DELETE` | `/pools/:id/questions/:qId` | Usuń pytanie z puli |
| `POST` | `/pools/:id/import` | Zbiorczy import pytań do puli |
| `POST` | `/attempts` | Rozpocznij podejście do quizu |
| `POST` | `/attempts/:id/answers` | Zapisz odpowiedź |
| `POST` | `/attempts/:id/finish` | Zakończ podejście |
| `GET` | `/attempts` | Historia podejść |
| `GET` | `/attempts/:id` | Szczegóły podejścia |
| `GET` | `/health` | Status serwera |

---

## Autorzy

- Paweł Jamroziak
- Dominik Baryła
- Karolina Bieńko

Projekt zaliczeniowy — Bazy Danych, Politechnika Wrocławska
