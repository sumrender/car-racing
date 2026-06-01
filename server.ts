import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { Player, Room, WSMessage, BestTime } from "./src/types";

// Global lists
const rooms: Record<string, Room> = {};
const bestTimes: BestTime[] = [
  { player: "AeroDrifter", color: "#f87171", timeMs: 42350, date: "2026-05-30" },
  { player: "ApexPro", color: "#60a5fa", timeMs: 45120, date: "2026-06-01" },
  { player: "GhostRacer", color: "#34d399", timeMs: 48900, date: "2026-05-15" },
  { player: "SlideMaster", color: "#fbbf24", timeMs: 51200, date: "2026-05-28" }
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Check for Leaderboard
  app.get("/api/leaderboard", (req, res) => {
    res.json(bestTimes.slice(0, 10).sort((a, b) => a.timeMs - b.timeMs));
  });

  // API to fetch taken colors in a lobby room
  app.get("/api/room/:roomId/colors", (req, res) => {
    const roomId = (req.params.roomId || "LOBBY").trim().toUpperCase();
    const room = rooms[roomId];
    if (!room) {
      res.json({ takenColors: [] });
    } else {
      res.json({ takenColors: Object.values(room.players).map(p => p.color.toLowerCase()) });
    }
  });

  app.post("/api/leaderboard", (req, res) => {
    const { player, color, timeMs } = req.body;
    if (typeof player === "string" && typeof timeMs === "number") {
      const entry: BestTime = {
        player: player.trim() || "Anonymous",
        color: color || "#ca8a04",
        timeMs,
        date: new Date().toISOString().split("T")[0]
      };
      bestTimes.push(entry);
      bestTimes.sort((a, b) => a.timeMs - b.timeMs);
      res.json({ success: true, leaderboard: bestTimes.slice(0, 10) });
    } else {
      res.status(400).json({ error: "Invalid parameters" });
    }
  });

  // Vite middleware for development
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  // Set up WebSocket server
  const wss = new WebSocketServer({ server });

  // Map to store which roomId and player ID belongs to which ws client
  const clientInfo = new Map<WebSocket, { roomId: string; playerId: string }>();

  function broadcastRoomState(roomId: string) {
    const room = rooms[roomId];
    if (!room) return;

    const message: WSMessage = { type: "room_state", room };
    const payload = JSON.stringify(message);

    // Filter ws clients for this room and send state
    for (const [ws, info] of clientInfo.entries()) {
      if (info.roomId === roomId && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  function broadcastChatMessage(roomId: string, sender: string, text: string, color: string) {
    const message: WSMessage = {
      type: "chat_msg",
      sender,
      message: text,
      color
    };
    const payload = JSON.stringify(message);
    for (const [ws, info] of clientInfo.entries()) {
      if (info.roomId === roomId && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  wss.on("connection", (ws) => {
    console.log("New client connected via WebSockets");

    ws.on("message", (rawMsg) => {
      try {
        const msg = JSON.parse(rawMsg.toString()) as WSMessage;

        switch (msg.type) {
          case "join_room": {
            const { roomId, name, color } = msg;
            const cleanedRoomId = roomId.trim().toUpperCase() || "LOBBY";
            const playerId = "_" + Math.random().toString(36).substr(2, 9);

            // Clean previous association if any
            const existing = clientInfo.get(ws);
            if (existing) {
              handleLeave(ws);
            }

            // Create room if it doesn't exist
            if (!rooms[cleanedRoomId]) {
              rooms[cleanedRoomId] = {
                id: cleanedRoomId,
                players: {},
                status: "lobby",
                countdown: 0,
                trackId: "track_1",
                results: {}
              };
            }

            const room = rooms[cleanedRoomId];
            const isHost = Object.keys(room.players).length === 0;

            // Enforce color uniqueness within the room lobby
            const currentColors = Object.values(room.players).map(p => p.color.toLowerCase());
            let assignedColor = (color || "#ef4444").toLowerCase();
            const configPresets = ["#ef4444", "#06b6d4", "#22c55e", "#a855f7", "#eab308", "#f1f5f9"];
            
            if (currentColors.includes(assignedColor)) {
              const freePreset = configPresets.find(pCol => !currentColors.includes(pCol.toLowerCase()));
              if (freePreset) {
                assignedColor = freePreset;
              } else {
                assignedColor = "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
              }
            }

            // Initialize player state
            const newPlayer: Player = {
              id: playerId,
              name: name.trim() || `Racer ${Object.keys(room.players).length + 1}`,
              color: assignedColor,
              isHost,
              ready: isHost, // Host is ready by default
              x: 0,
              y: 0,
              z: 0,
              rotationY: 0,
              speed: 0,
              driftScore: 0,
              isDrifting: false,
              driftMeter: 0,
              totalDriftScore: 0,
              lap: 1,
              checkpoint: 0,
              finished: false
            };

            room.players[playerId] = newPlayer;
            clientInfo.set(ws, { roomId: cleanedRoomId, playerId });

            console.log(`Player ${newPlayer.name} (ID: ${playerId}) joined Room: ${cleanedRoomId}`);

            // Broadcast state update
            broadcastRoomState(cleanedRoomId);
            broadcastChatMessage(cleanedRoomId, "SYSTEM", `${newPlayer.name} connected to the race lobby.`, "#10b981");
            break;
          }

          case "leave_room": {
            handleLeave(ws);
            break;
          }

          case "ready": {
            const info = clientInfo.get(ws);
            if (!info) return;

            const room = rooms[info.roomId];
            if (!room) return;

            const player = room.players[info.playerId];
            if (!player) return;

            player.ready = msg.ready;
            broadcastRoomState(info.roomId);
            break;
          }

          case "start_game": {
            const info = clientInfo.get(ws);
            if (!info) return;

            const room = rooms[info.roomId];
            if (!room) return;

            const player = room.players[info.playerId];
            if (!player || !player.isHost) return;

            // Start countdown
            if (room.status === "lobby" || room.status === "results") {
              room.status = "countdown";
              room.countdown = 3;
              room.results = {};
              
              // Reset all player race variables
              Object.values(room.players).forEach((p) => {
                p.x = 0;
                p.y = 0;
                p.z = 0;
                p.rotationY = 0;
                p.speed = 0;
                p.driftScore = 0;
                p.isDrifting = false;
                p.driftMeter = 0;
                p.totalDriftScore = 0;
                p.lap = 1;
                p.checkpoint = 0;
                p.finished = false;
                p.finishTime = undefined;
                p.place = undefined;
              });

              broadcastRoomState(info.roomId);

              const interval = setInterval(() => {
                const activeRoom = rooms[info.roomId];
                if (!activeRoom || activeRoom.status !== "countdown") {
                  clearInterval(interval);
                  return;
                }

                activeRoom.countdown -= 1;
                if (activeRoom.countdown <= 0) {
                  clearInterval(interval);
                  activeRoom.status = "racing";
                  activeRoom.startTime = Date.now();
                  
                  // Broadcast start
                  for (const [clientWs, clientInf] of clientInfo.entries()) {
                    if (clientInf.roomId === info.roomId && clientWs.readyState === WebSocket.OPEN) {
                      clientWs.send(JSON.stringify({ type: "game_started", startTime: activeRoom.startTime }));
                    }
                  }
                }
                broadcastRoomState(info.roomId);
              }, 1000);
            }
            break;
          }

          case "update_state": {
            const info = clientInfo.get(ws);
            if (!info) return;

            const room = rooms[info.roomId];
            if (!room) return;

            const player = room.players[info.playerId];
            if (!player) return;

            // Merge details
            Object.assign(player, msg.state);

            // Handle race finish calculations
            if (msg.state.finished && !room.results[info.playerId]) {
              player.finished = true;
              player.finishTime = msg.state.finishTime || (Date.now() - (room.startTime || Date.now()));
              
              // Place calculations
              const finishersCount = Object.keys(room.results).length;
              player.place = finishersCount + 1;
              room.results[info.playerId] = player;

              broadcastChatMessage(info.roomId, "SYSTEM", `🏁 ${player.name} finished in position #${player.place} with time ${(player.finishTime / 1000).toFixed(2)}s!`, "#eab308");

              // Save to Leaderboard database if they finished
              const entry: BestTime = {
                player: player.name,
                color: player.color,
                timeMs: player.finishTime,
                date: new Date().toISOString().split("T")[0]
              };
              bestTimes.push(entry);
              bestTimes.sort((a, b) => a.timeMs - b.timeMs);

              // Check if all players are finished or left
              const activeCount = Object.values(room.players).filter(p => !p.finished).length;
              if (activeCount === 0) {
                room.status = "results";
                for (const [clientWs, clientInf] of clientInfo.entries()) {
                  if (clientInf.roomId === info.roomId && clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ type: "game_ended", results: room.results }));
                  }
                }
              }
            }

            broadcastRoomState(info.roomId);
            break;
          }

          case "chat": {
            const info = clientInfo.get(ws);
            if (!info) return;

            const room = rooms[info.roomId];
            if (!room) return;

            const player = room.players[info.playerId];
            if (!player) return;

            broadcastChatMessage(info.roomId, player.name, msg.message, player.color);
            break;
          }

          case "ping": {
            ws.send(JSON.stringify({ type: "pong" }));
            break;
          }
        }
      } catch (err) {
        console.error("Error managing socket message:", err);
      }
    });

    ws.on("close", () => {
      console.log("Client disconnected");
      handleLeave(ws);
    });

    ws.on("error", (err) => {
      console.error("Socket error state:", err);
      handleLeave(ws);
    });
  });

  function handleLeave(ws: WebSocket) {
    const info = clientInfo.get(ws);
    if (!info) return;

    const { roomId, playerId } = info;
    clientInfo.delete(ws);

    const room = rooms[roomId];
    if (room) {
      const leavingPlayer = room.players[playerId];
      if (leavingPlayer) {
        const name = leavingPlayer.name;
        const wasHost = leavingPlayer.isHost;

        delete room.players[playerId];
        delete room.results[playerId];

        console.log(`Player ${name} left room: ${roomId}`);

        // Clean up or reassign host
        const remainingPlayers = Object.keys(room.players);
        if (remainingPlayers.length === 0) {
          console.log(`Room ${roomId} is now empty. Deleting...`);
          delete rooms[roomId];
        } else {
          if (wasHost) {
            const nextHostId = remainingPlayers[0];
            room.players[nextHostId].isHost = true;
            room.players[nextHostId].ready = true; // Host ready on promotion
            console.log(`Reassigned host of room ${roomId} to ${room.players[nextHostId].name}`);
          }
          broadcastChatMessage(roomId, "SYSTEM", `${name} disconnected from lobby.`, "#ef4444");
          
          // Re-evaluate finished condition if racing
          if (room.status === "racing") {
            const activeCount = Object.values(room.players).filter(p => !p.finished).length;
            if (activeCount === 0) {
              room.status = "results";
            }
          }

          broadcastRoomState(roomId);
        }
      }
    }
  }
}

startServer();
