# CourseFlix
CourseFlix is a comprehensive course evaluation and scheduling platform designed for Vanderbilt University students. The platform enables students to search and browse courses, read detailed reviews and feedback from peers, view grade distributions, plan their schedules, and submit their own course evaluations.

## Installation and Running

### Frontend
```bash
cd client
npm install
npm run dev
```

### Backend
```bash
cd server
npm install
npm start
```

## Local Database (Docker)

### 1) Start Postgres
```bash
cp .env.example .env
# edit .env if you want different credentials/port

docker compose up -d
```

The database will be available on `localhost:$POSTGRES_PORT` with:
- DB: `POSTGRES_DB`
- User: `POSTGRES_USER`
- Password: `POSTGRES_PASSWORD`

The schema in `db/schemav2.sql` is auto‑loaded on first startup.

### 2) Stop Postgres
```bash
docker compose down
```

### 3) Reset DB (destructive)
```bash
docker compose down -v
```
