import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import { PERSONA_SYSTEM_PROMPT, makeBotReply } from "../src/persona.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 8787);
const ollamaHost = (process.env.OLLAMA_HOST ?? "http://localhost:11434").replace(
  /\/$/,
  ""
);
const model = process.env.OLLAMA_MODEL ?? "llama3.2";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distPath = path.resolve(__dirname, "../dist");

app.use(express.json({ limit: "1mb" }));

async function fetchOllama(pathname, options = {}) {
  const timeoutMs = options.timeoutMs ?? 60000;
  const { timeoutMs: _timeoutMs, ...fetchOptions } = options;

  return fetch(`${ollamaHost}${pathname}`, {
    ...fetchOptions,
    signal: AbortSignal.timeout(timeoutMs),
  });
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .slice(-20)
    .map((message) => ({
      role:
        message?.role === "bot" || message?.role === "assistant"
          ? "assistant"
          : "user",
      content: String(message?.text ?? "").trim().slice(0, 2000),
    }))
    .filter((message) => message.content.length > 0);
}

function latestUserText(messages) {
  const latest = [...messages].reverse().find((message) => message.role === "user");
  return latest?.content ?? "";
}

app.get("/api/health", async (_request, response) => {
  try {
    const ollamaResponse = await fetchOllama("/api/tags", {
      method: "GET",
      timeoutMs: 1500,
    });

    response.json({
      ok: true,
      provider: "ollama",
      aiEnabled: ollamaResponse.ok,
      host: ollamaHost,
      model,
    });
  } catch {
    response.json({
      ok: true,
      provider: "ollama",
      aiEnabled: false,
      host: ollamaHost,
      model,
      reason: "ollama_not_running",
    });
  }
});

app.post("/api/chat", async (request, response) => {
  const messages = normalizeMessages(request.body?.messages);
  const lastUserMessage = latestUserText(messages);

  if (!messages.length || !lastUserMessage) {
    response.status(400).json({ error: "messages are required" });
    return;
  }

  try {
    const result = await fetchOllama("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          {
            role: "system",
            content: PERSONA_SYSTEM_PROMPT,
          },
          ...messages,
        ],
        options: {
          temperature: 0.85,
          num_predict: 500,
        },
      }),
    });

    if (!result.ok) {
      const errorBody = await result.text();
      throw new Error(`Ollama request failed: ${result.status} ${errorBody}`);
    }

    const data = await result.json();
    const text = data?.message?.content?.trim();
    if (!text) {
      throw new Error("Ollama response did not include message.content");
    }

    response.json({ mode: "ollama", model, text });
  } catch (error) {
    console.error("Ollama request failed:", error);
    response.json({
      mode: "fallback",
      reason: "ollama_request_failed",
      text: makeBotReply(lastUserMessage),
    });
  }
});

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((request, response, next) => {
    if (request.method === "GET" && !request.path.startsWith("/api")) {
      response.sendFile(path.join(distPath, "index.html"));
      return;
    }
    next();
  });
}

app.listen(port, () => {
  console.log(
    `Chat server listening on http://localhost:${port} (Ollama: ${model} at ${ollamaHost})`
  );
});
