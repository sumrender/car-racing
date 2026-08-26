import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { leaderboardManager } from "./server/leaderboard";
import { roomManager } from "./server/roomManager";
import { setupWebSocketServer } from "./server/wsHandler";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/leaderboard", (_req, res) => {
    res.json(leaderboardManager.getTop(10));
  });

  app.post("/api/leaderboard", (req, res) => {
    const { player, color, timeMs } = req.body;
    if (typeof player === "string" && typeof timeMs === "number") {
      const updated = leaderboardManager.addEntry(player, color, timeMs);
      res.json({ success: true, leaderboard: updated });
    } else {
      res.status(400).json({ error: "Invalid parameters" });
    }
  });

  app.get("/api/room/:roomId/colors", (req, res) => {
    const roomId = (req.params.roomId || "LOBBY").trim().toUpperCase();
    res.json({ takenColors: roomManager.getTakenColors(roomId) });
  });

  // Vite middleware for development vs Static file serving for production
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  // Attach modular WebSocket server
  setupWebSocketServer(server);
}

startServer();
