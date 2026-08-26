import { useState, useRef, useEffect, useCallback } from "react";
import { Room, WSMessage, Player } from "../types";
import { warmUpAudioEngine } from "../utils/audio";

export interface ChatMessage {
  sender: string;
  text: string;
  color: string;
}

export function useMultiplayerSocket() {
  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connError, setConnError] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [myPlayerId, setMyPlayerId] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [takenLobbyColors, setTakenLobbyColors] = useState<string[]>([]);
  const [raceStartTime, setRaceStartTime] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const currentCredentialsRef = useRef<{ name: string; color: string; roomId: string }>({
    name: "",
    color: "",
    roomId: "LOBBY",
  });

  const connect = useCallback((roomId: string, name: string, color: string) => {
    if (!name.trim()) return;
    warmUpAudioEngine();
    setIsConnecting(true);
    setConnError("");

    const targetRoomId = (roomId || "LOBBY").trim().toUpperCase();
    currentCredentialsRef.current = { name: name.trim(), color, roomId: targetRoomId };

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    try {
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        setIsJoined(true);
        const joinPayload: WSMessage = {
          type: "join_room",
          roomId: targetRoomId,
          name: name.trim(),
          color,
        };
        ws.send(JSON.stringify(joinPayload));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage;
          switch (msg.type) {
            case "room_state": {
              setRoom(msg.room);
              const matchingId = Object.keys(msg.room.players).find(
                (pId) =>
                  msg.room.players[pId].name === currentCredentialsRef.current.name &&
                  msg.room.players[pId].color === currentCredentialsRef.current.color
              );
              if (matchingId) {
                setMyPlayerId(matchingId);
              }
              break;
            }

            case "game_started": {
              setRaceStartTime(msg.startTime);
              (window as any).raceStartTime = msg.startTime;
              break;
            }

            case "game_ended": {
              // Game completed
              break;
            }

            case "chat_msg": {
              setChatMessages((prev) =>
                [...prev, { sender: msg.sender, text: msg.message, color: msg.color }].slice(-40)
              );
              break;
            }

            case "error": {
              setConnError(msg.message);
              break;
            }
          }
        } catch (e) {
          console.error("WebSocket message parsing error:", e);
        }
      };

      ws.onclose = () => {
        setIsJoined(false);
        setRoom(null);
        setIsConnecting(false);
      };

      ws.onerror = () => {
        setConnError("Unable to establish connection to multiplayer grid server.");
        setIsConnecting(false);
      };
    } catch (err) {
      console.error(err);
      setIsConnecting(false);
      setConnError("Networking initialization failed.");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsJoined(false);
    setRoom(null);
    setChatMessages([]);
    setRaceStartTime(null);
  }, []);

  const sendReady = useCallback((currentReadyState: boolean) => {
    if (!wsRef.current) return;
    const readyMsg: WSMessage = { type: "ready", ready: !currentReadyState };
    wsRef.current.send(JSON.stringify(readyMsg));
  }, []);

  const startRaceByHost = useCallback(() => {
    if (!wsRef.current) return;
    const startMsg: WSMessage = { type: "start_game" };
    wsRef.current.send(JSON.stringify(startMsg));
  }, []);

  const sendChatMessage = useCallback((text: string) => {
    if (!text.trim() || !wsRef.current) return;
    const chatMsg: WSMessage = { type: "chat", message: text.trim() };
    wsRef.current.send(JSON.stringify(chatMsg));
  }, []);

  const updateLocalPlayerState = useCallback((stateUpdates: Partial<Player>) => {
    if (!wsRef.current) return;
    const updateMsg: WSMessage = { type: "update_state", state: stateUpdates };
    wsRef.current.send(JSON.stringify(updateMsg));
  }, []);

  // Poll taken colors for selected room
  const pollRoomColors = useCallback((roomId: string) => {
    const targetRoomId = (roomId || "LOBBY").trim().toUpperCase();
    fetch(`/api/room/${targetRoomId}/colors`)
      .then((res) => {
        if (res.ok) return res.json();
        return { takenColors: [] };
      })
      .then((data) => {
        setTakenLobbyColors(data.takenColors || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const playersList: Player[] = room ? (Object.values(room.players) as Player[]) : [];
  const localRacer = room && myPlayerId ? room.players[myPlayerId] : null;
  const isHost = !!localRacer?.isHost;

  return {
    isJoined,
    isConnecting,
    connError,
    room,
    myPlayerId,
    playersList,
    localRacer,
    isHost,
    chatMessages,
    takenLobbyColors,
    raceStartTime,
    connect,
    disconnect,
    sendReady,
    startRaceByHost,
    sendChatMessage,
    updateLocalPlayerState,
    pollRoomColors,
  };
}
