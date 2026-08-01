# Chatroom Service

Spring Boot REST API for TimeChat chatrooms, messages, media metadata, Server-Sent Events, and retention.

The [root README](../README.md) is the authoritative guide for architecture, full-stack setup, authentication, API payloads, known limitations, and end-to-end verification. Its [API Reference](../README.md#api-reference) documents requests and responses used by the frontend.

## Run the full application

From the repository root:

```bash
cp .env.example .env
# Configure Zitadel values as described in the root README.
npm run start
```

Open `http://localhost:5173`. Normal API traffic goes through the Nginx gateway at `http://localhost:8080`.

## Run only chatroom-api

Start its PostgreSQL database from the repository root:

```bash
docker compose up -d chatroom-db
```

Then start Spring Boot from this directory:

```bash
./mvnw spring-boot:run
```

The direct base URL is `http://localhost:8082`.

This standalone command uses application defaults: authentication and Kafka publishing are disabled unless their environment variables are supplied. Use the full Docker Compose stack when testing Zitadel, Kafka presence events, the gateway, or the frontend.

## Endpoint summary

```text
POST   /chatrooms
GET    /chatrooms
POST   /chatrooms/join
GET    /chatrooms/{id}
PATCH  /chatrooms/{id}
DELETE /chatrooms/{id}

POST   /chatrooms/{id}/members
GET    /chatrooms/{id}/members
DELETE /chatrooms/{id}/members/{userId}?requesterId={requesterId}

POST   /chatrooms/{id}/messages
GET    /chatrooms/{id}/messages
DELETE /chatrooms/{id}/messages/{messageId}?requesterId={requesterId}
POST   /chatrooms/{id}/activity
GET    /chatrooms/{id}/events

POST   /chatrooms/{id}/media?userId={userId}&username={username}
GET    /chatrooms/{id}/media
GET    /chatrooms/{id}/media/{mediaId}

POST   /admin/purge-expired-chatrooms
```

With `AUTH_REQUIRED=true`, every endpoint requires `Authorization: Bearer <access_token>`, including the direct admin endpoint.

## Tests

```bash
./mvnw test
```

Tests use an in-memory H2 database and disable Kafka publishing. Current coverage concentrates on `ChatroomService`; see the root README for the browser smoke test.
