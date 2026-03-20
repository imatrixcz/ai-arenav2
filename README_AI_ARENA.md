# AI Arena v2

Kompletní přepis AI Arena z WordPress pluginu na standalone aplikaci postavenou na LastSaaS boilerplate.

## 🏗️ Architektura

### Backend (Go + MongoDB)
- **Framework:** LastSaaS (Go 1.25, Gorilla Mux, MongoDB)
- **Database:** MongoDB 7 s Redis cache
- **Auth:** JWT (z LastSaaS)
- **Deployment:** Docker Compose (vše v jednom kontejneru)

### Frontend (React + TypeScript)
- **Framework:** React 19, TypeScript, Vite 7
- **Styling:** Tailwind CSS 4 (z LastSaaS)
- **Charts:** Recharts (z LastSaaS)

## ✅ Hotovo

### Backend

#### Modely
- `AIModel` - 346+ AI modelů s kompletními daty
- `Benchmark` - benchmarky a kategorie
- `BenchmarkScore` - skóre pro každý model
- `Prompt` - prompty s model outputs (kód, obrázky, video, audio)
- `Vote` - hlasování v battle, ELO historie
- `OpenRouterSyncLog` - logy synchronizace

#### API Endpointy

**Public (bez auth):**
- `GET /models` - seznam modelů s filtry
- `GET /models/:slug` - detail modelu
- `GET /models/compare?slugs=` - porovnání modelů
- `GET /providers` - seznam providerů
- `GET /benchmarks` - seznam benchmarků
- `GET /benchmarks/:slug/scores` - skóre pro benchmark
- `GET /leaderboard` - ELO leaderboard
- `GET /battle-pair` - náhodný battle
- `GET /prompts` - seznam promptů
- `GET /prompts/:slug` - detail promptu

**Protected (s auth):**
- `POST /vote` - hlasování
- `GET /user/votes` - historie hlasování

**Admin (root tenant + admin role):**
- CRUD pro modely, benchmarky, skóre, prompty
- `POST /elo/recalculate` - přepočet ELO
- `POST /sync/openrouter` - sync z OpenRouter
- `GET /sync/logs` - logy synců
- `GET /sync/status` - status syncu

#### OpenRouter Sync
- Append-only (nepřepisuje ručně upravené modely)
- Denní sync v pozadí
- Logování všech operací
- Žádný API klíč potřeba - pouze GET

### Frontend

#### Komponenty
- **ModelComparison** - hlavní stránka porovnání
- **ModelsList** - seznam všech modelů (grid/list view)
- **ModelDetail** - detail modelu s ELO a benchmarky
- **Leaderboard** - ELO žebříček (7 modalit)
- **Battle** - blind battle interface
- **PromptsGallery** - galerie promptů
- **ModelCard** - karta modelu s drag & drop, 3-dot menu
- **BenchmarkSection** - skládací sekce benchmarků
- **AddModelModal** - modal pro přidání modelů s filtrem

#### Features implementované
- ✅ Drag & drop pro změnu pořadí karet
- ✅ BEST zvýraznění (zelená pro nejlepší hodnoty)
- ✅ 3-dot menu (Add to Favorites, Replace, Delete)
- ✅ Provider filter chips v modalu
- ✅ Multi-select checkboxy
- ✅ Architecture modality chips s barvami
- ✅ Collapsible benchmark sekce
- ✅ ELO ratings v patičce karty

## 🐳 Docker Setup

```bash
# Start vše
./scripts/setup.sh
docker-compose up -d

# Nebo manuálně
docker-compose up -d
```

**Služby:**
- `app` - Go backend + React frontend (port 4290)
- `mongodb` - MongoDB 7 (port 27017)
- `redis` - Redis cache (port 6379)
- `mongo-express` - MongoDB UI (port 8081)

## 📊 Datový Model

### AIModel
```typescript
{
  id: string;
  slug: string;
  name: string;
  provider: string;
  context_length: number;
  max_output_tokens: number;
  pricing: {
    prompt: number;
    completion: number;
    image: number;
    tiers?: Array<{
      threshold: number;
      prompt_price: number;
      completion_price: number;
      label: string;
    }>;
  };
  modalities: string[]; // text, image, video, file, audio
  elo_ratings: {
    global: number;
    code: number;
    image: number;
    video: number;
    audio: number;
    text: number;
    vision: number;
  };
  is_moderated: boolean;
  manual_override: boolean; // ochrana před sync
  source: 'openrouter' | 'manual';
}
```

## 🔧 Konfigurace

`.env`:
```bash
DATABASE_NAME=aiarena
MONGODB_URI=mongodb://localhost:27017
REDIS_URI=localhost:6379
JWT_ACCESS_SECRET=changeme
JWT_REFRESH_SECRET=changeme
FRONTEND_URL=http://localhost:4290
APP_NAME=AI Arena
```

