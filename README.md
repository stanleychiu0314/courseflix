# CourseFlix

CourseFlix is a comprehensive course evaluation and scheduling platform designed for Vanderbilt University students. The platform enables students to search and browse courses, read detailed reviews and feedback from peers, view grade distributions, plan their schedules, and submit their own course evaluations.

## Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose
- npm
- Microsoft Azure AD app registration (for authentication)

## Quick Start

Run these commands in order to get the full application running:

```bash
# 1. Start the PostgreSQL database
docker compose up -d

# 2. Install and start the backend (in a new terminal)
cd server
npm install
npm start

# 3. Install and start the frontend (in a new terminal)
cd client
npm install
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Detailed Setup

### 1. Database (PostgreSQL via Docker)

Start the database:
```bash
# Copy environment file (optional - defaults work out of the box)
cp .env.example .env

# Start PostgreSQL container
docker compose up -d
```

The database will be available on `localhost:5432` with:
- Database: `courseflix`
- User: `courseflix`
- Password: `courseflix`

The schema (`db/schemav2.sql`) is automatically loaded on first startup.

**Database commands:**
```bash
# Stop the database
docker compose down

# Reset database (deletes all data)
docker compose down -v

# View database logs
docker compose logs -f db

# Load schema data
docker exec -i courseflix-db psql -U courseflix -d courseflix < db/seed-departments.sql
docker exec -i courseflix-db psql -U courseflix -d courseflix < db/seed-terms.sql

# Import course data
env POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=5432 POSTGRES_DB=<db> POSTGRES_USER=<user> POSTGRES_PASSWORD=<password> node db/import-courses.js

# Connect to database directly
docker exec -it courseflix-db psql -U courseflix -d courseflix
```

### 2. Backend (Express.js)

```bash
cd server
npm install
npm start
```

The backend runs on http://localhost:3000 and provides the following API endpoints:
- `GET /api/courses` - List courses with search/filter/sort
- `GET /api/courses/:id` - Get course details
- `GET /api/courses/:id/reviews` - Get course reviews
- `GET /api/departments` - List all departments
- `GET /api/terms` - List all terms
- `GET /api/schedule` - Get user schedule
- `POST /api/auth/microsoft/login` - Microsoft login (expects `{ idToken }`)
- `GET /api/auth/me` - Current session
- `POST /api/auth/logout` - Clear session

### Synthetic data

Generate synthetic users and reviews only:
```bash
node db/seed-synthetic.js --users=200 --min-reviews=2 --max-reviews=8 --positive-rate=0.35 --negative-rate=0.25 --seed=42
```

To wipe synthetic users and reviews first:
```bash
node db/seed-synthetic.js --wipe=true
```

To wipe all core tables (destructive):
```bash
node db/seed-synthetic.js --wipe=all
```

### 3. Frontend (React + Vite)

```bash
cd client
npm install
npm run dev
```

The frontend runs on http://localhost:5173.

## Environment Configuration

### Backend Environment (`server/.env`)

Create a `server/.env` file with the following variables:

```bash
SESSION_SECRET=your-secure-random-string-here
MICROSOFT_CLIENT_ID=your-azure-ad-client-id
```

### Frontend Environment (`client/.env`)

Create a `client/.env` file with the following variables:

```bash
VITE_MICROSOFT_CLIENT_ID=your-azure-ad-client-id
VITE_MICROSOFT_REDIRECT_URI=http://localhost:5173
```

### Microsoft Azure AD Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations** → **New registration**
3. Configure:
   - Name: `CourseFlix`
   - Supported account types: Single tenant (Vanderbilt only) or Multitenant
   - Redirect URI: `http://localhost:5173` (Web platform)
4. After creation, copy the **Application (client) ID** - this is your `MICROSOFT_CLIENT_ID`
5. Under **Authentication**, ensure `http://localhost:5173` is listed as a redirect URI

## Database Migrations

If you have an existing database and need to add Microsoft OAuth support:

```bash
# Add 'microsoft' to the oauth_provider_type enum
docker exec -it courseflix-db psql -U courseflix -d courseflix -c "ALTER TYPE oauth_provider_type ADD VALUE IF NOT EXISTS 'microsoft';"
```

## Seed Export/Import (Shareable Data)

Use these scripts to export the current database (schema + data) and reload it later.

```bash
# Full dump (schema + data)
db/export-seed.sh

# Data-only dump (assumes schema already exists)
db/export-seed.sh --data-only

# Import a dump file
db/import-seed.sh db/seed-full.sql
```

## Project Structure

```
CourseFlix/
├── client/                 # React frontend (Vite + TypeScript)
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable components
│   │   └── styles/        # CSS files
│   └── package.json
├── server/                 # Express.js backend
│   ├── routes/            # API route handlers
│   ├── db/                # Database connection
│   └── package.json
├── db/                     # Database schemas and seed scripts
│   ├── schemav2.sql       # Current database schema
│   └── import-courses.js  # Course data importer
├── scraper/               # Course data scraping utilities
├── docker-compose.yml     # PostgreSQL Docker configuration
└── README.md
```
