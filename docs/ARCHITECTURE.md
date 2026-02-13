# Architecture

## Overview
Connsura is a React frontend (Vite) paired with a Node/Express backend using Prisma.
The frontend calls the backend API for auth, agents, customers, messages, and admin tasks.

## Components
- connsura-frontend: React + Vite UI, API base comes from VITE_API_URL.
- connsura-backend: Express API, Prisma ORM, serves /uploads and /forms.
- Database: PostgreSQL in dev and staging (staging runs in Docker, localhost-only).
- Static assets: forms at /forms, uploads at /uploads.

## Runtime (staging)
- AWS EC2 (Ubuntu 22.04.5 LTS, us-east-1) with Elastic IP hosts the staging stack.
- Nginx reverse proxy routes:
  - https://staging.connsura.com -> frontend container (Vite preview on port 4173).
  - https://api.staging.connsura.com -> backend container (Express on port 8000).
- Docker Compose builds and runs frontend/backend containers.
