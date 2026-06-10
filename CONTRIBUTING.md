# Zasady współpracy — QuizyDB

---

## Wymagania deweloperskie

- Node.js 18+
- PostgreSQL 14+
- Git

---

## Branching

| Branch | Przeznaczenie |
|---|---|
| `main` | Stabilna wersja produkcyjna |
| `feature/<nazwa>` | Nowa funkcjonalność |
| `fix/<nazwa>` | Naprawa błędu |

---

## Konwencja commitów

```
feat: dodaj endpoint reset hasła
fix: popraw walidację tokenu JWT
refactor: przenieś logikę scoringu do bazy
docs: zaktualizuj API.md o endpoints pul
```

Prefiks opisuje rodzaj zmiany: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`.

---

## Pull request

1. Utwórz branch od `main`
2. Wprowadź zmiany
3. Upewnij się że backend startuje (`npm run dev`) i nie ma błędów
4. Opisz w PR co zmieniasz i dlaczego
5. Otwórz Pull Request do `main`

---

## Zasady kodu

- Bez ORM — tylko surowe SQL z parametryzacją
- Logika biznesowa w bazie danych (triggery/funkcje) tam gdzie to możliwe
- Nie commituj `.env` ani `node_modules`
- Nie commituj `backend/.env` — używaj `.env.example` jako szablonu

---

## Inicjalizacja bazy po klonowaniu

```bash
cd backend
cp .env.example .env
# Uzupełnij DATABASE_URL i inne zmienne
npm run db:init
npm run db:seed
```

Jeśli schemat jest nieaktualny:

```bash
npm run db:reset
npm run db:init
npm run db:seed
```
