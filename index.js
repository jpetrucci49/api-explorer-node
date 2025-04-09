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

const redisClient = redis.createClient({ url: `redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}` });
redisClient.connect();
app.set("etag", false); // Disable etag to avoid 304 "Not Modified" status codes when returning cached responses

// Middleware
app.use(cors({ exposedHeaders: ['X-Cache'] })); // Allow cross-origin requests from frontend
app.use(morgan("dev")); // Log requests to console

const fetchGitHub = async (url) => {
  const response = await axios.get(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },  // TOKEN generated from github > settings > dev settings > access tokens > classic
  });
  return response.data;
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
    return res.status(400).json({ error: "Username is required" });
  }

  const cacheKey = `github:${username}`;
  const cached = await redisClient.get(cacheKey);

  if (cached) {
    return res.status(200).set("X-Cache", "HIT").json(JSON.parse(cached)); // Set status 200, and X-Cache to "HIT", RETURN data to terminate.
  }

  try {
    const response = await fetchGitHub(`${GITHUB_API_URL}/users/${username}`);
    await redisClient.setEx(cacheKey, 1800, JSON.stringify(response));
    res.set("X-Cache", "MISS").json(response); // set X-Cache to "MISS" since it missed the cache check.
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json({ detail: "GitHub API error" });
    } else {
      res.status(500).json({ detail: "Failed to reach GitHub" });
    }
  }
});

app.get("/analyze", async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ detail: "Username is required" });
  }

  const cacheKey = `analyze:${username}`;
  const cached = await redisClient.get(cacheKey);

  if (cached) {
    return res.status(200).set("X-Cache", "HIT").json(JSON.parse(cached));
  }

  try {
    const analysis = await analyzeProfile(username);
    await redisClient.setEx(cacheKey, 1800, JSON.stringify(analysis));
    res.set("X-Cache", "MISS").json(analysis);
  } catch (error) {
    if (error.response) {
      res.status(error.response.status).json({ detail: "GitHub API error" });
    } else {
      res.status(500).json({ detail: "Failed to analyze profile" });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});