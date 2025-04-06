const express = require("express");
const axios = require("axios");
const cors = require("cors");
const morgan = require("morgan");
const redis = require('redis');
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;
const TOKEN = process.env.GITHUB_TOKEN;
const REDIS_HOST = process.env.REDIS_HOST;
const REDIS_PORT = process.env.REDIS_PORT;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

const redisClient = redis.createClient({ url: `redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}` });
redisClient.connect();
app.set("etag", false); // Disable etag to avoid 304 "Not Modified" status codes when returning cached responses

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
  const cached = await redisClient.get(cacheKey);

  if (cached) {
    return res.status(200).set("X-Cache", "HIT").json(JSON.parse(cached)); // Set status 200, and X-Cache to "HIT", RETURN data to terminate.
  }

  try {
    const response = await axios.get(`https://api.github.com/users/${username}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },  // TOKEN generated from github > settings > dev settings > access tokens > classic
    });
    const { data } = response
    await redisClient.setEx(cacheKey, 1800, JSON.stringify(data));
    res.set("X-Cache", "MISS").json(data); // set X-Cache to "MISS" since it missed the cache check.
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