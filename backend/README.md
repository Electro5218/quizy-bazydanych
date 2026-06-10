# Backend - Platforma Quizów Online
**Politechnika Wrocławska | Bazy Danych | dr inż. Mateusz Tykierko**

## Stack
- **Node.js + Express** – serwer REST API
- **PostgreSQL** – baza danych (raw SQL, bez ORM)
- **bcrypt** – hashowanie haseł
- **JWT** – autoryzacja
- **Vue.js** – frontend (osobne repozytorium)

---

## Wymagania wstępne

- Node.js ≥ 18
- PostgreSQL ≥ 14

---

## Instalacja krok po kroku

### 1. Utwórz bazę danych PostgreSQL

```bash
# Zaloguj się do psql
psql -U postgres

# Utwórz bazę
CREATE DATABASE quizy_db;
\q
```

### 2. Skonfiguruj zmienne środowiskowe

```bash
cp .env.example .env
```

Edytuj `.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=quizy_db
DB_USER=postgres
DB_PASSWORD=twoje_haslo_postgres

JWT_SECRET=zmien_to_na_min_32_znakowy_losowy_string
JWT_EXPIRES_IN=24h

PORT=3000
NODE_ENV=development

FRONTEND_URL=http://localhost:5173
```

### 3. Zainstaluj zależności

```bash
npm install
```

### 4. Zainicjalizuj schemat bazy danych

```bash
npm run db:init
```

To tworzy wszystkie tabele, typy ENUM i indeksy zgodnie z modelem logicznym z prezentacji.

### 5. (Opcjonalnie) Załaduj dane testowe

```bash
npm run db:seed
```

Tworzy konta testowe:
| Rola | Email | Hasło |
|------|-------|-------|
| Admin | admin@pwr.edu.pl | Admin1234! |
| Instruktor | tykierko@pwr.edu.pl | Instr1234! |
| Student | 283873@student.pwr.edu.pl | Student1234! |

### 6. Uruchom serwer

```bash
# Produkcja
npm start

# Development (auto-restart)
npm run dev
```

Serwer działa na: **http://localhost:3000**

---

## Połączenie z frontendem Vue.js

### W projekcie Vue.js utwórz `src/api/index.js`:

```javascript
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: { 'Content-Type': 'application/json' }
})

// Automatycznie dodaj token JWT do każdego requestu
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Obsługa błędów 401 (wyloguj)
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
```

### Przykład użycia w komponencie Vue:

```javascript
import api from '@/api'

// Logowanie
const login = async () => {
  const { data } = await api.post('/auth/login', { email, password })
  localStorage.setItem('token', data.token)
}

// Pobierz quizy
const { data: quizzes } = await api.get('/quizzes')

// Rozpocznij quiz
const { data } = await api.post('/attempts', { quiz_id: 5 })

// Zapisz odpowiedź
await api.post(`/attempts/${attemptId}/answers`, {
  question_id: 12,
  answer_ids: [45, 47]   // tablica (multiple choice) lub jeden element (single)
})

// Zakończ quiz
const { data: result } = await api.post(`/attempts/${attemptId}/finish`)
console.log(`Wynik: ${result.score}/${result.total_questions}`)
```

---

## Endpointy API

### 🔐 Auth
| Metoda | Endpoint | Opis |
|--------|----------|------|
| POST | `/api/auth/register` | Rejestracja |
| POST | `/api/auth/login` | Logowanie → JWT |
| GET  | `/api/auth/me` | Profil zalogowanego |
| POST | `/api/auth/forgot-password` | Wyślij token resetu |
| POST | `/api/auth/reset-password` | Ustaw nowe hasło |

### 👥 Grupy
| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET  | `/api/groups` | Lista grup |
| POST | `/api/groups` | Utwórz grupę (instructor) |
| GET  | `/api/groups/:id` | Szczegóły grupy + członkowie |
| POST | `/api/groups/join` | Dołącz przez kod |
| PATCH | `/api/groups/:id/members/:userId` | Akceptuj/odrzuć |
| DELETE | `/api/groups/:id/members/:userId` | Usuń z grupy |

### 📝 Quizy
| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET  | `/api/quizzes` | Lista quizów |
| POST | `/api/quizzes` | Utwórz quiz |
| GET  | `/api/quizzes/:id` | Szczegóły z pytaniami |
| PUT  | `/api/quizzes/:id` | Edytuj quiz |
| POST | `/api/quizzes/:id/questions` | Dodaj pytanie do quizu |
| DELETE | `/api/quizzes/:id/questions/:qid` | Usuń pytanie z quizu |

### ❓ Bank pytań
| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET  | `/api/questions` | Lista pytań |
| POST | `/api/questions` | Utwórz pytanie + odpowiedzi |
| GET  | `/api/questions/:id` | Szczegóły pytania |
| PUT  | `/api/questions/:id` | Edytuj pytanie |
| DELETE | `/api/questions/:id` | Usuń pytanie |

### 🎯 Podejścia do quizów
| Metoda | Endpoint | Opis |
|--------|----------|------|
| POST | `/api/attempts` | Rozpocznij quiz |
| POST | `/api/attempts/:id/answers` | Zapisz odpowiedź |
| POST | `/api/attempts/:id/finish` | Zakończ + oblicz wynik |
| GET  | `/api/attempts` | Historia podejść |
| GET  | `/api/attempts/:id` | Szczegóły + wyniki |

### 👤 Użytkownicy
| Metoda | Endpoint | Opis |
|--------|----------|------|
| GET  | `/api/users` | Lista (admin only) |
| GET  | `/api/users/:id` | Profil |
| PUT  | `/api/users/:id` | Edytuj profil |
| PUT  | `/api/users/:id/password` | Zmień hasło |
| DELETE | `/api/users/:id` | Soft delete |
| PATCH | `/api/users/:id/block` | Blokada (admin) |

---

## Struktura projektu

```
backend/
├── src/
│   ├── index.js           # Główny plik – Express app
│   ├── db/
│   │   ├── pool.js        # Połączenie PostgreSQL
│   │   ├── init.js        # Inicjalizacja schematu (npm run db:init)
│   │   └── seed.js        # Dane testowe (npm run db:seed)
│   ├── middleware/
│   │   └── auth.js        # JWT weryfikacja + role
│   └── routes/
│       ├── auth.js        # Rejestracja, logowanie, reset hasła
│       ├── users.js       # Zarządzanie użytkownikami
│       ├── groups.js      # Grupy i członkostwo
│       ├── quizzes.js     # Quizy i pytania
│       ├── questions.js   # Bank pytań
│       └── attempts.js    # Rozwiązywanie quizów
├── .env.example
├── package.json
└── README.md
```

---

## Zabezpieczenia

- **bcrypt** (koszt 12) do hashowania haseł
- **Blokada konta** po 5 nieudanych próbach (15 min)
- **JWT** z wygaśnięciem
- **Soft delete** – konta nie są fizycznie usuwane
- **SELECT FOR UPDATE** przy tworzeniu podejść (race condition protection)
- **Role-based access**: student / instructor / admin
- **CORS** ograniczony do frontendu Vue.js
