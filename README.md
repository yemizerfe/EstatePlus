# EstatePlus

EstatePlus is a real estate market intelligence platform designed to organize property data and provide useful insights into the Addis Ababa real estate market.

The platform brings together property information, market indicators, and external data sources to make real estate information easier to manage, explore, and understand.

## Features

- Property listing and data management
- Real estate market indicators
- Data-driven market dashboards
- External data source integration
- Exchange-rate data integration
- Structured relational data management
- Market data processing and organization
- Backend APIs for application data and services

## Technology Stack

- **Node.js**
- **Express.js**
- **TypeScript**
- **PostgreSQL**
- **Docker**
- **REST APIs**

## Data Sources

EstatePlus integrates external sources to enrich market information, including:

- **National Bank of Ethiopia** exchange-rate data
- **BinaSmart** property listing data

External data is processed and organized within the application to support market analysis and reporting.

## Architecture

```text
                 External Data Sources
                         │
                         ▼
              ┌─────────────────────┐
              │   EstatePlus API    │
              │ Node.js + Express   │
              │    + TypeScript     │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │     PostgreSQL      │
              │   Market & Property │
              │        Data         │
              └──────────┬──────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │  Market Insights    │
              │   & Dashboards      │
              └─────────────────────┘
```

## Running with Docker

### Prerequisites

Install:

- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)

### 1. Clone the repository

```bash
git clone https://github.com/yemizerfe/EstatePlus.git
cd estateplus
``` 

### 2. Configure the environment

```bash
cp backend/.env.production.example .env
# then set JWT_SECRET and JWT_REFRESH_SECRET in .env
```

For Neon, also set `DATABASE_URL` to Neon’s pooled connection string and
`DIRECT_URL` to its direct (non-pooled) connection string. Prisma uses the
direct URL for database migrations. Both connections must target the same Neon
database and include `sslmode=require`. If these values are blank, Compose uses
its bundled PostgreSQL container instead.

### 3. Build and start the application

```bash
docker compose up --build
```

To run the containers in the background:

```bash
docker compose up --build -d
```

### 4. Stop the application

```bash
docker compose down
```

To remove the associated volumes as well:

```bash
docker compose down -v
```

> The exact services, ports, and environment variables depend on the Docker Compose configuration included in this repository.

### 5. First boot on an empty database

The API applies the reference dataset that ships with the server build
(`backend/prisma/seed-data/reference-data.json`: neighbourhoods, listings, market
statistics, economic and macro indicators, exchange rates, amenities, boundaries)
the first time it starts against a database with no neighbourhoods. Existing rows
are never overwritten, and no personal data is included. Set
`REFERENCE_DATA_BOOTSTRAP=off` in `.env` to skip this.

For non-Docker deployments, run `npm run db:migrate` from `backend/` as a
pre-deploy/release command before starting the API with `npm start` (or use
`npm run start:deploy` when the host supports a single start command). The API
then bootstraps an empty database before listening. `DATABASE_URL` and
`DIRECT_URL` must be available to the migration command.

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` to have an admin account created
on the same boot, so you can sign in and run the integrations' **Sync now**
actions in the deployed app.

Uploads and imported rows are stored in the configured PostgreSQL database.
Market pages read from that database; after deploying against Neon, use the
admin integrations page to sync live source data. The reference snapshot is
loaded only when the database has no neighborhoods, and will not overwrite
existing Neon data.

## Project Structure

```text
docker-compose.yml   Production stack: postgres, redis, api, web, optional worker
README.md / LICENSE  Repository-level files only

backend/             Express + TypeScript API, Prisma schema, Dockerfile, .gitignore
frontend/            React SPA, nginx config, Dockerfile, .gitignore
```

Every application file lives in `backend/` or `frontend/`. The root keeps only the
Compose stack and repository files; `.env` is created at the root from
`backend/.env.production.example` because Docker Compose reads it there.

## Development

To view running containers:

```bash
docker compose ps
```

To view application logs:

```bash
docker compose logs -f
```


## Project Goals

EstatePlus focuses on applying practical software engineering concepts to a real-world domain.

The project emphasizes:

- Backend API development
- Relational database design
- Data modeling
- External API and service integration
- Data processing
- Maintainable application architecture
- Turning property data into useful market information

## Security

The application is designed with secure development practices in mind, including:

- Environment-based configuration
- Protection of sensitive credentials
- Input validation
- Authentication and authorization where required
- Secure API development practices

## Project Status

EstatePlus is an actively developed project focused on backend engineering, data management, external data integration, and real estate market intelligence.

## Author

**Yemisrach Zerfe**

Backend-focused Software Engineer interested in APIs, databases, system design, and data-driven applications.
