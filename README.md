# DistributedSystems

Git Repository for IMI Module Distributed Systems SoSe2026.
Contributors:
Sinem Reshat - s0592372
Reyhan Rumengan - s0578821
Valentin Kroll - s0596179

Project - Time Sensitive Group/Event Chats:
A group is created for a specific time, during which other members can be added and Chat functionality are accessible. After the set time, chat funcitonality is removed and members of the group can only access the media shared within the group.

## Run locally

```bash
npm run start
```

## Stop the application

```bash
npm run stop
```

Open `http://localhost:5173`. The API gateway is available at
`http://localhost:8080`.

Email/password authentication is hosted by Zitadel using OIDC Authorization.
