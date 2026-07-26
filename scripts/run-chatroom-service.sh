#!/usr/bin/env sh
set -eu

docker compose up -d chatroom-db

printf '%s' 'Waiting for chatroom-db'
until docker compose exec -T chatroom-db pg_isready -U chatroom -d chatroom-db >/dev/null 2>&1; do
  printf '%s' '.'
  sleep 1
done
printf '\n%s\n' 'chatroom-db is ready'

cd chatroom-service
exec ./mvnw spring-boot:run
