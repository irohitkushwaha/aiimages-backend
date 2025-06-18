import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import passport from "passport";
import http from "http";
import userRouter from "./routes/user.router.js";
import imageRouter from "./routes/image.router.js";
import { serve } from "inngest/express";
import { inngest } from "./inngest/client.js";
import { BulkAiImageGeneration } from "./inngest/functions/image-generation.js";
// import { Client } from "@elastic/elasticsearch";
// import {
//   createIndexes,
//   indexAllVideos,
// } from "./controllers/elasticsearch.controller.js";

import fs from "fs";
const tempDir = "./public/temp";
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
  console.log("Created missing directory:", tempDir);
}

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);

app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(express.static("public"));

app.use(cookieParser());

app.use(passport.initialize());

app.use("/test", (req, res) => {
  res.send("<h1>Server is working of ai generated images!</h1>");
});

const server = http.createServer(app);

app.use("/api/user", userRouter);
app.use("/api/image", imageRouter);

app.use(
  "/api/inngest",
  serve({
    client: inngest,
    functions: [BulkAiImageGeneration],
  })
);

app.get("/api/start-automation", async function (req, res, next) {
  await inngest
    .send({
      name: "ai/image-generation.start",
    })
    .catch((err) => next(err));
  res.json({ message: "Event sent!" });
});

// const client = new Client({ node: process.env.ELASTICSEARCH_URL });

const testElasticsearchConnection = async () => {
  try {
    const info = await client.info();
    console.log("Elasticsearch connected successfully:", info.name);
    await createIndexes();
    await indexAllVideos();
  } catch (error) {
    console.error("Elasticsearch connection error:", error);
  }
};

// testElasticsearchConnection();

// Global error handler - Add this to prevent server crashes
app.use((err, req, res, next) => {
  const statusCode = err.statuscode || 500;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: err.error || [],
  });
});

export { server }; //client also export
