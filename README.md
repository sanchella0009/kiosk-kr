Киоск детского лагеря: веб-приложение с публичным киоском и админкой.

## Локальный запуск

Подготовка базы без Docker:

```bash
npm run prisma:generate
npm run db:push
npm run seed:main-admin
```

Запуск dev-сервера:

```bash
npm run dev
```

Киоск: [http://localhost:3000](http://localhost:3000)  
Админка: [http://localhost:3000/adm](http://localhost:3000/adm)

## Docker

Локальный запуск контейнеров:

```bash
docker compose up --build
```

После первого запуска создайте главного админа:

```bash
docker compose run --rm kiosk-web npm run seed:main-admin
```

## Git

В репозитории уже настроен `.gitignore` под `node_modules`, `.next`, локальные `.env` и загруженные файлы в `public/uploads`.

Первичная настройка нового клона:

```bash
cp .env.example .env
```

Дальше заполните реальные значения в `.env`.

## Деплой На Сервер

Рекомендуемый процесс:

1. На локальной машине: `git add -A && git commit -m "..." && git push`
2. На сервере: `git pull --ff-only`
3. Затем выполнить один из режимов:

Только изменения `src/`, стилей, API и админки:

```bash
./scripts/deploy.sh web
```

Полное обновление, если менялись `Dockerfile`, `package-lock.json`, `music-service/` или состав контейнеров:

```bash
./scripts/deploy.sh all
```

## Переменные Окружения

Шаблон лежит в `.env.example`. Реальные секреты в git не коммитятся.

Основные переменные:

```bash
DATABASE_URL="file:./dev.db"
MAIN_ADMIN_USER="admin"
MAIN_ADMIN_PASS="change-me"
TELEGRAM_BOT_TOKEN="replace-me"
YANDEX_MUSIC_TOKEN="replace-me"
MUSIC_SERVICE_URL="http://kiosk-music:3010"
NEXT_PUBLIC_WS_URL="wss://example.com/ws"
WS_BROADCAST_URL="http://kiosk-ws:3001/broadcast"
```

## Оффлайн-Режим

Service Worker кэширует приложение и позволяет открывать киоск без интернета.
