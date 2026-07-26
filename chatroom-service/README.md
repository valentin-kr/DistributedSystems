# Chatroom Service

Spring Boot REST API for time-limited chatrooms.

## Run Locally

Start PostgreSQL from the repository root:

```bash
docker compose up -d chatroom-db
```

Start the service from this directory:

```bash
./mvnw spring-boot:run
```

Base URL:

```text
http://localhost:8080
```

## Response Shapes

Chatroom response:

```json
{
  "id": 1,
  "name": "Study Group",
  "description": "Room for distributed systems exam prep",
  "seqId": 0,
  "createdAt": "2026-07-26T16:30:00",
  "expiryDate": "2026-07-26T18:30:00",
  "active": true,
  "memberIds": [42]
}
```

Message response:

```json
{
  "seqId": 1,
  "text": "hello",
  "authorID": 42,
  "timestamp": "2026-07-26T16:31:00"
}
```

Error response:

```json
{
  "timestamp": "2026-07-26T16:31:00",
  "status": 404,
  "error": "Not Found",
  "message": "Chatroom 99 not found"
}
```

## REST Endpoints

### Create Chatroom

```http
POST /chatrooms
```

Request body:

```json
{
  "name": "Study Group",
  "description": "Room for distributed systems exam prep",
  "expiryHours": 2,
  "userId": 42
}
```

Response: `201 Created` with one chatroom response.

Note: `description` is optional. If omitted, it is stored as `null`.

### List Chatrooms

```http
GET /chatrooms
```

Request body: none.

Response: `200 OK` with a list of chatroom responses.

### Get Chatroom By ID

```http
GET /chatrooms/{id}
```

Request body: none.

Response: `200 OK` with one chatroom response.

### Edit Chatroom

```http
PATCH /chatrooms/{id}
```

Request body:

```json
{
  "name": "New Study Group Name",
  "description": "Updated room description"
}
```

Response: `200 OK` with the updated chatroom response.

Both fields are optional. Send only `name` to rename, only `description` to edit the description, or both.

### Delete Chatroom

```http
DELETE /chatrooms/{id}
```

Request body: none.

Response: `204 No Content`.

### Add Member

```http
POST /chatrooms/{id}/members
```

Request body:

```json
{
  "userId": 7
}
```

Response: `200 OK` with the updated chatroom response.

### List Members

```http
GET /chatrooms/{id}/members
```

Request body: none.

Response: `200 OK` with a list of user IDs in the chatroom.

Example response:

```json
[42, 7]
```

### Send Message

```http
POST /chatrooms/{id}/messages
```

Request body:

```json
{
  "chatroomId": 1,
  "text": "hello",
  "userId": 42
}
```

Response: `201 Created` with one message response.

Note: the service uses the `{id}` path variable as the chatroom ID. `chatroomId` exists in the request DTO but is currently not used by the controller.

Note: message responses include only `authorID`. Author display data should be fetched from user-service by `userId`.

### List Messages

```http
GET /chatrooms/{id}/messages
```

Request body: none.

Response: `200 OK` with a list of message responses ordered by sequence ID.

## Error Statuses

Known API errors:

```text
404 Not Found  - chatroom does not exist
403 Forbidden  - user is not a chatroom member
409 Conflict   - chatroom is expired and no longer accepts messages
```
