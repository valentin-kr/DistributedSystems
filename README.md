# TimeChat

TimeChat is a distributed web application for time-limited group chats. A user can sign in with Zitadel, create a chatroom with an expiry time, share a six-character invite code, and chat with other members until the room expires. After expiry, the room becomes read-only: messages and media can still be viewed, but new messages, uploads, and joins are blocked. Uploaded media remains available until the retention job removes old expired rooms.

Project for **Distributed Systems SoSe 2026**.

Contributors:

- Sinem Reshat - s0592372
- Reyhan Rumengan - s0578821
- Valentin Kroll - s0596179

---

## Quick Start

For the fastest local run with the shared demo Zitadel account:

```bash
cd DistributedSystems
cp .env.example .env
# Paste the demo Zitadel values from Setup into .env before starting.
npm run start
```

Then open the [frontend URL](#urls) and sign in with the demo account listed in
[Setup](#setup). For full local setup details, see
[Running Locally](#running-locally). If you use your own Zitadel instance
instead of ours, do the
[one-time console setup](#one-time-console-setup), then copy its issuer and
client ID into `.env` as described in [Setup](#setup).

---

## Architecture

```text
Browser
  |
  |     open :5173
  v
Frontend service (React + Vite)
  |
  |     sign in / callback
  v
Zitadel OIDC (Hosted login + Authorization Code with PKCE)
  |
  |     access token stored by frontend
  v
Frontend service
  |
  |     REST + SSE with Authorization: Bearer <Zitadel access token>
  v
API Gateway (Nginx) on :8080
  |
  |--   /chatrooms/*            -> chatroom-api  (Java 21 / Spring Boot) :8082
  |--   /users/*, /auth/*       -> user-service  (Node.js HTTP server)   :3000
  |--   /presence               -> user-service  (Node.js HTTP server)   :3000
  |
  | JWT validation via Zitadel JWKS
  | user-service /auth/profile also loads Zitadel UserInfo
  v
Zitadel OIDC

Persistence and messaging
  chatroom-db  PostgreSQL 18    <- chatroom-api
  user-db      PostgreSQL 16    <- user-service
  media volume filesystem       <- chatroom-api
  Kafka message-events topic    <- chatroom-api publishes, user-service consumes
```

The gateway gives the browser one stable backend entry point. Backend services still remain independently deployable: chatroom state and profile/presence state live in different databases, and cross-service updates use Kafka.

---

## Services

### frontend-service

React SPA served by Vite in Docker.

It handles the visible TimeChat workflow:

- sign in and sign out through Zitadel OIDC Authorization Code + PKCE
- create a room with name, optional description and duration
- join a room by six-character invite code
- list rooms that include the current user
- open an active or expired room
- send text messages while active
- upload files and record voice messages while active
- display images, audio and other attachments inline
- keep the thread fresh through Server-Sent Events
- show member list, online state and last activity
- show the member-removal control only to the room creator

### chatroom-api

Spring Boot service that owns chatrooms, messages and media metadata. It uses Spring Data JPA with PostgreSQL and stores uploaded files on a Docker volume.

Main responsibilities:

- create rooms and generate unique six-character join codes
- track creator, members, creation time, expiry time and message sequence number
- check the supplied local user ID against room membership before sending messages or recording activity
- compare the supplied requester ID with the creator ID before removing members or deleting messages
- reject new messages and uploads after expiry
- keep expired rooms readable
- expose room event streams with Server-Sent Events
- publish `message.sent` and `user.activity` events to Kafka
- purge rooms that expired more than `CHATROOM_RETENTION_DAYS` days ago

### user-service

Node.js service that owns user profiles and room presence. It uses an HTTP server, PostgreSQL and KafkaJS.

Main responsibilities:

- verify Zitadel bearer tokens with JWKS using `jose`
- load trusted user profile data from Zitadel UserInfo
- expose user lookup endpoints used by the frontend to display names
- consume Kafka `message-events`
- update `users.last_active`
- upsert per-room presence in `room_presence`

The service creates its database tables at startup with `CREATE TABLE IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

### gateway

It forwards:

```text
/chatrooms  -> chatroom-api:8082
/users      -> user-service:3000
/auth       -> user-service:3000
/presence   -> user-service:3000
```

It also disables proxy buffering for `/chatrooms` so Server-Sent Events can stream correctly.

### kafka

Kafka is used for asynchronous activity. The chatroom API publishes events after messages and activity heartbeats. The user-service consumes them to update last-seen and room presence records.

Current topic:

```text
message-events
```

Example event payloads:

```json
{"type":"message.sent","userId":42,"chatroomId":1,"messageId":5,"timestamp":"2026-08-01T10:30:00Z"}
{"type":"user.activity","userId":42,"chatroomId":1,"timestamp":"2026-08-01T10:30:15Z"}
```

---

## Core Flows

### Authentication

1. User clicks "Sign in with Zitadel" and is redirected to the hosted login page.
2. User authenticates with Zitadel.
3. Zitadel redirects back to `/oidc/callback` with an authorization code.
4. Frontend exchanges the code for tokens using PKCE.
5. Frontend calls `POST /auth/profile` with the access token.
6. user-service verifies the JWT signature and issuer.
7. user-service loads Zitadel UserInfo and creates or updates the local profile.
8. Frontend stores the local user ID and OIDC tokens in `localStorage`.
9. Later API calls include `Authorization: Bearer <access_token>`.

TimeChat App does not store passwords. Zitadel handles passwords, registration, verification, and password reset.

### Creating and joining rooms

```text
Create Room:
Frontend -> POST /chatrooms
chatroom-api -> stores room, expiry, creator ID, generated join code
chatroom-api -> creator is added as first member

Join Room:
Frontend -> POST /chatrooms/join
chatroom-api -> finds active room by join code
chatroom-api -> adds requesting user ID to member list
```

### Live chat updates

```text
1. Browser opens GET /chatrooms/{id}/events as an SSE stream.
2. A member sends a message or uploads media.
3. chatroom-api persists the change.
4. chatroom-api emits "thread-changed" to SSE subscribers.
5. Browser reloads messages and media for that room.
```

The application uses SSE instead of WebSockets. The data path is still event-driven: clients keep an open event stream and refresh only when the room changes.

### Presence and last activity

```text
1. Browser sends POST /chatrooms/{id}/activity while active in the room.
2. chatroom-api verifies the user is a room member.
3. chatroom-api publishes a user.activity event to Kafka.
4. user-service consumes the event.
5. user-service updates users.last_active and room_presence.last_seen.
6. Frontend polls /presence?roomId={id} and /users to render online/last seen.
```

Online status is considered fresh for 45 seconds in the frontend.

### Expiry and retention

```text
Active room:
  messages allowed
  media uploads allowed
  join code accepted

Expired room:
  messages blocked with 409 Conflict
  media uploads blocked with 409 Conflict
  join code rejected
  messages and media still readable

Retention:
  hourly scheduled job purges rooms older than CHATROOM_RETENTION_DAYS after expiry
  media files are deleted best-effort from the media volume
```

There is also a demo endpoint on the direct chatroom API port to trigger the retention job manually. With the default `AUTH_REQUIRED=true`, it requires a valid bearer token:

```bash
curl -X POST http://localhost:8082/admin/purge-expired-chatrooms \
  -H "Authorization: Bearer $TOKEN"
```

---

## Running Locally

### Prerequisites

- Docker
- Docker Compose
- Node.js

### Setup

```bash
cp .env.example .env
```

Configure `.env` with the public Zitadel values used by the demo account:

```dotenv
AUTH_REQUIRED=true
ZITADEL_ISSUER=https://timechat-htw-z7nt6q.eu1.zitadel.cloud
ZITADEL_CLIENT_ID=384247695600032481
VITE_ZITADEL_REDIRECT_URI=http://localhost:5173/oidc/callback
VITE_ZITADEL_POST_LOGOUT_REDIRECT_URI=http://localhost:5173
VITE_ZITADEL_SCOPES=openid profile email offline_access
```

Start the full stack:

```bash
npm run start
```

Open `http://localhost:5173` and sign in with the shared demo account:

```text
Email: demo@timechat.htw
Password: Timechat_Demo_HTW_2026
```

NOTES: This account is only for local/demo use.

Alternatively, configure your own Zitadel application as described in [One-time console setup](#one-time-console-setup).

Stop it:

```bash
npm run stop
```

### URLs

| Interface                | URL                          |
| ------------------------ | ---------------------------- |
| Frontend                 | http://localhost:5173        |
| API Gateway              | http://localhost:8080        |
| Gateway health           | http://localhost:8080/health |
| Chatroom API direct port | http://localhost:8082        |
| User service direct port | http://localhost:3000        |

---

## Zitadel Config

### One-time console setup

The checked-in `docker-compose.yml` uses an external Zitadel issuer from
`.env`. It does not start a local Zitadel container. The shared demo issuer and
client ID, and demo account in [Setup](#setup) work without extra console setup.

If you use your own Zitadel
instance, open that instance's console and configure it once:

1. Create a project, for example `timechat`.
2. Create an application with type **User Agent (SPA)** and auth method
   **PKCE**.
   - Redirect URI: `http://localhost:5173/oidc/callback`
   - Post-logout redirect URI: `http://localhost:5173`
   - Access token type: `JWT`
   - Scopes: `openid profile email offline_access`
   - Development mode: enabled for HTTP localhost URLs
   - Copy the generated client ID into `.env` as `ZITADEL_CLIENT_ID`, then
     rebuild the frontend with `docker compose up --build frontend-service`.
3. In **Settings > Login Behavior and Security**, enable username/password login and leave email-address login enabled.
4. Create a user for testing, or enable registration if users should create their own accounts.

Set your issuer and generated client ID in `.env`.

Keep these frontend values aligned with the Zitadel application settings:

```dotenv
VITE_ZITADEL_REDIRECT_URI=http://localhost:5173/oidc/callback
VITE_ZITADEL_POST_LOGOUT_REDIRECT_URI=http://localhost:5173
VITE_ZITADEL_SCOPES=openid profile email offline_access
```

Both backend services verify bearer tokens independently. The chatroom API uses Spring Security OAuth2 Resource Server and the user-service uses `jose` and Zitadel JWKS.

---

## API Reference

All normal browser/API traffic goes through the gateway at:

```text
http://localhost:8080
```

When `AUTH_REQUIRED=true`, include:

```http
Authorization: Bearer <access_token>
```

### Auth and users

```text
POST  /auth/profile       Verify token, load Zitadel UserInfo, create/update local profile
GET   /users              List local users
GET   /users/{id}         Get one local user
POST  /users              Create local user manually
PATCH /users/{id}         Update username, displayName or zitadelSub
GET   /presence?roomId=1  List per-room presence rows
```

Example `POST /auth/profile` request:

```bash
curl -X POST http://localhost:8080/auth/profile \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Chatrooms

```text
POST   /chatrooms                         Create room
GET    /chatrooms                         List rooms
GET    /chatrooms/{id}                    Get room detail
PATCH  /chatrooms/{id}                    Update name/description
DELETE /chatrooms/{id}                    Delete room
POST   /chatrooms/join                    Join by invite code
POST   /chatrooms/{id}/members            Add member by user ID
GET    /chatrooms/{id}/members            List member user IDs
DELETE /chatrooms/{id}/members/{userId}   Remove member
```

Create room:

```bash
curl -X POST http://localhost:8080/chatrooms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Exam Prep","description":"Distributed systems revision","expiryHours":2,"userId":1}'
```

Join room:

```bash
curl -X POST http://localhost:8080/chatrooms/join \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code":"ABC234","userId":2}'
```

Chatroom response:

```json
{
  "id": 1,
  "name": "Exam Prep",
  "description": "Distributed systems revision",
  "creatorId": 1,
  "joinCode": "ABC234",
  "seqId": 0,
  "createdAt": "2026-08-01T10:00:00",
  "expiryDate": "2026-08-01T12:00:00",
  "active": true,
  "memberIds": [1, 2]
}
```

### Messages and events

```text
POST   /chatrooms/{id}/messages              Send message
GET    /chatrooms/{id}/messages              List messages (sorted by seqId)
DELETE /chatrooms/{id}/messages/{messageId}  Delete message
POST   /chatrooms/{id}/activity              Record user activity heartbeat
GET    /chatrooms/{id}/events                Subscribe to SSE room events
```

Send message:

```bash
curl -X POST http://localhost:8080/chatrooms/1/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"hello","userId":1}'
```

Message response:

```json
{
  "id": 5,
  "seqId": 1,
  "text": "hello",
  "authorID": 1,
  "timestamp": "2026-08-01T10:01:00Z"
}
```

### Media

```text
POST /chatrooms/{id}/media?userId=1&username=Demo  Upload multipart file
GET  /chatrooms/{id}/media                          List media metadata
GET  /chatrooms/{id}/media/{mediaId}                Download media bytes
```

Upload file:

```bash
curl -X POST "http://localhost:8080/chatrooms/1/media?userId=1&username=Demo" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./example.png"
```

Media response:

```json
{
  "id": 7,
  "filename": "example.png",
  "contentType": "image/png",
  "uploaderId": 1,
  "uploaderName": "Demo",
  "uploadedAt": "2026-08-01T10:02:00Z"
}
```

### Admin/demo

```bash
curl -X POST http://localhost:8082/admin/purge-expired-chatrooms \
  -H "Authorization: Bearer $TOKEN"
```

This demo endpoint is exposed by `chatroom-api` on port `8082`. It is not proxied through the current Nginx gateway config.

Response:

```json
{ "purged": 3 }
```

---

## Error Handling

The Spring chatroom API returns structured errors:

```json
{
  "timestamp": "2026-08-01T10:03:00",
  "status": 409,
  "error": "Conflict",
  "message": "Exam Prep is expired"
}
```

Common status codes:

| Status                    | Meaning                                                                       |
| ------------------------- | ----------------------------------------------------------------------------- |
| `401 Unauthorized`        | Missing, invalid or expired bearer token                                      |
| `403 Forbidden`           | Supplied user ID is not a member, or supplied requester ID is not the creator |
| `404 Not Found`           | Room, join code, or user not found                                            |
| `409 Conflict`            | Room expired, or duplicate user/profile data                                  |
| `503 Service Unavailable` | user-service authentication or UserInfo is not configured                     |

---

## Tests and Verification

Run chatroom service tests:

```bash
cd chatroom-service
./mvnw test
```

Build the frontend:

```bash
cd frontend-service
npm run build
```

Health checks after starting the stack:

```bash
docker compose ps
curl http://localhost:8080/health
curl http://localhost:3000/health
```

Test coverage is concentrated on `ChatroomService`: room creation, member handling, message sequencing, expiry behavior, activity recording, renaming and deletion. The frontend and user-service are primarily verified through manual end-to-end testing.

---

## Stack Summary

| Component        | Technology                                                                                |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Frontend         | React, Vite, TypeScript, `oidc-client-ts`                                                 |
| API Gateway      | Nginx                                                                                     |
| Identity         | Zitadel OIDC, Authorization Code + PKCE                                                   |
| chatroom-api     | Java 21, Spring Boot, Spring MVC, Spring Data JPA, Spring Security OAuth2 Resource Server |
| user-service     | Node.js 22, native HTTP server, PostgreSQL client `pg`, KafkaJS, `jose`                   |
| Live updates     | Server-Sent Events                                                                        |
| Message broker   | Apache Kafka                                                                              |
| Databases        | PostgreSQL 18 for chatrooms, PostgreSQL 16 for users                                      |
| Media storage    | Docker volume backed filesystem                                                           |
| Containerisation | Docker Compose                                                                            |
