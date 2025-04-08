# API Explorer Node.js Backend

A RESTful API built with Node.js and Express to fetch and cache GitHub user data. Integrates with the [API Explorer Frontend](https://github.com/jpetrucci49/api-explorer-frontend).

## Features

- Endpoint: `/github?username={username}`
- Returns GitHub user details (e.g., login, name, repos, followers).
- Redis caching with 30-minute TTL.

## Setup

1. **Clone the repo**  
   ```bash
   git clone https://github.com/jpetrucci49/api-explorer-node.git
   cd api-explorer-node
   ```
2. **Install dependencies**  
   ```bash
   npm install
   ```
3. **Run locally**  
   ```bash
   npm run dev
   ```
   Runs on `http://localhost:3001`. Requires Redis at `redis:6379`.

## Usage

- GET `/github?username=octocat` to fetch data for "octocat".
- Test with `curl -v` (check `X-Cache`) or the frontend.

## Example Response

```json
{
  "login": "octocat",
  "id": 583231,
  "name": "The Octocat",
  "public_repos": 8,
  "followers": 17529
}
```

## Next Steps
- Add `/analyze` endpoint for profile insights (e.g., language stats).
- Add `/network` endpoint for collaboration mapping.
- Deploy to Render or Cyclic.

---
Built by Joseph Petrucci | March 2025