## 🚧 Remaining Tasks

### Backend
1. [ ] Opravit build errors (Go 1.25 required)
2. [ ] Přidat MongoDB schemata validace
3. [ ] Redis cache pro leaderboard
4. [ ] Rate limiting pro battle/votes
5. [ ] ELO výpočetní engine (background worker)

### Frontend
1. [x] Vytvořit ModelListPage (seznam všech modelů)
2. [x] Vytvořit ModelDetailPage (detail modelu)
3. [x] Vytvořit LeaderboardPage (ELO leaderboard)
4. [x] Vytvořit BattlePage (blind battle interface)
5. [x] Vytvořit PromptsPage (galerie promptů)
6. [x] Admin panel pro správu modelů/benchmarků
7. [x] Registrace rout v routeru

### Data Migration
1. [x] Export z WordPress MySQL - `scripts/migrate-wordpress-to-mongodb.js`
2. [x] Transformace dat
3. [x] Import do MongoDB
4. [ ] Validace integrity

### Testing & Deployment
1. [ ] Unit testy
2. [ ] Integration testy
3. [ ] Produční build
4. [ ] Deployment na server

## 📁 Struktura

```
ai-arenav2/
├── backend/
│   ├── cmd/
│   │   ├── server/           # HTTP server
│   │   └── lastsaas/         # CLI tool
│   ├── internal/
│   │   ├── api/handlers/
│   │   │   ├── ai_models.go  # AI Arena handléři
│   │   │   ├── benchmarks.go
│   │   │   ├── leaderboard.go
│   │   │   ├── prompts.go
│   │   │   └── openrouter.go
│   │   └── models/
│   │       ├── ai_model.go
│   │       ├── benchmark.go
│   │       ├── prompt.go
│   │       ├── vote.go
│   │       └── openrouter.go
├── frontend/
│   └── src/
│       ├── api/aiarena.ts    # API client
│       ├── types/aiarena.ts  # TypeScript types
│       └── pages/
│           ├── public/aiarena/
│           │   ├── ModelComparison.tsx
│           │   ├── ModelsList.tsx
│           │   ├── ModelDetail.tsx
│           │   ├── Leaderboard.tsx
│           │   ├── Battle.tsx
│           │   ├── PromptsGallery.tsx
│           │   └── components/
│           │       ├── ModelCard.tsx
│           │       ├── BenchmarkSection.tsx
│           │       └── AddModelModal.tsx
│           └── admin/AIarena/
│               ├── AdminAIModels.tsx
│               └── AdminBenchmarks.tsx
├── scripts/
│   └── seed-data.js          # MongoDB seed data
├── docker-compose.yml
└── README.md
```

## 🔗 Repozitář

https://github.com/imatrixcz/ai-arenav2

Upstream: https://github.com/jonradoff/lastsaas (fork)

## 📝 Poznámky

- **Multi-tenancy:** Zatím nepoužíváme - LastSaaS tenanty necháváme ale nepoužíváme
- **Billing:** Ponecháno z LastSaaS ale neaktivováno - pro budoucí použití
- **Cache:** Redis připraven ale zatím neimplementován
- **OpenRouter:** Sync funguje bez API klíče - pouze GET na veřejné API

## 🎯 Další kroky

1. [ ] Opravit build errors (Go 1.25 required) - backend potřebuje novější verzi Go
2. [ ] Testování (unit + integration tests)
3. [ ] Produční deployment
4. [ ] Spustit migraci dat: `node scripts/migrate-wordpress-to-mongodb.js`

---

## 🔄 Migrace z WordPress

Použijte připravený skript pro migraci dat z WordPress do MongoDB:

```bash
# Nainstalujte závislosti
npm install mysql2 mongodb

# Nastavte proměnné prostředí (nebo upravte skript)
export WP_DB_HOST=localhost
export WP_DB_USER=wordpress
export WP_DB_PASSWORD=wordpress
export WP_DB_NAME=wordpress
export MONGODB_URI=mongodb://localhost:27017/aiarena

# Spusťte migraci
node scripts/migrate-wordpress-to-mongodb.js
```

Skript provede:
1. Export AI modelů z `wp_posts` (post_type = 'ai_model')
2. Export promptů z `wp_posts` (post_type = 'ai_prompt')
3. Export hlasování z `wp_ai_votes`
4. Transformaci dat do MongoDB formátu
5. Import do MongoDB s vytvořením indexů
6. Vytvoření mappingu WordPress ID → MongoDB ID

**Poznámka:** Pro správnou migraci je potřeba, aby Docker s MongoDB běžel na localhost:27017.

---

**Poslední update:** 2026-03-20
