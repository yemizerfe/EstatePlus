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
