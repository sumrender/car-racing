import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { WSMessage } from "../src/types";
import { roomManager } from "./roomManager";
import { leaderboardManager } from "./leaderboard";

interface ClientSession {
  roomId: string;
  playerId: string;
}

export function setupWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({ server });
  const clientInfo = new Map<WebSocket, ClientSession>();

  function broadcastRoomState(roomId: string) {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const message: WSMessage = { type: "room_state", room };
    const payload = JSON.stringify(message);

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
      color,
    };
    const payload = JSON.stringify(message);
    for (const [ws, info] of clientInfo.entries()) {
      if (info.roomId === roomId && ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    }
  }

  function handleLeave(ws: WebSocket) {
    const info = clientInfo.get(ws);
    if (!info) return;

    const { roomId, playerId } = info;
    clientInfo.delete(ws);

    const { room, leavingPlayer, newHost } = roomManager.removePlayer(roomId, playerId);
    if (leavingPlayer) {
      console.log(`Player ${leavingPlayer.name} left room: ${roomId}`);
      if (room) {
        if (newHost) {
          console.log(`Reassigned host of room ${roomId} to ${newHost.name}`);
        }
        broadcastChatMessage(roomId, "SYSTEM", `${leavingPlayer.name} disconnected from lobby.`, "#ef4444");
        broadcastRoomState(roomId);
      } else {
        console.log(`Room ${roomId} is now empty. Cleaned up.`);
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

            const existing = clientInfo.get(ws);
            if (existing) {
              handleLeave(ws);
            }

            const { player } = roomManager.addPlayer(cleanedRoomId, playerId, name, color);
            clientInfo.set(ws, { roomId: cleanedRoomId, playerId });

            console.log(`Player ${player.name} (ID: ${playerId}) joined Room: ${cleanedRoomId}`);
            broadcastRoomState(cleanedRoomId);
            broadcastChatMessage(cleanedRoomId, "SYSTEM", `${player.name} connected to the race lobby.`, "#10b981");
            break;
          }

          case "leave_room": {
            handleLeave(ws);
            break;
          }

          case "ready": {
            const info = clientInfo.get(ws);
            if (!info) return;

            const room = roomManager.getRoom(info.roomId);
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

            const room = roomManager.getRoom(info.roomId);
            if (!room) return;

            const player = room.players[info.playerId];
            if (!player || !player.isHost) return;

            if (room.status === "lobby" || room.status === "results") {
              room.status = "countdown";
              room.countdown = 3;
              room.results = {};
              roomManager.resetPlayersForRace(room);

              broadcastRoomState(info.roomId);

              const interval = setInterval(() => {
                const activeRoom = roomManager.getRoom(info.roomId);
                if (!activeRoom || activeRoom.status !== "countdown") {
                  clearInterval(interval);
                  return;
                }

                activeRoom.countdown -= 1;
                if (activeRoom.countdown <= 0) {
                  clearInterval(interval);
                  activeRoom.status = "racing";
                  activeRoom.startTime = Date.now();

                  for (const [clientWs, clientInf] of clientInfo.entries()) {
                    if (clientInf.roomId === info.roomId && clientWs.readyState === WebSocket.OPEN) {
                      clientWs.send(
                        JSON.stringify({ type: "game_started", startTime: activeRoom.startTime })
                      );
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

            const room = roomManager.getRoom(info.roomId);
            if (!room) return;

            const player = room.players[info.playerId];
            if (!player) return;

            Object.assign(player, msg.state);

            if (msg.state.finished && !room.results[info.playerId]) {
              player.finished = true;
              player.finishTime =
                msg.state.finishTime || Date.now() - (room.startTime || Date.now());

              const finishersCount = Object.keys(room.results).length;
              player.place = finishersCount + 1;
              room.results[info.playerId] = player;

              broadcastChatMessage(
                info.roomId,
                "SYSTEM",
                `🏁 ${player.name} finished in position #${player.place} with time ${(
                  player.finishTime / 1000
                ).toFixed(2)}s!`,
                "#eab308"
              );

              leaderboardManager.addEntry(player.name, player.color, player.finishTime);

              const activeCount = Object.values(room.players).filter((p) => !p.finished).length;
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

            const room = roomManager.getRoom(info.roomId);
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

  return { broadcastRoomState, broadcastChatMessage };
}
