# Initial Architecture

Gatherly uses one repository for both applications. The frontend and API remain separate applications so they can be run and deployed independently.

```text
Browser
  ↓
apps/web (React or Next.js)
  ↓ HTTP API
apps/api (ExpressJS)
  ↓
MongoDB
```

The API owns authentication, authorization, ticket sales, quota updates, QR-code validation, and database access. The web application presents the interface and consumes the API.
