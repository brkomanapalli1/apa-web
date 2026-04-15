# Web App

React + Vite web application for seniors and helpers.

## Run locally
```bash
cp .env.example .env
npm install
npm run dev
```

## Production build
```bash
npm install
npm run build
```

## Docker
```bash
docker build -t paperwork-web .
docker run -p 3000:80 paperwork-web
```
