# API Explorer Node.js Backend

A RESTful API built with Node.js and Express to fetch GitHub user data. Integrates with the [API Explorer Frontend](https://github.com/jpetrucci49/api-explorer-frontend).

## Features
- Endpoint: `/github?username={username}`
- Returns GitHub user details (e.g., name, repos, stars)

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
   Runs on `http://localhost:3001`.

## Usage
- GET `/github?username=octocat` to fetch data for "octocat"
- Test with `curl` or the frontend

## Example Response
```json
{
  "login": "octocat",
  "name": "The Octocat",
  "public_repos": 8,
  "followers": 1234
}
```

## Next Steps
- Add caching for GitHub API calls
- Deploy to a hosting service (e.g., Render)

---
Built by Joseph Petrucci | March 2025