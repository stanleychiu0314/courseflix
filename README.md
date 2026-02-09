# CourseFlix

CourseFlix is a comprehensive course evaluation and scheduling platform designed for Vanderbilt University students. The platform enables students to search and browse courses, read detailed reviews and feedback from peers, view grade distributions, plan their schedules, and submit their own course evaluations.

## Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose
- npm

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

### 3. Frontend (React + Vite)

```bash
cd client
npm install
npm run dev
```

The frontend runs on http://localhost:5173.

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
