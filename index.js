const express = require("express");
const axios = require("axios");
const cors = require("cors");
const morgan = require("morgan");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;
const TOKEN = process.env.GITHUB_TOKEN;
const cache = new Map(); // Data Map to store past queries
app.set("etag", false); // Disable etag to avoid 304 "Not Modified" status codes when returning cached responses
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes TTL (time to live) in ms

// Middleware
app.use(cors()); // Allow cross-origin requests from frontend
app.use(morgan("dev")); // Log requests to console

// Endpoint to fetch GitHub user data
app.get("/github", async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  const cacheKey = `github:${username}`;
  const cached = cache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) { // if cached is not 'undefined' and timestamp is less than 30 minutes old
    return res.status(200).set("X-Cache", "HIT").json(cached.result); // Set status 200, and X-Cache to "HIT", RETURN result to terminate.
  }

  try {
    const response = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },  // TOKEN generated from github > settings > dev settings > access tokens > classic
    });
    const result = response.data
    cache.set(cacheKey, { result, timestamp: Date.now() }); // If we've made it here, result is stale or has not been cached, so cache it. timestamp used to keep fresh.
    res.set("X-Cache", "MISS").json(result); // set X-Cache to "MISS" since it missed the cache check.
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json({ detail: "GitHub API error" });
    } else {
      res.status(500).json({ detail: "Failed to reach GitHub" });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});