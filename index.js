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
const GITHUB_API_URL = "https://api.github.com";

const redisClient = redis.createClient({
  url: `redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`,
  socket: {
    reconnectStrategy: false, // Disable reconnection
  },
});

redisClient.connect().catch((err) => {
  console.error('Initial Redis connection failed:', err);
});

redisClient.on('error', (err) => {
  console.error('Redis error:', err.message);
});

app.set("etag", false); // Disable etag to avoid 304 "Not Modified" status codes when returning cached responses

// Middleware
app.use(cors({ exposedHeaders: ['X-Cache'] })); // Allow cross-origin requests from frontend
app.use(morgan("dev")); // Log requests to console

const fetchGitHub = async (url) => {
  try {
    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },  // TOKEN generated from github > settings > dev settings > access tokens > classic
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

const analyzeProfile = async (username) => {
  const userData = await fetchGitHub(`${GITHUB_API_URL}/users/${username}`);
  const repos = await fetchGitHub(`${userData.repos_url}?per_page=100`);
  const languages = await Promise.all(
    repos.map((r) =>
      fetchGitHub(r.languages_url).catch((e) => ({ error: e }))
    )
  );

  const langStats = languages.reduce((acc, langData) => {
    if (langData.error) return acc; // Skip errors
    for (const [lang, bytes] of Object.entries(langData)) {
      acc[lang] = (acc[lang] || 0) + bytes;
    }
    return acc;
  }, {});

  return {
    login: userData.login,
    publicRepos: userData.public_repos,
    topLanguages: Object.entries(langStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang, bytes]) => ({ lang, bytes })),
  };
};

// Endpoint to fetch GitHub user data
app.get("/github", async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({
      detail: { status: 400, detail: "Username is required", extra: {} },
    });
  }

  const cacheKey = `github:${username}`;
  let cached;
  try {
    cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.status(200).set("X-Cache", "HIT").json(JSON.parse(cached));
    }
  } catch (error) {
    console.error('Redis get error:', error.message);
  }

  try {
    const response = await fetchGitHub(`${GITHUB_API_URL}/users/${username}`);
    try {
      await redisClient.setEx(cacheKey, 1800, JSON.stringify(response));
    } catch (error) {
      console.error('Redis set error:', error.message);
    }
    res.set("X-Cache", "MISS").json(response);
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      let detail = "GitHub API error";
      const extra = {};
      if (status === 404) detail = "GitHub user not found";
      else if (status === 429) {
        detail = "GitHub rate limit exceeded";
        extra.remaining = error.response.headers["x-ratelimit-remaining"] || "0";
      }
      else if (status === 400) detail = "Invalid GitHub API request";
      return res.status(status).json({ detail: { status, detail, extra } });
    } else {
      return res.status(500).json({
        detail: { status: 500, detail: "Network error contacting GitHub", extra: {} },
      });
    }
  }
});

app.get("/analyze", async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({
      detail: { status: 400, detail: "Username is required", extra: {} },
    });
  }

  const cacheKey = `analyze:${username}`;
  let cached;
  try {
    cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.status(200).set("X-Cache", "HIT").json(JSON.parse(cached));
    }
  } catch (error) {
    console.error('Redis get error:', error.message);
  }

  try {
    const analysis = await analyzeProfile(username);
    try {
      await redisClient.setEx(cacheKey, 1800, JSON.stringify(analysis));
    } catch (error) {
      console.error('Redis set error:', error.message);
    }
    res.set("X-Cache", "MISS").json(analysis);
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      let detail = "GitHub API error";
      const extra = {};
      if (status === 404) detail = "GitHub user not found";
      else if (status === 429) {
        detail = "GitHub rate limit exceeded";
        extra.remaining = error.response.headers["x-ratelimit-remaining"] || "0";
      }
      else if (status === 400) detail = "Invalid GitHub API request";
      return res.status(status).json({ detail: { status, detail, extra } });
    } else {
      return res.status(500).json({
        detail: { status: 500, detail: "Network error analyzing profile", extra: {} },
      });
    }
  }
});

app.post("/clear-cache", async (req, res) => {
  try {
    await redisClient.flushDb();
    res.json({ detail: "Cache cleared successfully" });
  } catch (error) {
    console.error('Redis flush error:', error.message);
    return res.status(500).json({
      detail: { status: 500, detail: "Redis connection failed", extra: {} },
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});