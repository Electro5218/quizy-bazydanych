# Dokumentacja bazy danych — QuizyDB

Baza danych PostgreSQL z rozszerzeniem `pgcrypto`. Schemat inicjalizowany przez `backend/src/db/init.js`.

---

## Spis treści

- [Schemat tabel](#schemat-tabel)
- [Funkcje składowane](#funkcje-składowane)
- [Triggery](#triggery)
- [Widoki](#widoki)
- [Indeksy](#indeksy)
- [Architektura DB-centric](#architektura-db-centric)

---

## Schemat tabel

### `users`
Użytkownicy systemu.

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | SERIAL PK | |
| `email` | VARCHAR(255) UNIQUE NOT NULL | Małe litery (normalizacja w aplikacji) |
| `username` | VARCHAR(100) UNIQUE NOT NULL | |
| `password_hash` | TEXT NOT NULL | Hash Blowfish z `hash_password()` |
| `first_name` | VARCHAR(100) | |
| `last_name` | VARCHAR(100) | |
| `role` | VARCHAR(20) | `student` \| `instructor` \| `admin` |
| `email_verified` | BOOLEAN | Domyślnie `false` |
| `is_deleted` | BOOLEAN | Soft delete — domyślnie `false` |
| `is_blocked` | BOOLEAN | Blokada przez admina — domyślnie `false` |
| `created_at` | TIMESTAMPTZ | Domyślnie `NOW()` |
| `updated_at` | TIMESTAMPTZ | Aktualizowane przez trigger `trg_users_updated_at` |

---

### `groups`
Grupy zajęciowe.

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | SERIAL PK | |
| `name` | VARCHAR(200) NOT NULL | |
| `instructor_id` | INT FK→users | |
| `join_code` | VARCHAR(20) UNIQUE | Generowany w aplikacji (8 znaków uppercase) |
| `created_at` | TIMESTAMPTZ | |

---

### `group_users`
Przynależność studentów do grup.

| Kolumna | Typ | Opis |
|---|---|---|
| `group_id` | INT FK→groups | PK (composite) |
| `user_id` | INT FK→users | PK (composite) |
| `status` | VARCHAR(20) | `pending` \| `accepted` |
| `joined_at` | TIMESTAMPTZ | |

---

### `question_bank`
Globalny bank pytań.

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | SERIAL PK | |
| `created_by` | INT FK→users | |
| `content` | TEXT NOT NULL | Treść pytania |
| `latex_content` | TEXT | Opcjonalny zapis LaTeX |
| `question_type` | VARCHAR(20) | `single` \| `multiple` |
| `is_public` | BOOLEAN | Dostępne dla wszystkich instruktorów |
| `created_at` | TIMESTAMPTZ | |

---

### `answer_options`
Opcje odpowiedzi do pytań.

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | SERIAL PK | |
| `question_id` | INT FK→question_bank CASCADE | |
| `content` | TEXT NOT NULL | |
| `latex_content` | TEXT | |
| `is_correct` | BOOLEAN | Domyślnie `false` |

---

### `question_pools`
Pule pytań do losowego doboru.

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | SERIAL PK | |
| `name` | VARCHAR(200) NOT NULL | |
| `description` | TEXT | |
| `created_by` | INT FK→users | |
| `created_at` | TIMESTAMPTZ | |

---

### `pool_questions`
Pytania przypisane do puli.

| Kolumna | Typ | Opis |
|---|---|---|
| `pool_id` | INT FK→question_pools CASCADE | PK (composite) |
| `question_id` | INT FK→question_bank CASCADE | PK (composite) |
| `added_at` | TIMESTAMPTZ | |

---

### `quizzes`
Quizy.

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | SERIAL PK | |
| `title` | VARCHAR(300) NOT NULL | |
| `group_id` | INT FK→groups | Opcjonalne — quiz może być bez grupy |
| `created_by` | INT FK→users | |
| `time_limit_sec` | INT | NULL = bez limitu |
| `max_attempts` | INT | Domyślnie 1 |
| `is_draft` | BOOLEAN | Domyślnie `true` — niewidoczny dla studentów |
| `visible_from` | TIMESTAMPTZ | NULL = bez ograniczenia |
| `visible_until` | TIMESTAMPTZ | NULL = bez ograniczenia |
| `question_pool_id` | INT FK→question_pools | Tryb puli pytań |
| `draw_count` | INT | Ile pytań losować z puli (NULL/0 = wszystkie) |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Trigger `trg_quizzes_updated_at` |

---

### `quiz_questions`
Pytania przypisane ręcznie do quizu (tryb bez puli).

| Kolumna | Typ | Opis |
|---|---|---|
| `quiz_id` | INT FK→quizzes CASCADE | PK (composite) |
| `question_id` | INT FK→question_bank | PK (composite) |
| `position` | INT | Kolejność |

---

### `quiz_attempts`
Podejścia studentów do quizów.

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | SERIAL PK | |
| `user_id` | INT FK→users | |
| `quiz_id` | INT FK→quizzes | |
| `status` | VARCHAR(20) | `in_progress` \| `completed` \| `expired` |
| `score` | INT | Obliczane przez trigger `trg_attempt_auto_score` |
| `started_at` | TIMESTAMPTZ | Domyślnie `NOW()` |
| `finished_at` | TIMESTAMPTZ | Ustawiane przez trigger |

---

### `attempt_question_order`
Losowa kolejność pytań per podejście. Wypełniana przez trigger `trg_attempt_randomize`.

| Kolumna | Typ | Opis |
|---|---|---|
| `attempt_id` | INT FK→quiz_attempts CASCADE | PK (composite) |
| `question_id` | INT FK→question_bank | PK (composite) |
| `position` | INT | Unikalna pozycja w tym podejściu |

---

### `user_answers`
Odpowiedzi studenta w podejściu.

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | SERIAL PK | |
| `attempt_id` | INT FK→quiz_attempts CASCADE | |
| `question_id` | INT FK→question_bank | |
| `answer_id` | INT FK→answer_options | |
| `answered_at` | TIMESTAMPTZ | |

---

### `quiz_edit_history`
Historia edycji quizów — zapisywana automatycznie przez trigger.

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | SERIAL PK | |
| `quiz_id` | INT FK→quizzes CASCADE | |
| `edited_by` | INT FK→users | Odczytywany z `current_setting('app.editor_id')` |
| `edited_at` | TIMESTAMPTZ | |
| `change_summary` | TEXT | Tekstowy opis zmian (diff pól) |

---

### `password_reset_tokens`
Tokeny resetu hasła.

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | SERIAL PK | |
| `user_id` | INT FK→users CASCADE | |
| `token` | UUID UNIQUE | Generowany automatycznie przez `gen_random_uuid()` |
| `expires_at` | TIMESTAMPTZ | `NOW() + 15 minutes` |
| `is_used` | BOOLEAN | Domyślnie `false` |

---

### `email_verification_tokens`
Tokeny weryfikacji emaila.

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | SERIAL PK | |
| `user_id` | INT FK→users CASCADE | |
| `token` | UUID UNIQUE | `DEFAULT gen_random_uuid()` |
| `expires_at` | TIMESTAMPTZ | `NOW() + 24 hours` |
| `is_used` | BOOLEAN | Domyślnie `false` |

---

### `login_attempts`
Logi prób logowania — używane do blokady konta.

| Kolumna | Typ | Opis |
|---|---|---|
| `id` | SERIAL PK | |
| `user_id` | INT FK→users CASCADE | |
| `attempted_at` | TIMESTAMPTZ | Domyślnie `NOW()` |
| `success` | BOOLEAN | |
| `locked_until` | TIMESTAMPTZ | NULL = brak blokady |

---

### `quiz_visibility`
Dodatkowa kontrola widoczności quizu per student.

| Kolumna | Typ | Opis |
|---|---|---|
| `quiz_id` | INT FK→quizzes | PK (composite) |
| `user_id` | INT FK→users | PK (composite) |
| `visible` | BOOLEAN | |

---

## Funkcje składowane

### `hash_password(plain_password TEXT) → TEXT`
Hashuje hasło algorytmem Blowfish przez pgcrypto (`crypt($1, gen_salt('bf'))`). Używana przy rejestracji i zmianie hasła.

```sql
SELECT hash_password('moje_haslo');
-- Zwraca: $2a$06$...
```

---

### `verify_password(plain_password TEXT, stored_hash TEXT) → BOOLEAN`
Weryfikuje hasło w czasie stałym (`crypt($1, $2) = $2`). Zapobiega atakom czasowym.

```sql
SELECT verify_password('moje_haslo', '$2a$06$...');
-- Zwraca: true / false
```

---

### `calculate_attempt_score(p_attempt_id INT) → INT`
Oblicza wynik podejścia. Dla każdego pytania:
- Liczy zaznaczone poprawne i błędne odpowiedzi
- Punkt przyznawany tylko gdy student zaznaczył **wszystkie** poprawne i **żadnej** błędnej
- Zwraca łączną liczbę punktów

```sql
SELECT calculate_attempt_score(10);
-- Zwraca: 8
```

---

### `fn_update_timestamp() → TRIGGER`
Ustawia `updated_at = NOW()` przed każdym UPDATE.

---

### `fn_randomize_attempt_questions() → TRIGGER`
Uruchamiana AFTER INSERT na `quiz_attempts`. Logika:
1. Sprawdza czy quiz używa puli (`question_pool_id`)
2. Jeśli tak — losuje `draw_count` pytań z puli (lub wszystkie jeśli `draw_count` = NULL/0)
3. Jeśli nie — bierze pytania z `quiz_questions` zachowując ich kolejność
4. Wstawia wylosowaną kolejność do `attempt_question_order`

---

### `fn_auto_score_attempt() → TRIGGER`
Uruchamiana BEFORE UPDATE na `quiz_attempts` gdy status zmienia się na `completed` lub `expired`:
1. Wywołuje `calculate_attempt_score(NEW.id)`
2. Ustawia `NEW.score` i `NEW.finished_at = NOW()`

---

### `fn_log_quiz_edit() → TRIGGER`
Uruchamiana AFTER UPDATE na `quizzes`:
1. Odczytuje ID edytora z `current_setting('app.editor_id', true)` (ustawiane przez `SET LOCAL` w transakcji)
2. Buduje `change_summary` porównując OLD i NEW dla pól: `title`, `is_draft`, `time_limit_sec`, `max_attempts`, `visible_from`, `visible_until`
3. Wstawia rekord do `quiz_edit_history`

---

## Triggery

| Trigger | Na tabeli | Typ | Kiedy | Funkcja |
|---|---|---|---|---|
| `trg_users_updated_at` | `users` | FOR EACH ROW | BEFORE UPDATE | `fn_update_timestamp()` |
| `trg_quizzes_updated_at` | `quizzes` | FOR EACH ROW | BEFORE UPDATE | `fn_update_timestamp()` |
| `trg_attempt_randomize` | `quiz_attempts` | FOR EACH ROW | AFTER INSERT | `fn_randomize_attempt_questions()` |
| `trg_attempt_auto_score` | `quiz_attempts` | FOR EACH ROW | BEFORE UPDATE (gdy status IN 'completed','expired') | `fn_auto_score_attempt()` |
| `trg_quiz_edit_log` | `quizzes` | FOR EACH ROW | AFTER UPDATE | `fn_log_quiz_edit()` |

---

## Widoki

### `v_quiz_statistics`
Statystyki quizów dla instruktorów.

Kluczowe kolumny: `quiz_id`, `title`, `group_id`, `group_name`, `created_by`, `question_count`, `attempt_count`, `student_count`, `avg_score`, `max_score`, `min_score`, `is_draft`, `question_pool_id`, `draw_count`, `visible_from`, `visible_until`, `created_at`, `updated_at`.

Używany przez: `GET /api/quizzes`, `GET /api/quizzes/:id`.

---

### `v_student_quiz_results`
Wyniki podejść studentów.

Kluczowe kolumny: `attempt_id`, `quiz_id`, `quiz_title`, `user_id`, `username`, `score`, `total_questions`, `percentage`, `status`, `started_at`, `finished_at`.

Używany przez: `GET /api/attempts`, `GET /api/attempts/:id`, `POST /api/attempts/:id/finish`.

---

### `v_question_pool_stats`
Statystyki pytań w pulach.

Kluczowe kolumny: `question_id`, `content`, `question_type`, `is_public`, `used_in_quizzes`, `times_answered`, `answer_count`, `created_at`.

Używany przez: `GET /api/pools/:id`.

---

### `v_login_activity`
Historia logowań użytkowników — agregacja z `login_attempts`.

Kluczowe kolumny: `user_id`, `email`, `username`, `role`, `total_logins`, `failed_logins`, `last_login`.

---

## Indeksy

| Indeks | Tabela | Kolumny | Cel |
|---|---|---|---|
| `idx_quizzes_pool` | `quizzes` | `question_pool_id` | Szukanie quizów po puli |
| `idx_attempts_status` | `quiz_attempts` | `status` | Filtrowanie aktywnych podejść |
| `idx_attempt_order` | `attempt_question_order` | `attempt_id` | Pobieranie kolejności pytań |
| `idx_pool_questions_pool` | `pool_questions` | `pool_id` | Pytania puli |
| `idx_pool_questions_q` | `pool_questions` | `question_id` | Przynależność pytania do pul |
| `idx_login_attempts_user` | `login_attempts` | `user_id, attempted_at DESC` | Sprawdzanie blokady konta |
| `idx_reset_token` | `password_reset_tokens` | `token` | Walidacja tokenu resetu |
| `idx_email_verify_token` | `email_verification_tokens` | `token` | Walidacja tokenu email |
| `idx_quiz_visibility_quiz` | `quiz_visibility` | `quiz_id` | Widoczność quizu |

---

## Architektura DB-centric

Projekt celowo przenosi logikę do bazy danych, by zademonstrować jej możliwości.

### Porównanie: tradycyjne vs DB-centric

| Operacja | Tradycyjne (w JS) | Nasz projekt (w DB) |
|---|---|---|
| Hashowanie haseł | `bcrypt.hash()` w Node.js | `hash_password()` (pgcrypto) |
| Weryfikacja hasła | `bcrypt.compare()` w Node.js | `verify_password()` (pgcrypto) |
| Losowanie pytań | `shuffle()` w JS | Trigger `trg_attempt_randomize` |
| Obliczanie wyniku | Pętla w JS | Trigger `trg_attempt_auto_score` + `calculate_attempt_score()` |
| Historia edycji | Ręczne `INSERT` w JS | Trigger `trg_quiz_edit_log` |
| Statystyki quizów | Wiele zapytań w JS | Widok `v_quiz_statistics` |
| Aktualizacja `updated_at` | Ręczne w każdym UPDATE | Trigger `trg_users_updated_at`, `trg_quizzes_updated_at` |

### Przekazywanie kontekstu do triggera

Trigger `trg_quiz_edit_log` musi wiedzieć kto edytuje quiz. Nie może tego odczytać z sesji HTTP. Rozwiązanie: aplikacja ustawia zmienną sesji PostgreSQL przed UPDATE:

```javascript
// W quizzes.js — PUT /api/quizzes/:id
await client.query(`SELECT set_config('app.editor_id', $1::text, true)`, [req.user.id]);
// SET LOCAL — działa tylko w obrębie bieżącej transakcji
await client.query(`UPDATE quizzes SET ... WHERE id = $1`, [...]);
// Trigger odczytuje: current_setting('app.editor_id', true)
```

### Gwarancje transakcyjne

- Tworzenie podejścia (`POST /attempts`) — `SELECT FOR UPDATE` na quizie zapobiega race condition przy współbieżnych podejściach
- Reset hasła — transakcja atomowa: zmiana hasła + oznaczenie tokenu jako użytego
- Import pytań do puli — atomowy: albo wszystkie pytania albo żadne (ROLLBACK przy błędzie)
- Edycja quizu — `SET LOCAL` + UPDATE + automatyczny log triggera — wszystko w jednej transakcji
