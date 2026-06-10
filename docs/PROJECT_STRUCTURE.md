# Struktura projektu — QuizyDB

```
quizy-bazydanych/
│
├── backend/                        # Serwer Node.js/Express
│   ├── src/
│   │   ├── db/
│   │   │   ├── init.js             # Schemat DB: tabele, funkcje, triggery, widoki
│   │   │   ├── seed.js             # Dane testowe
│   │   │   ├── reset.js            # Resetowanie schematu (DROP SCHEMA + CREATE)
│   │   │   └── pool.js             # Pula połączeń PostgreSQL (node-postgres)
│   │   │
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT middleware: authenticate, requireRole()
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.js             # /api/auth — rejestracja, logowanie, reset hasła
│   │   │   ├── users.js            # /api/users — CRUD profili, zmiana hasła
│   │   │   ├── groups.js           # /api/groups — grupy, dołączanie, zarządzanie
│   │   │   ├── quizzes.js          # /api/quizzes — CRUD quizów, pytania, historia
│   │   │   ├── questions.js        # /api/questions — bank pytań
│   │   │   ├── pools.js            # /api/pools — pule pytań, import
│   │   │   └── attempts.js         # /api/attempts — podejścia, odpowiedzi, wyniki
│   │   │
│   │   └── index.js                # Entry point: Express app, CORS, rejestracja routerów
│   │
│   ├── .env                        # Zmienne środowiskowe (nie w git)
│   ├── .env.example                # Szablon zmiennych środowiskowych
│   ├── .gitignore
│   ├── package.json
│   └── README.md
│
├── frontend/                       # Aplikacja Vue 3
│   ├── src/
│   │   ├── api/
│   │   │   └── index.js            # Axios instance z JWT interceptorem
│   │   │
│   │   ├── router/
│   │   │   └── index.js            # Vue Router — definicje tras
│   │   │
│   │   ├── store/
│   │   │   └── user.js             # Reaktywny store użytkownika (bez Vuex/Pinia)
│   │   │
│   │   ├── views/
│   │   │   ├── HomeView.vue        # Strona główna
│   │   │   ├── LoginView.vue       # Logowanie
│   │   │   ├── RegisterView.vue    # Rejestracja
│   │   │   ├── PassResetView.vue   # Reset hasła (/reset?token=...)
│   │   │   ├── GroupsView.vue      # Lista grup
│   │   │   ├── GroupDetailView.vue # Szczegóły grupy z listą quizów
│   │   │   ├── AddQuizView.vue     # Tworzenie quizu (tryb ręczny i puli)
│   │   │   ├── QuizTakeView.vue    # Rozwiązywanie quizu
│   │   │   ├── QuizResultsView.vue # Wyniki podejścia
│   │   │   ├── PoolsView.vue       # Zarządzanie pulami pytań (instruktor)
│   │   │   ├── ChangeInfoView.vue  # Edycja profilu i zmiana hasła
│   │   │   └── AccDeleteView.vue   # Usuwanie konta
│   │   │
│   │   ├── App.vue                 # Root component
│   │   ├── main.js                 # Entry point Vue
│   │   └── data/
│   │       └── quizzes.js          # Statyczne dane (legacy)
│   │
│   ├── public/
│   │   └── favicon.ico
│   ├── index.html
│   ├── vite.config.js
│   ├── jsconfig.json
│   ├── package.json
│   └── .gitignore
│
├── docs/
│   ├── API.md                      # Pełna dokumentacja REST API
│   ├── DATABASE.md                 # Schemat DB, triggery, widoki, funkcje
│   ├── PROJECT_STRUCTURE.md        # Ten plik
│   ├── quiz_platform.png           # Diagram logiczny
│   └── quiz_platformv2.png         # Diagram logiczny v2
│
├── .gitignore
├── README.md                       # Główna dokumentacja projektu
└── CONTRIBUTING.md                 # Zasady współpracy
```

---

## Kluczowe pliki

| Plik | Rola |
|---|---|
| `backend/src/db/init.js` | Cały schemat PostgreSQL — tu są triggery, funkcje, widoki |
| `backend/src/index.js` | Rejestracja wszystkich routerów i middleware |
| `backend/src/middleware/auth.js` | `authenticate` (weryfikacja JWT) i `requireRole()` (autoryzacja) |
| `frontend/src/api/index.js` | Axios z automatycznym dołączaniem tokenu JWT |
| `frontend/src/store/user.js` | Globalny stan zalogowanego użytkownika |
| `frontend/src/router/index.js` | Trasy i navigation guards |

---

## Przepływ żądania

```
1. Frontend (Vue)
   └─ api/index.js (Axios + JWT header)
      └─ Backend (Express)
         ├─ middleware/auth.js (weryfikacja tokenu)
         ├─ routes/*.js (handler)
         │   └─ SQL przez node-postgres
         │       └─ PostgreSQL
         │           ├─ Funkcje (hash_password, verify_password, calculate_score)
         │           ├─ Triggery (randomize, auto_score, edit_log, updated_at)
         │           └─ Widoki (v_quiz_statistics, v_student_quiz_results, ...)
         └─ JSON response
```

---

## Konwencje kodu

### Backend
- Każdy plik route obsługuje jeden zasób (`/api/users`, `/api/quizzes` itd.)
- Brak ORM — wszystkie zapytania to surowy SQL z parametryzacją (`$1, $2, ...`)
- Transakcje (`BEGIN/COMMIT/ROLLBACK`) przy operacjach wielokrokowych
- `pool.connect()` → `client` przy transakcjach, `pool.query()` przy pojedynczych zapytaniach
- Middleware `authenticate` na każdym chronionym endpointcie, `requireRole(...)` do autoryzacji roli

### Frontend
- Vue 3 Composition API (`<script setup>` lub `setup()`)
- Wszystkie wywołania API przez `src/api/index.js` (nie bezpośredni `axios`)
- Stan użytkownika z `src/store/user.js`
