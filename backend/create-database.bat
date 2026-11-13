@echo off
REM Create PostgreSQL database for Real Estate App

echo Creating database 'realestate_db'...

REM Set password environment variable
set PGPASSWORD=12345

REM Create the database
psql -U postgres -h localhost -c "CREATE DATABASE realestate_db;"

REM Enable extensions
psql -U postgres -h localhost -d realestate_db -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
psql -U postgres -h localhost -d realestate_db -c "CREATE EXTENSION IF NOT EXISTS \"postgis\";"
psql -U postgres -h localhost -d realestate_db -c "CREATE EXTENSION IF NOT EXISTS \"pg_trgm\";"

echo.
echo Database created successfully!
echo Now run: npx prisma migrate dev --name init
pause
