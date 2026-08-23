import { useEffect, useRef, useState, FormEvent } from "react";
import { Trophy, Users, Send, ArrowRight, Play, CheckCircle, RotateCcw, Sparkles, MessageCircle, Sun, Moon, User, Zap, ChevronLeft, Flag, Compass, Settings, Bot, Cpu, Award } from "lucide-react";
import { Player, Room, WSMessage, BestTime } from "./types";
import RaceCanvas from "./components/RaceCanvas.tsx";
import Speedometer from "./components/Speedometer.tsx";
import Minimap from "./components/Minimap.tsx";
import SettingsModal from "./components/SettingsModal.tsx";
import { AIDifficulty, AI_DIFFICULTIES, StandingsResult, AI_RIVAL_PRESETS, createAIPackState, RacerStanding } from "./utils/aiOpponent";

export function formatTime(ms: number): string {
  if (!ms || isNaN(ms)) return "00:00.00";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
}

const CAR_COLOR_PRESETS = [
  { name: "Speed Crimson", hex: "#ef4444" },
  { name: "Cyber Cyan", hex: "#06b6d4" },
  { name: "Toxic Lime", hex: "#22c55e" },
  { name: "Apex Purple", hex: "#a855f7" },
  { name: "Neon Gold", hex: "#eab308" },
  { name: "Ghost White", hex: "#f1f5f9" },
];

export default function App() {
  // Theme state settings (Default is light mode)
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("racer_theme") as "light" | "dark") || "light"
  );

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("racer_theme", nextTheme);
  }

  // Game Mode: null (first screen asks mode), "single", or "multi"
  const [gameMode, setGameMode] = useState<null | "single" | "multi">(null);

  // Username and vehicle settings
  const [userName, setUserName] = useState(() => localStorage.getItem("racer_name") || "Racer 1");
  const [userColor, setUserColor] = useState(() => localStorage.getItem("racer_color") || "#ef4444");

  // ==================== SINGLE PLAYER STATE ====================
  const [singleStatus, setSingleStatus] = useState<"setup" | "countdown" | "racing" | "results">("setup");
  const [singleCountdown, setSingleCountdown] = useState(3);
  const [singleRaceTimeMs, setSingleRaceTimeMs] = useState(0);
  const [singleBestTime, setSingleBestTime] = useState<number | null>(() => {
    const saved = localStorage.getItem("racer_solo_best");
    return saved ? parseInt(saved, 10) : null;
  });
  const singleRaceStartRef = useRef<number>(0);
  const singleTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [singlePlayer, setSinglePlayer] = useState<Player>({
    id: "solo_player",
    name: userName || "Solo Driver",
    color: userColor,
    x: 0,
    y: 0,
    z: 0,
    rotationY: 0,
    speed: 0,
    driftScore: 0,
    isDrifting: false,
    driftMeter: 0,
    totalDriftScore: 0,
    checkpoint: 0,
    lap: 1,
    finished: false,
    finishTime: 0,
    isHost: true,
    ready: true,
    place: 1,
  });

  // AI Opponent State for Single Player Mode (Supports 1 to 5 rivals)
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>("medium");
  const [aiOpponentsCount, setAiOpponentsCount] = useState<number>(() => {
    const saved = localStorage.getItem("racer_ai_count");
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num >= 1 && num <= 5) return num;
    }
    return 3;
  });

  const [aiOpponents, setAiOpponents] = useState<Player[]>(() => {
    return createAIPackState(3, "medium").map((s) => s.player);
  });

  const [aiOpponent, setAiOpponent] = useState<Player>({
    id: "ai_opponent_0",
    name: "Apex AI",
    color: "#ef4444",
    isHost: false,
    ready: true,
    x: 3.5,
    y: 0,
    z: -2.0,
    rotationY: 0,
    speed: 0,
    driftScore: 0,
    isDrifting: false,
    driftMeter: 0,
    totalDriftScore: 0,
    checkpoint: 0,
    lap: 1,
    finished: false,
    finishTime: 0,
    place: 2,
  });

  const [aiStandings, setAiStandings] = useState<StandingsResult>({
    playerPlace: 1,
    aiPlace: 2,
    totalRacers: 4,
    gapMeters: 0,
    leadPlayerName: "Solo Driver",
    isLapping: false,
    lapsDifference: 0,
    playerProgress: 0,
    aiProgress: 0,
    allStandings: [],
  });

  // ==================== MULTIPLAYER STATE ====================
  const [roomInput, setRoomInput] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connError, setConnError] = useState("");
  const [takenLobbyColors, setTakenLobbyColors] = useState<string[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [myPlayerId, setMyPlayerId] = useState("");
  const [raceTimeMs, setRaceTimeMs] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; color: string }>>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const raceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isChatHoveredRef = useRef(false);

  // Sync user profile name/color
  useEffect(() => {
    setSinglePlayer((prev) => ({
      ...prev,
      name: userName.trim() || "Solo Driver",
      color: userColor,
    }));
  }, [userName, userColor]);

  // ==================== SINGLE PLAYER HANDLERS ====================
  function startSinglePlayerRace() {
    localStorage.setItem("racer_name", userName.trim() || "Solo Driver");
    localStorage.setItem("racer_color", userColor);
    localStorage.setItem("racer_ai_count", aiOpponentsCount.toString());

    if (singleTimerRef.current) clearInterval(singleTimerRef.current);

    setSinglePlayer({
      id: "solo_player",
      name: userName.trim() || "Solo Driver",
      color: userColor,
      x: 0,
      y: 0,
      z: 0,
      rotationY: 0,
      speed: 0,
      driftScore: 0,
      isDrifting: false,
      driftMeter: 0,
      totalDriftScore: 0,
      checkpoint: 0,
      lap: 1,
      finished: false,
      finishTime: 0,
      isHost: true,
      ready: true,
      place: 1,
    });

    const initialPack = createAIPackState(aiOpponentsCount, aiDifficulty);
    setAiOpponents(initialPack.map((s) => s.player));
    setAiOpponent(initialPack[0]?.player || {
      id: "ai_opponent_0",
      name: "Apex AI",
      color: "#ef4444",
      isHost: false,
      ready: true,
      x: 3.5,
      y: 0,
      z: -2.0,
      rotationY: 0,
      speed: 0,
      driftScore: 0,
      isDrifting: false,
      driftMeter: 0,
      totalDriftScore: 0,
      checkpoint: 0,
      lap: 1,
      finished: false,
      finishTime: 0,
      place: 2,
    });

    setAiStandings({
      playerPlace: 1,
      aiPlace: 2,
      totalRacers: aiOpponentsCount + 1,
      gapMeters: 0,
      leadPlayerName: userName.trim() || "Solo Driver",
      isLapping: false,
      lapsDifference: 0,
      playerProgress: 0,
      aiProgress: 0,
      allStandings: [],
    });

    setSingleStatus("countdown");
    setSingleCountdown(3);
    setSingleRaceTimeMs(0);

    let count = 3;
    const countInterval = setInterval(() => {
      count -= 1;
      setSingleCountdown(count);
      if (count <= 0) {
        clearInterval(countInterval);
        const startTime = Date.now();
        singleRaceStartRef.current = startTime;
        (window as any).raceStartTime = startTime;
        setSingleStatus("racing");

        if (singleTimerRef.current) clearInterval(singleTimerRef.current);
        singleTimerRef.current = setInterval(() => {
          setSingleRaceTimeMs(Date.now() - startTime);
        }, 45);
      }
    }, 1000);
  }

  function handleSinglePlayerUpdate(stateUpdates: Partial<Player>) {
    setSinglePlayer((prev) => {
      const updated = { ...prev, ...stateUpdates };

      if (stateUpdates.finished && !prev.finished) {
        const finalTime = Date.now() - singleRaceStartRef.current;
        updated.finishTime = finalTime;
        updated.finished = true;
        if (singleTimerRef.current) {
          clearInterval(singleTimerRef.current);
          singleTimerRef.current = null;
        }
        setSingleStatus("results");

        setSingleBestTime((oldBest) => {
          if (!oldBest || finalTime < oldBest) {
            localStorage.setItem("racer_solo_best", finalTime.toString());
            return finalTime;
          }
          return oldBest;
        });
      }

      return updated;
    });
  }

  function handleAIPackUpdate(
    pack: Player[],
    standings: StandingsResult
  ) {
    setAiOpponents(pack);
    if (pack[0]) setAiOpponent(pack[0]);
    setAiStandings(standings);
    setSinglePlayer((prev) => {
      if (prev.place !== standings.playerPlace) {
        return { ...prev, place: standings.playerPlace };
      }
      return prev;
    });
  }

  function handleAIOpponentUpdate(
    aiPlayer: Player,
    standings: StandingsResult
  ) {
    setAiOpponent(aiPlayer);
    setAiStandings(standings);
    setSinglePlayer((prev) => {
      if (prev.place !== standings.playerPlace) {
        return { ...prev, place: standings.playerPlace };
      }
      return prev;
    });
  }

  function handleSinglePlayerRestart() {
    startSinglePlayerRace();
  }

  function handleExitToMainMenu() {
    if (singleTimerRef.current) {
      clearInterval(singleTimerRef.current);
      singleTimerRef.current = null;
    }
    if (raceTimerRef.current) {
      clearInterval(raceTimerRef.current);
      raceTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsJoined(false);
    setRoom(null);
    setSingleStatus("setup");
    setGameMode(null);
  }

  // ==================== MULTIPLAYER HANDLERS ====================
  function handleConnect(joinedRoomId?: string) {
    if (!userName.trim()) return;
    setIsConnecting(true);
    setConnError("");

    localStorage.setItem("racer_name", userName.trim());
    localStorage.setItem("racer_color", userColor);

    const targetRoomId = (joinedRoomId || roomInput || "LOBBY").trim().toUpperCase();
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        setIsJoined(true);
        const joinPayload: WSMessage = {
          type: "join_room",
          roomId: targetRoomId,
          name: userName.trim(),
          color: userColor,
        };
        ws.send(JSON.stringify(joinPayload));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as WSMessage;
          switch (msg.type) {
            case "room_state":
              setRoom(msg.room);
              const matchingId = Object.keys(msg.room.players).find(
                (pId) =>
                  msg.room.players[pId].name === userName.trim() &&
                  msg.room.players[pId].color === userColor
              );
              if (matchingId) {
                setMyPlayerId(matchingId);
              }
              break;

            case "game_started":
              (window as any).raceStartTime = msg.startTime;
              setRaceTimeMs(0);
              if (raceTimerRef.current) clearInterval(raceTimerRef.current);
              raceTimerRef.current = setInterval(() => {
                const elapsed = Date.now() - msg.startTime;
                setRaceTimeMs(elapsed);
              }, 45);
              break;

            case "game_ended":
              if (raceTimerRef.current) {
                clearInterval(raceTimerRef.current);
                raceTimerRef.current = null;
              }
              break;

            case "chat_msg":
              setChatMessages((prev) => [
                ...prev,
                { sender: msg.sender, text: msg.message, color: msg.color },
              ].slice(-40));
              break;

            case "error":
              setConnError(msg.message);
              break;
          }
        } catch (e) {
          console.error("Corrupted message:", e);
        }
      };

      ws.onclose = () => {
        setIsJoined(false);
        setRoom(null);
        setIsConnecting(false);
        if (raceTimerRef.current) {
          clearInterval(raceTimerRef.current);
          raceTimerRef.current = null;
        }
      };

      ws.onerror = () => {
        setConnError("Unable to establish connections to grid server.");
        setIsConnecting(false);
      };
    } catch (err) {
      console.error(err);
      setIsConnecting(false);
      setConnError("Networking protocols initialization failure.");
    }
  }

  function handleSendReady(currentReadyState: boolean) {
    if (!wsRef.current) return;
    const readyMsg: WSMessage = { type: "ready", ready: !currentReadyState };
    wsRef.current.send(JSON.stringify(readyMsg));
  }

  function handleStartRaceByHost() {
    if (!wsRef.current) return;
    const startMsg: WSMessage = { type: "start_game" };
    wsRef.current.send(JSON.stringify(startMsg));
  }

  function handleSendChatMessage(e: FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current) return;
    const chatMsg: WSMessage = { type: "chat", message: chatInput.trim() };
    wsRef.current.send(JSON.stringify(chatMsg));
    setChatInput("");
  }

  function handleUpdateLocalPlayerState(stateUpdates: Partial<Player>) {
    if (!wsRef.current) return;
    const updateMsg: WSMessage = { type: "update_state", state: stateUpdates };
    wsRef.current.send(JSON.stringify(updateMsg));
  }

  function handleDisconnect() {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsJoined(false);
    setRoom(null);
    setChatMessages([]);
  }

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSettingsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (raceTimerRef.current) clearInterval(raceTimerRef.current);
      if (singleTimerRef.current) clearInterval(singleTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (chatContainerRef.current && !isChatHoveredRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (gameMode !== "multi") return;
    let active = true;
    const targetRoomId = (roomInput || "LOBBY").trim().toUpperCase();

    function updateColors() {
      fetch(`/api/room/${targetRoomId}/colors`)
        .then((res) => {
          if (res.ok) return res.json();
          return { takenColors: [] };
        })
        .then((data) => {
          if (active) {
            setTakenLobbyColors(data.takenColors || []);
          }
        })
        .catch(() => {});
    }

    updateColors();
    const interval = setInterval(updateColors, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [roomInput, gameMode]);

  const playersList: Player[] = room ? (Object.values(room.players) as Player[]) : [];

  const leaderboardRankings = [...playersList].sort((a, b) => {
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    if (a.finished && b.finished) return (a.place || 9) - (b.place || 9);
    if (a.lap !== b.lap) return b.lap - a.lap;
    if (a.checkpoint !== b.checkpoint) return b.checkpoint - a.checkpoint;
    return b.totalDriftScore - a.totalDriftScore;
  });

  const localRacer = room && myPlayerId ? room.players[myPlayerId] : null;

  return (
    <div className={`w-screen h-screen flex flex-col overflow-hidden font-sans transition-colors duration-300 relative ${
      theme === "dark" ? "bg-[#070913] text-slate-100" : "bg-slate-50 text-slate-800"
    }`}>
      
      {/* GLOBAL THEME SWITCHER - Shown on menu and setup screens */}
      {(!gameMode || (gameMode === "single" && singleStatus === "setup") || (gameMode === "multi" && !isJoined)) && (
        <div className="absolute top-4 right-4 z-50 pointer-events-auto">
          <button
            onClick={toggleTheme}
            className={`p-2.5 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 flex items-center justify-center gap-1.5 ${
              theme === "dark"
                ? "bg-slate-900/80 border-slate-800 text-amber-400 hover:text-amber-300 hover:bg-slate-800/80"
                : "bg-white/95 border-slate-200 text-slate-700 hover:text-indigo-650 hover:bg-slate-100 shadow"
            }`}
            title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
          >
            {theme === "dark" ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider hidden sm:inline">Light Mode</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-indigo-500" />
                <span className="font-mono text-[10px] uppercase font-bold tracking-wider hidden sm:inline">Dark Mode</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. FIRST SCREEN: MODE SELECTION (SINGLE PLAYER OR MULTIPLAYER)           */}
      {/* ========================================================================= */}
      {gameMode === null && (
        <div className="flex-1 w-full max-w-3xl mx-auto flex flex-col items-center justify-center px-4 py-8 overflow-y-auto z-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-4xl mb-3 shadow-inner">
              🏎️
            </div>
            <h1 className={`text-3xl sm:text-4xl font-black tracking-tight uppercase ${
              theme === "dark" ? "text-white" : "text-slate-900"
            }`}>
              3D Drift Arena
            </h1>
            <p className={`text-sm mt-1.5 max-w-md mx-auto ${
              theme === "dark" ? "text-slate-400" : "text-slate-600"
            }`}>
              Precision racing simulation with high-speed drifts, nitro acceleration, and live telemetry GPS tracking.
            </p>
          </div>

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
            {/* SINGLE PLAYER CARD */}
            <div
              onClick={() => setGameMode("single")}
              className={`group cursor-pointer p-6 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between hover:scale-[1.02] active:scale-[0.99] relative overflow-hidden shadow-lg ${
                theme === "dark"
                  ? "bg-slate-900/90 border-slate-800 hover:border-indigo-500 hover:shadow-indigo-500/10"
                  : "bg-white border-slate-200 hover:border-indigo-600 hover:shadow-indigo-500/10"
              }`}
            >
              <div className="absolute top-0 right-0 px-3 py-1 bg-indigo-600 text-white font-mono text-[9px] font-extrabold uppercase rounded-bl-xl tracking-wider">
                Solo Mode
              </div>

              <div>
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <User className="w-6 h-6" />
                </div>
                <h2 className={`text-xl font-black tracking-tight ${
                  theme === "dark" ? "text-white" : "text-slate-900"
                }`}>
                  Single Player
                </h2>
                <p className={`text-xs mt-1.5 leading-relaxed ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}>
                  Drive immediately on the race track. Practice high-speed drifts, fire nitro boosts, master tight corners, and set your best lap records.
                </p>

                <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/80 space-y-1.5 text-[11px] font-mono">
                  <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400">
                    <Zap className="w-3.5 h-3.5 shrink-0" /> Instant track access & practice
                  </div>
                  <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400">
                    <Compass className="w-3.5 h-3.5 shrink-0" /> Live GPS Minimap & speedometer
                  </div>
                  <div className="flex items-center gap-2 text-indigo-500 dark:text-indigo-400">
                    <Trophy className="w-3.5 h-3.5 shrink-0" /> Personal best lap time tracking
                  </div>
                </div>
              </div>

              <button
                className="mt-6 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow group-hover:shadow-md"
              >
                DRIVE SOLO <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            {/* MULTIPLAYER CARD */}
            <div
              onClick={() => setGameMode("multi")}
              className={`group cursor-pointer p-6 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between hover:scale-[1.02] active:scale-[0.99] relative overflow-hidden shadow-lg ${
                theme === "dark"
                  ? "bg-slate-900/90 border-slate-800 hover:border-pink-500 hover:shadow-pink-500/10"
                  : "bg-white border-slate-200 hover:border-pink-600 hover:shadow-pink-500/10"
              }`}
            >
              <div className="absolute top-0 right-0 px-3 py-1 bg-pink-600 text-white font-mono text-[9px] font-extrabold uppercase rounded-bl-xl tracking-wider">
                Online Grid
              </div>

              <div>
                <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-500 mb-4 group-hover:bg-pink-600 group-hover:text-white transition-colors">
                  <Users className="w-6 h-6" />
                </div>
                <h2 className={`text-xl font-black tracking-tight ${
                  theme === "dark" ? "text-white" : "text-slate-900"
                }`}>
                  Multiplayer Arena
                </h2>
                <p className={`text-xs mt-1.5 leading-relaxed ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}>
                  Join or host live race lobbies. Race side-by-side against other players online with real-time positional sync and in-game chat.
                </p>

                <div className="mt-4 pt-4 border-t border-slate-200/60 dark:border-slate-800/80 space-y-1.5 text-[11px] font-mono">
                  <div className="flex items-center gap-2 text-pink-500 dark:text-pink-400">
                    <Users className="w-3.5 h-3.5 shrink-0" /> Live synchronized racer cars
                  </div>
                  <div className="flex items-center gap-2 text-pink-500 dark:text-pink-400">
                    <Flag className="w-3.5 h-3.5 shrink-0" /> Real-time placement standings
                  </div>
                  <div className="flex items-center gap-2 text-pink-500 dark:text-pink-400">
                    <MessageCircle className="w-3.5 h-3.5 shrink-0" /> Live crew communications chat
                  </div>
                </div>
              </div>

              <button
                className="mt-6 w-full py-3 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-700 hover:to-indigo-700 text-white font-mono text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow group-hover:shadow-md"
              >
                ENTER MULTIPLAYER <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* CONTROLS REMINDER FOOTER */}
          <div className={`p-4 rounded-xl border max-w-md w-full text-center ${
            theme === "dark" ? "bg-slate-900/60 border-slate-800 text-slate-400" : "bg-white/80 border-slate-200 text-slate-600"
          }`}>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-500 dark:text-indigo-400 mr-2">
              CONTROLS:
            </span>
            <span className="text-xs font-sans">
              <strong>▲ / ▼</strong> Accelerate / Brake &bull; <strong>◀ / ▶</strong> Steer &bull; <strong className="text-indigo-600 dark:text-indigo-400">SPACE</strong> Nitro Boost &bull; <strong>R</strong> Respawn
            </span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SINGLE PLAYER MODE: CUSTOMIZATION SETUP SCREEN                        */}
      {/* ========================================================================= */}
      {gameMode === "single" && singleStatus === "setup" && (
        <div className="flex-1 w-full max-w-2xl mx-auto flex flex-col items-center justify-center px-4 py-8 overflow-y-auto z-10">
          <div className={`w-full p-6 sm:p-8 rounded-2xl border transition-colors duration-300 relative ${
            theme === "dark" 
              ? "bg-slate-900 border-slate-800 shadow-2xl" 
              : "bg-white border-slate-200/80 shadow-xl"
          }`}>
            {/* Top Back Navigation */}
            <button
              onClick={handleExitToMainMenu}
              className={`mb-4 inline-flex items-center gap-1.5 text-xs font-mono font-semibold transition-colors ${
                theme === "dark" ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <ChevronLeft className="w-4 h-4" /> Back to Mode Select
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <span className="text-4xl mb-2">🏁</span>
              <h1 className={`text-2xl font-extrabold tracking-tight uppercase ${
                theme === "dark" ? "text-white" : "text-slate-900"
              }`}>
                Single Player Setup
              </h1>
              <p className={`text-xs mt-1 max-w-md ${
                theme === "dark" ? "text-slate-400" : "text-slate-500"
              }`}>
                Customize your racer and tune your AI rival for the ultimate solo challenge.
              </p>
            </div>

            <div className="space-y-5">
              {/* Nickname input */}
              <div className="flex flex-col gap-1 text-left">
                <label className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}>
                  1. Driver Nickname:
                </label>
                <input
                  type="text"
                  maxLength={14}
                  value={userName}
                  onChange={(e) => setUserName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ""))}
                  placeholder="Enter your name..."
                  className={`w-full px-4 py-2.5 rounded-xl font-mono text-sm outline-none transition-all duration-300 ${
                    theme === "dark"
                      ? "bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 focus:ring-1 focus:ring-indigo-500"
                      : "bg-slate-100/60 border border-slate-200 focus:border-indigo-600 focus:bg-white text-slate-900 focus:ring-1 focus:ring-indigo-600"
                  }`}
                />
              </div>

              {/* Color swatch selection */}
              <div className="flex flex-col gap-1 text-left">
                <label className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}>
                  2. Choose Vehicle Paint:
                </label>
                <div className="grid grid-cols-6 gap-2.5 pt-1">
                  {CAR_COLOR_PRESETS.map((color) => {
                    const isSelected = userColor.toLowerCase() === color.hex.toLowerCase();
                    return (
                      <button
                        key={color.hex}
                        onClick={() => setUserColor(color.hex)}
                        className={`h-10 rounded-xl border-2 transition-transform duration-75 relative flex items-center justify-center ${
                          isSelected
                            ? "border-indigo-500 scale-105 shadow-md"
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      >
                        {isSelected && (
                          <CheckCircle className="w-4 h-4 text-slate-950 drop-shadow-md bg-white rounded-full" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Step 3: AI Opponents Count (Grid Size: 1 to 5 Rivals) */}
              <div className="flex flex-col gap-2 text-left">
                <div className="flex items-center justify-between">
                  <label className={`text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                    theme === "dark" ? "text-slate-400" : "text-slate-500"
                  }`}>
                    <Users className="w-3.5 h-3.5 text-indigo-500" /> 3. Configure AI Opponents (Grid Size):
                  </label>
                  <span className="text-[10px] font-mono font-bold text-indigo-400">
                    {aiOpponentsCount} {aiOpponentsCount === 1 ? "Rival" : "Rivals"} ({aiOpponentsCount + 1} Cars Total)
                  </span>
                </div>

                {/* 5-Option Grid Size Selector */}
                <div className="grid grid-cols-5 gap-1.5 p-1 rounded-xl bg-slate-950/40 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80">
                  {[1, 2, 3, 4, 5].map((count) => {
                    const isSelected = aiOpponentsCount === count;
                    const labels = ["1 Rival", "2 Rivals", "3 Rivals", "4 Rivals", "5 Rivals"];
                    const sublabels = ["Duel", "3-Way", "Squad", "5 Cars", "Full Grid"];
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => {
                          setAiOpponentsCount(count);
                          localStorage.setItem("racer_ai_count", count.toString());
                        }}
                        className={`py-2 px-1 rounded-lg text-center font-mono transition-all flex flex-col items-center justify-center gap-0.5 relative ${
                          isSelected
                            ? "bg-indigo-600 text-white shadow-sm ring-1 ring-white/20"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                        }`}
                      >
                        <span className="text-xs font-black tracking-tight">{labels[count - 1]}</span>
                        <span className={`text-[8px] uppercase tracking-wider ${isSelected ? "text-indigo-200" : "text-slate-500"}`}>
                          {sublabels[count - 1]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active AI Rivals Starting Grid Preview Roster */}
                <div className={`p-2.5 rounded-xl border flex flex-wrap gap-1.5 items-center ${
                  theme === "dark" ? "bg-slate-950/60 border-slate-800/80" : "bg-slate-50 border-slate-200"
                }`}>
                  <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold w-full mb-0.5">
                    Starting Grid Lineup ({aiOpponentsCount + 1} Racers):
                  </span>
                  {/* Player Chip */}
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-indigo-950/80 border border-indigo-500/50 text-[10px] font-mono font-bold text-white shadow-sm">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: userColor }} />
                    <span>P1: {userName.trim() || "You"} (Player)</span>
                  </div>
                  {/* AI Opponents Chips */}
                  {AI_RIVAL_PRESETS.slice(0, aiOpponentsCount).map((rival, idx) => (
                    <div
                      key={rival.name}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-[10px] font-mono text-slate-300"
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: rival.color }} />
                      <span className="font-medium text-slate-200">P{idx + 2}: {rival.name}</span>
                      <span className="text-[8px] text-slate-500">({rival.title})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 4: AI Opponent Difficulty Selector */}
              <div className="flex flex-col gap-2 text-left">
                <div className="flex items-center justify-between">
                  <label className={`text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5 ${
                    theme === "dark" ? "text-slate-400" : "text-slate-500"
                  }`}>
                    <Bot className="w-3.5 h-3.5 text-indigo-500" /> 4. Select AI Opponents Difficulty:
                  </label>
                  <span
                    className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded tracking-wider"
                    style={{
                      backgroundColor: `${AI_DIFFICULTIES[aiDifficulty].color}20`,
                      color: AI_DIFFICULTIES[aiDifficulty].color,
                      border: `1px solid ${AI_DIFFICULTIES[aiDifficulty].color}40`,
                    }}
                  >
                    {AI_DIFFICULTIES[aiDifficulty].badge}
                  </span>
                </div>
                
                {/* 5-Tier Segmented Selector Tabs */}
                <div className="grid grid-cols-5 gap-1.5 p-1 rounded-xl bg-slate-950/40 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80">
                  {(Object.keys(AI_DIFFICULTIES) as AIDifficulty[]).map((key) => {
                    const diff = AI_DIFFICULTIES[key];
                    const isSelected = aiDifficulty === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setAiDifficulty(key)}
                        type="button"
                        className={`py-2 px-1 rounded-lg text-center font-mono transition-all flex flex-col items-center justify-center gap-0.5 relative ${
                          isSelected
                            ? "bg-slate-800 text-white shadow-sm ring-1 ring-white/20"
                            : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                        }`}
                        style={isSelected ? { borderBottom: `2px solid ${diff.color}` } : {}}
                      >
                        <div className="flex items-center gap-1">
                          <span
                            className="w-2 h-2 rounded-full inline-block shrink-0"
                            style={{ backgroundColor: diff.color }}
                          />
                          <span className="text-[11px] font-bold tracking-tight whitespace-nowrap">
                            {diff.label}
                          </span>
                        </div>
                        <span className="text-[8px] font-mono text-slate-400 uppercase tracking-widest">
                          {diff.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected AI Rival Telemetry Dossier Card */}
                {(() => {
                  const currentDiff = AI_DIFFICULTIES[aiDifficulty];
                  return (
                    <div
                      className={`p-4 rounded-xl border transition-all ${
                        theme === "dark"
                          ? "bg-slate-950/80 border-slate-800"
                          : "bg-slate-50/90 border-slate-200"
                      }`}
                      style={{ borderLeft: `4px solid ${currentDiff.color}` }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0 shadow-sm animate-pulse"
                            style={{ backgroundColor: currentDiff.color }}
                          />
                          <span className={`text-sm font-mono font-black ${
                            theme === "dark" ? "text-white" : "text-slate-900"
                          }`}>
                            {currentDiff.label} Tier AI Pack
                          </span>
                          <span
                            className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                            style={{
                              backgroundColor: `${currentDiff.color}20`,
                              color: currentDiff.color,
                              border: `1px solid ${currentDiff.color}40`,
                            }}
                          >
                            {currentDiff.badge}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] font-mono font-bold">
                          <span className="text-slate-400">
                            Base: <strong className="text-slate-200">{currentDiff.baseSpeed} km/h</strong>
                          </span>
                          <span className="text-amber-500 dark:text-amber-400">
                            Boost: <strong>{currentDiff.boostSpeed} km/h</strong>
                          </span>
                        </div>
                      </div>

                      <p className={`text-xs leading-relaxed ${
                        theme === "dark" ? "text-slate-300" : "text-slate-600"
                      }`}>
                        {currentDiff.description}
                      </p>

                      <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-800/50 text-[10px] font-mono text-slate-400">
                        <div className="flex flex-col">
                          <span className="text-[8px] uppercase tracking-wider text-slate-500">Cornering Pace</span>
                          <span className="font-bold text-slate-200">{currentDiff.cornerSpeed} km/h</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] uppercase tracking-wider text-slate-500">Nitro Overdrive</span>
                          <span className="font-bold text-indigo-400">{Math.round(currentDiff.nitroFrequency * 100)}% Aggression</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] uppercase tracking-wider text-slate-500">Drift Rating</span>
                          <span className="font-bold text-emerald-400">{Math.round(currentDiff.driftAggression * 100)}% Power Slide</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Solo Best Time stats if exists */}
              {singleBestTime && (
                <div className={`p-3 rounded-xl border flex items-center justify-between font-mono text-xs ${
                  theme === "dark" ? "bg-slate-950/60 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}>
                  <span className="text-slate-500 flex items-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5 text-yellow-500" /> Best Record:
                  </span>
                  <span className="font-bold text-indigo-500 dark:text-indigo-400">
                    {formatTime(singleBestTime)}
                  </span>
                </div>
              )}

              {/* Launch Button */}
              <button
                onClick={startSinglePlayerRace}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-md mt-2"
              >
                <Play className="w-4 h-4 fill-white" /> START RACE VS AI
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. SINGLE PLAYER MODE: ACTIVE 3D RACE TRACK & TELEMETRY HUD              */}
      {/* ========================================================================= */}
      {gameMode === "single" && singleStatus !== "setup" && (
        <div className="flex-1 flex flex-col relative w-full h-full">
          {/* Main 3D Canvas Viewport */}
          <div className="flex-1 relative bg-slate-950 flex items-center justify-center">
            <RaceCanvas
              localPlayer={singlePlayer}
              remotePlayers={[]}
              activeRoomStatus={singleStatus}
              onUpdateState={handleSinglePlayerUpdate}
              theme={theme}
              isSinglePlayer={true}
              aiDifficulty={aiDifficulty}
              aiCount={aiOpponentsCount}
              aiName={aiOpponent.name}
              aiColor={aiOpponent.color}
              onAIOpponentUpdate={handleAIOpponentUpdate}
              onAIPackUpdate={handleAIPackUpdate}
            />

            {/* COUNTDOWN OVERLAY TRIGGER */}
            {singleStatus === "countdown" && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-40 backdrop-blur-sm select-none">
                <div className="text-[11px] font-mono font-bold text-indigo-400 tracking-widest uppercase mb-1 flex items-center gap-2 animate-pulse">
                  <Bot className="w-4 h-4" /> Racing VS {aiOpponentsCount} AI {aiOpponentsCount === 1 ? "Rival" : "Rivals"} ({AI_DIFFICULTIES[aiDifficulty].label})
                </div>
                <div className="text-8xl font-black font-sans text-transparent bg-clip-text bg-gradient-to-b from-indigo-300 via-pink-400 to-pink-600 tracking-tighter scale-125 select-none transition animate-pulse">
                  {singleCountdown > 0 ? singleCountdown : "GO!"}
                </div>
                <div className="text-[10px] font-mono text-slate-400 tracking-wider mt-4">
                  Arrow Keys / WASD to steer, Space for Nitro, R to Reset.
                </div>
              </div>
            )}

            {/* REALTIME HUD OVERLAY */}
            {singleStatus === "racing" && (
              <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6 select-none">
                {/* HUD Top Panel */}
                <div className="flex justify-between items-start">
                  {/* Progress Indicators */}
                  <div className="flex flex-col gap-2 bg-slate-950/80 border border-slate-800/60 p-3.5 rounded-xl backdrop-blur">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col text-left">
                        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Current Lap</span>
                        <span className="text-xl font-bold font-mono text-indigo-400 leading-none">
                          LAP {Math.min(singlePlayer.lap, 3)} <span className="text-[11px] text-slate-500 font-normal">/ 3</span>
                        </span>
                      </div>
                      <div className="h-6 w-[1px] bg-slate-800" />
                      <div className="flex flex-col text-left">
                        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Checkpoint</span>
                        <span className="text-xl font-bold font-mono text-pink-400 leading-none">
                          CP {singlePlayer.checkpoint + 1} <span className="text-[11px] text-slate-500 font-normal">/ 5</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-900 pt-2 mt-1 font-mono text-[10px]">
                      <span className="text-slate-500 uppercase">SCORE OVERALL</span>
                      <span className="text-yellow-400 font-bold tracking-tight">
                        {singlePlayer.totalDriftScore.toLocaleString()} PTS
                      </span>
                    </div>
                  </div>

                  {/* High Precision Timer & Live Standings Position */}
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="bg-slate-950/85 border border-slate-800/70 h-11 px-4 rounded-xl backdrop-blur flex items-center justify-center font-mono shadow-lg">
                      <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mr-2">TIME:</div>
                      <div className="text-base font-extrabold text-slate-200 tracking-tight select-all pointer-events-auto">
                        {formatTime(singleRaceTimeMs)}
                      </div>
                    </div>

                    {/* Standings Position Badge & Distance Split */}
                    <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 px-3 py-1 rounded-full backdrop-blur shadow-md">
                      <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        aiStandings.playerPlace === 1
                          ? "bg-amber-500 text-slate-950"
                          : "bg-slate-700 text-slate-200"
                      }`}>
                        <Trophy className="w-3 h-3" />
                        P{aiStandings.playerPlace} / {aiStandings.totalRacers || (aiOpponentsCount + 1)}
                      </span>

                      <span className={`text-[10px] font-mono font-bold ${
                        aiStandings.playerPlace === 1
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}>
                        {aiStandings.playerPlace === 1 ? (
                          aiStandings.gapMeters >= 1000
                            ? `+${(aiStandings.gapMeters / 1000).toFixed(1)}KM LEAD`
                            : `+${aiStandings.gapMeters}M LEAD`
                        ) : (
                          aiStandings.gapMeters >= 1000
                            ? `-${(aiStandings.gapMeters / 1000).toFixed(1)}KM GAP`
                            : `-${aiStandings.gapMeters}M GAP`
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Right Side: Action toolbar */}
                  <div className="flex items-center gap-2 pointer-events-auto bg-slate-950/80 border border-slate-800/60 p-1.5 rounded-xl backdrop-blur">
                    <button
                      onClick={() => setIsSettingsOpen(true)}
                      className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-200 hover:text-white rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1 shadow-sm"
                      title="Settings Menu (ESC)"
                    >
                      <Settings className="w-3.5 h-3.5 text-slate-300" />
                      <span className="hidden sm:inline">SETTINGS</span>
                      <span className="text-[9px] bg-slate-800 px-1 py-0.2 rounded text-slate-400 border border-slate-700">ESC</span>
                    </button>
                    <button
                      onClick={handleSinglePlayerRestart}
                      className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-200 hover:text-white rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1.5 shadow-sm"
                      title="Restart Race (R)"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
                      <span>RESTART</span>
                    </button>
                    <button
                      onClick={handleExitToMainMenu}
                      className="px-3 py-2 bg-slate-900 hover:bg-red-950/60 border border-slate-700/70 hover:border-red-500/50 text-slate-300 hover:text-red-300 rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1.5 shadow-sm"
                      title="Exit to Mode Select"
                    >
                      <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
                      <span>EXIT</span>
                    </button>
                    <button
                      onClick={toggleTheme}
                      className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/70 rounded-lg transition flex items-center justify-center text-amber-400 shadow-sm"
                      title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
                    >
                      {theme === "dark" ? (
                        <Sun className="w-3.5 h-3.5 text-amber-400" />
                      ) : (
                        <Moon className="w-3.5 h-3.5 text-indigo-400" />
                      )}
                    </button>
                  </div>
                </div>

                {/* HUD Bottom Panel: GPS Minimap and Speedometer */}
                <div className="flex justify-between items-end">
                  {/* Left Bottom corner: Dynamic GPS Minimap & AI Pack Telemetry */}
                  <div className="flex flex-col gap-2 pointer-events-auto items-start max-w-xs">
                    <Minimap
                      players={[singlePlayer, ...aiOpponents]}
                      myPlayerId={singlePlayer.id}
                      theme={theme}
                    />

                    {/* AI Opponents Pack Live Telemetry Stack */}
                    <div className="bg-slate-950/90 border border-slate-800/80 p-2.5 rounded-xl backdrop-blur text-left flex flex-col gap-1.5 shadow-lg w-full">
                      <div className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Bot className="w-3 h-3 text-indigo-400" /> AI PACK TELEMETRY ({aiOpponents.length})
                        </span>
                        <span className="text-indigo-400">{AI_DIFFICULTIES[aiDifficulty].label}</span>
                      </div>
                      <div className="flex flex-col gap-1 max-h-24 overflow-y-auto pr-1">
                        {aiOpponents.map((rival, index) => (
                          <div key={rival.id || index} className="text-[9px] font-mono flex items-center justify-between gap-1 text-slate-300">
                            <span className="font-bold flex items-center gap-1 truncate max-w-[110px]">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: rival.color }}
                              />
                              {rival.name}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-slate-400 font-medium">
                                L{Math.min(rival.lap, 3)}/3
                              </span>
                              <span className="text-indigo-400 font-bold w-12 text-right">
                                {Math.round(rival.speed)} KM/H
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Bottom corner: Digital Speed Gauge Widget */}
                  <div className="pointer-events-auto">
                    <Speedometer
                      speed={singlePlayer.speed}
                      driftMeter={singlePlayer.driftMeter}
                      driftScore={singlePlayer.driftScore}
                      isDrifting={singlePlayer.isDrifting}
                      isBoosting={singlePlayer.speed > 62}
                      theme={theme}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* RESULTS SCREEN FOR SINGLE PLAYER */}
            {singleStatus === "results" && (
              <div className="absolute inset-x-4 top-8 bottom-8 max-w-lg mx-auto bg-slate-950/95 border border-indigo-500/80 rounded-2xl shadow-2xl backdrop-blur-xl z-40 flex flex-col justify-between p-6 select-text pointer-events-auto animate-scaleIn overflow-y-auto">
                <div className="text-center">
                  <div className="text-5xl mb-2">
                    {singlePlayer.place === 1 ? "🏆" : singlePlayer.place === 2 ? "🥈" : singlePlayer.place === 3 ? "🥉" : "🏁"}
                  </div>
                  <div className="text-[11px] font-mono font-bold text-indigo-400 tracking-widest uppercase mb-1">
                    RACE COMPLETED • {aiOpponentsCount + 1} RACERS
                  </div>
                  <h2 className="text-3xl font-black font-sans text-white tracking-tight uppercase">
                    {singlePlayer.place === 1
                      ? "VICTORY!"
                      : singlePlayer.place === 2
                      ? "2ND PLACE PODIUM"
                      : singlePlayer.place === 3
                      ? "3RD PLACE PODIUM"
                      : `P${singlePlayer.place} FINISH`}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {singlePlayer.place === 1
                      ? `Incredible driving! You dominated all ${aiOpponentsCount} AI rivals on ${AI_DIFFICULTIES[aiDifficulty].label} tier!`
                      : `Great run against the ${aiOpponentsCount} AI pack on ${AI_DIFFICULTIES[aiDifficulty].label} tier. Jump back in for a rematch!`}
                  </p>

                  {/* Complete Leaderboard Podium Standings for all Racers */}
                  <div className="mt-4 space-y-2 font-mono text-xs text-left">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      Final Race Standings & Grid Results
                    </div>

                    {(() => {
                      // Generate sorted standings list
                      const allDrivers: Array<{
                        id: string;
                        name: string;
                        color: string;
                        isPlayer: boolean;
                        place: number;
                        finishTime?: number;
                        driftScore: number;
                      }> = [
                        {
                          id: singlePlayer.id,
                          name: singlePlayer.name || "Solo Driver",
                          color: singlePlayer.color,
                          isPlayer: true,
                          place: singlePlayer.place || 1,
                          finishTime: singlePlayer.finishTime || singleRaceTimeMs,
                          driftScore: singlePlayer.totalDriftScore,
                        },
                        ...aiOpponents.map((ai, index) => ({
                          id: ai.id,
                          name: ai.name,
                          color: ai.color,
                          isPlayer: false,
                          place: ai.place || (index + 2),
                          finishTime: ai.finishTime || (singleRaceTimeMs + (index + 1) * 1200),
                          driftScore: ai.totalDriftScore || 0,
                        })),
                      ];

                      // Sort by place
                      allDrivers.sort((a, b) => a.place - b.place);

                      return allDrivers.map((driver, rankIdx) => {
                        const rank = rankIdx + 1;
                        const isWinner = rank === 1;
                        const isPlayer = driver.isPlayer;

                        return (
                          <div
                            key={driver.id || rankIdx}
                            className={`p-3 rounded-xl flex items-center justify-between transition-all ${
                              isPlayer
                                ? "bg-indigo-950/70 border-2 border-indigo-500 shadow-md"
                                : isWinner
                                ? "bg-slate-900/90 border border-amber-500/60"
                                : "bg-slate-900/50 border border-slate-800/80"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`text-base font-black font-mono w-6 ${
                                rank === 1 ? "text-amber-400" : rank === 2 ? "text-slate-300" : rank === 3 ? "text-amber-600" : "text-slate-500"
                              }`}>
                                #{rank}
                              </span>
                              <div
                                className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                                style={{ backgroundColor: driver.color }}
                              />
                              <div>
                                <div className="font-bold text-white flex items-center gap-1.5">
                                  {driver.name}
                                  {isPlayer && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/30 text-indigo-300 font-semibold border border-indigo-500/40">
                                      YOU
                                    </span>
                                  )}
                                  {isWinner && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                                      WINNER
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {isPlayer
                                    ? `${driver.driftScore.toLocaleString()} Drift Pts`
                                    : "Computer Rival"}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`font-bold ${isWinner ? "text-amber-300" : "text-slate-300"}`}>
                                {formatTime(driver.finishTime || singleRaceTimeMs)}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {singleBestTime && (
                      <div className="flex justify-between p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-xl mt-3">
                        <span className="text-indigo-300 uppercase flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-yellow-500" /> ALL-TIME SOLO BEST
                        </span>
                        <span className="text-green-400 font-bold">{formatTime(singleBestTime)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex gap-3 pt-3 border-t border-slate-900">
                  <button
                    onClick={handleSinglePlayerRestart}
                    className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 font-mono text-xs font-bold text-white rounded-xl transition shadow flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" /> RACE AGAIN
                  </button>
                  <button
                    onClick={handleExitToMainMenu}
                    className="px-5 py-3.5 border border-slate-800 hover:bg-slate-900 font-mono text-xs text-slate-300 rounded-xl transition"
                  >
                    MAIN MENU
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MULTIPLAYER MODE: LOBBY JOIN FORM                                     */}
      {/* ========================================================================= */}
      {gameMode === "multi" && !isJoined && (
        <div id="start-screen" className="flex-1 w-full max-w-md mx-auto flex flex-col items-center justify-center px-4 py-8 overflow-y-auto z-10">
          <div className={`w-full p-6 sm:p-8 rounded-2xl border transition-colors duration-300 relative ${
            theme === "dark" 
              ? "bg-slate-900 border-slate-800 shadow-2xl" 
              : "bg-white border-slate-200/80 shadow-xl"
          }`}>
            {/* Top Back Navigation */}
            <button
              onClick={handleExitToMainMenu}
              className={`mb-4 inline-flex items-center gap-1.5 text-xs font-mono font-semibold transition-colors ${
                theme === "dark" ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <ChevronLeft className="w-4 h-4" /> Back to Mode Select
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <span className="text-4xl mb-2">🌐</span>
              <h1 className={`text-2xl font-extrabold tracking-tight uppercase ${
                theme === "dark" ? "text-white" : "text-slate-900"
              }`}>
                Multiplayer Lobby
              </h1>
              <p className={`text-xs mt-1 max-w-xs ${
                theme === "dark" ? "text-slate-400" : "text-slate-500"
              }`}>
                Join a room lobby, customize your color, and race live online.
              </p>
            </div>

            <div className="space-y-4">
              {/* Name field */}
              <div className="flex flex-col gap-1 text-left">
                <label className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}>
                  1. What is your name?
                </label>
                <input
                  type="text"
                  maxLength={12}
                  value={userName}
                  onChange={(e) => setUserName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ""))}
                  placeholder="Enter your nickname..."
                  className={`w-full px-4 py-2.5 rounded-xl font-mono text-sm outline-none transition-all duration-300 ${
                    theme === "dark"
                      ? "bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 focus:ring-1 focus:ring-indigo-500"
                      : "bg-slate-100/60 border border-slate-200 focus:border-indigo-600 focus:bg-white text-slate-900 focus:ring-1 focus:ring-indigo-600"
                  }`}
                />
              </div>

              {/* Color swatch selection */}
              <div className="flex flex-col gap-1 text-left">
                <label className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}>
                  2. Choose your car color:
                </label>
                <div className="grid grid-cols-6 gap-2 pt-1">
                  {CAR_COLOR_PRESETS.map((color) => {
                    const isTaken = takenLobbyColors.includes(color.hex.toLowerCase());
                    const isSelected = userColor.toLowerCase() === color.hex.toLowerCase();
                    
                    return (
                      <button
                        key={color.hex}
                        disabled={isTaken}
                        onClick={() => setUserColor(color.hex)}
                        className={`h-9 rounded-xl border-2 transition-transform duration-75 relative flex items-center justify-center ${
                          isSelected
                            ? "border-indigo-500 scale-105 shadow-md"
                            : isTaken
                            ? "opacity-15 cursor-not-allowed border-transparent"
                            : "border-transparent hover:scale-105"
                        }`}
                        style={{ backgroundColor: color.hex }}
                        title={isTaken ? `${color.name} (Taken)` : color.name}
                      >
                        {isSelected && !isTaken && (
                          <CheckCircle className="w-4 h-4 text-slate-950 drop-shadow-md bg-white rounded-full" />
                        )}
                        {isTaken && (
                          <div className="absolute inset-x-1 h-0.5 bg-slate-950/60 rotate-45" />
                        )}
                      </button>
                    );
                  })}
                </div>
                {takenLobbyColors.length > 0 && (
                  <p className="text-[9px] text-red-500 font-mono mt-1">
                    * Crossed out colors are already chosen by other players in this lobby.
                  </p>
                )}
              </div>

              {/* Room input */}
              <div className="flex flex-col gap-1 text-left">
                <label className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}>
                  3. Join code (Optional):
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  placeholder="LOBBY (Public)"
                  className={`w-full px-4 py-2.5 rounded-xl font-mono text-sm outline-none uppercase tracking-wider transition-all duration-300 ${
                    theme === "dark"
                      ? "bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100"
                      : "bg-slate-100/60 border border-slate-200 focus:border-indigo-600 focus:bg-white text-slate-900"
                  }`}
                />
              </div>

              {connError && (
                <div className="p-3 bg-red-50 text-red-650 border border-red-200 rounded-xl text-xs font-mono">
                  ⚠️ {connError}
                </div>
              )}

              {/* Action trigger button */}
              <button
                onClick={() => handleConnect()}
                disabled={isConnecting || !userName.trim()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-mono text-xs font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-md mt-2"
              >
                {isConnecting ? "CONNECTING..." : "ENTER LOBBY & PLAY"} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MULTIPLAYER MODE: CONNECTED SESSION & RACE VIEW                        */}
      {/* ========================================================================= */}
      {gameMode === "multi" && isJoined && room && (
        <div className="flex-1 flex flex-col md:flex-row relative">
          {/* LEFT CHASSIS: LOBBY & RACE CONTROLLER AREA */}
          <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-900 bg-slate-950/70 p-4 shrink-0 flex flex-col justify-between max-h-[40vh] md:max-h-full overflow-y-auto">
            <div>
              {/* Room Stats info */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-900">
                <div className="font-mono text-left">
                  <div className="text-[9px] text-slate-500 uppercase tracking-widest">Active Server Grid</div>
                  <div className="text-base font-bold text-slate-200 uppercase">ROOM: {room.id}</div>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="px-2.5 py-1 text-[10px] font-mono border border-slate-800 hover:bg-slate-900 rounded text-slate-400 hover:text-red-400 transition"
                >
                  DISCONNECT
                </button>
              </div>

              {/* Racer Dashboard / Connected Players */}
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-400 tracking-wider uppercase mb-1">
                  <Users className="w-3.5 h-3.5 text-indigo-400" /> Crew Members ({Object.keys(room.players).length})
                </div>
                <div className="space-y-2">
                  {playersList.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-mono transition ${
                        p.id === myPlayerId
                          ? "bg-indigo-950/20 border-indigo-500/30"
                          : "bg-slate-950/80 border-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className={`font-medium ${p.id === myPlayerId ? "text-indigo-200 font-bold" : "text-slate-300"}`}>
                          {p.name} {p.isHost && "👑"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {room.status === "lobby" || room.status === "results" ? (
                          p.ready ? (
                            <span className="px-1.5 py-0.5 text-[9px] bg-green-500/10 text-green-400 border border-green-500/20 rounded font-bold uppercase tracking-wider">
                              Ready
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded font-bold uppercase tracking-wider">
                              Unready
                            </span>
                          )
                        ) : p.finished ? (
                          <span className="px-1.5 py-0.5 text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-400/20 rounded font-bold uppercase">
                            FIN #{p.place}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[9px] bg-slate-800 text-slate-400 rounded font-semibold uppercase">
                            LAP {p.lap}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* LOBBY VEHICLE COLOR CUSTOMIZER */}
              {(room.status === "lobby" || room.status === "results") && (
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-400 tracking-wider uppercase mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> PAINT SPECIFICATION
                  </div>
                  <div className="grid grid-cols-6 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-900">
                    {CAR_COLOR_PRESETS.map((color) => {
                      const otherPlayers = (Object.values(room.players) as Player[]).filter((p) => p.id !== myPlayerId);
                      const isTaken = otherPlayers.some((p) => p.color.toLowerCase() === color.hex.toLowerCase());
                      const isSelected = userColor.toLowerCase() === color.hex.toLowerCase();
                      
                      return (
                        <button
                          key={color.hex}
                          disabled={isTaken}
                          onClick={() => {
                            setUserColor(color.hex);
                            handleUpdateLocalPlayerState({ color: color.hex });
                          }}
                          className={`h-7 rounded-lg border transition-all relative flex items-center justify-center ${
                            isSelected
                              ? "border-sky-400 scale-110 shadow-md"
                              : isTaken
                              ? "opacity-10 cursor-not-allowed border-transparent"
                              : "border-transparent hover:scale-110"
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={isTaken ? `${color.name} (Taken)` : color.name}
                        >
                          {isSelected && !isTaken && <div className="w-1.5 h-1.5 rounded-full bg-slate-950 bg-white" />}
                          {isTaken && <div className="w-full h-[1px] bg-slate-950/60 rotate-45 absolute" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ACTION TOGGLERS FOR READY UP & LOBBY CONTROLS */}
              {localRacer && (room.status === "lobby" || room.status === "results") && (
                <div className="space-y-2 mb-6">
                  <button
                    onClick={() => handleSendReady(localRacer.ready)}
                    className={`w-full py-2.5 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition flex items-center justify-center gap-1.5 ${
                      localRacer.ready
                        ? "bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200"
                        : "bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white shadow-md active:scale-[0.98]"
                    }`}
                  >
                    {localRacer.ready ? "Cancel Ready Up" : "READY UP FOR GRID"}
                  </button>

                  {localRacer.isHost && (
                    <button
                      onClick={handleStartRaceByHost}
                      disabled={!playersList.every((p) => p.ready)}
                      className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-900 border border-green-500/20 hover:border-green-400 text-white text-xs font-mono font-bold tracking-wider uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 shadow"
                    >
                      <Play className="w-4 h-4 fill-white" /> ENGAGE COOLDOWN START
                    </button>
                  )}

                  {!playersList.every((p) => p.ready) && localRacer.isHost && (
                    <p className="text-[10px] text-amber-500/90 font-mono text-center">
                      Waiting for all racers to ready up.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* MONOSPACE LOBBY CHAT TERMINAL */}
            <div className="flex-1 flex flex-col justify-end border-t border-slate-900 pt-4 mt-auto min-h-[140px] max-h-[160px] md:max-h-full">
              <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-slate-400 tracking-wider uppercase mb-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-indigo-400" /> Comm channels
              </div>
              <div
                ref={chatContainerRef}
                onMouseEnter={() => { isChatHoveredRef.current = true; }}
                onMouseLeave={() => { isChatHoveredRef.current = false; }}
                className="flex-1 bg-slate-950/90 border border-slate-900 rounded-lg p-2 overflow-y-auto font-mono text-[10px] space-y-1.5 max-h-[100px] mb-2 pr-1 select-text"
              >
                {chatMessages.length === 0 ? (
                  <span className="text-slate-600">Secure connection established. Chat is live.</span>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className="text-left leading-relaxed">
                      <span className="font-bold mr-1" style={{ color: msg.color }}>
                        {msg.sender}:
                      </span>
                      <span className="text-slate-300 break-all select-text">{msg.text}</span>
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleSendChatMessage} className="flex gap-1.5">
                <input
                  type="text"
                  maxLength={64}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Broadcast message..."
                  className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 outline-none focus:border-indigo-500 font-mono"
                />
                <button
                  type="submit"
                  className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded transition"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>

          {/* MAIN CHASSIS: THE THREE.JS VIEWPORT & HUD LAYERS */}
          <div className="flex-1 relative bg-slate-950 flex items-center justify-center">
            <RaceCanvas
              localPlayer={localRacer || ({} as Player)}
              remotePlayers={playersList.filter((p) => p.id !== myPlayerId)}
              activeRoomStatus={room.status}
              onUpdateState={handleUpdateLocalPlayerState}
              theme={theme}
            />

            {/* HUD SCREEN: COUNTDOWN OVERLAY TRIGGER */}
            {room.status === "countdown" && (
              <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-40 backdrop-blur-sm select-none">
                <div className="text-[11px] font-mono font-bold text-indigo-400 tracking-widest uppercase mb-1 animate-pulse">
                  System Diagnostic Countdown
                </div>
                <div className="text-8xl font-black font-sans text-transparent bg-clip-text bg-gradient-to-b from-indigo-300 via-pink-400 to-pink-600 tracking-tighter scale-125 select-none transition animate-pulse">
                  {room.countdown > 0 ? room.countdown : "GO!"}
                </div>
                <div className="text-[10px] font-mono text-slate-500 tracking-wider mt-4">
                  W / S to accelerate, A / D to steer, Space for Nitro, R to Reset.
                </div>
              </div>
            )}

            {/* HUD SCREEN: REALTIME RACE INTERFACE OVERLAY */}
            {room.status === "racing" && localRacer && (
              <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6 select-none">
                
                {/* HUD Top panel */}
                <div className="flex justify-between items-start">
                  {/* Left Side: Progress Indicators */}
                  <div className="flex flex-col gap-2 bg-slate-950/80 border border-slate-800/60 p-3.5 rounded-xl backdrop-blur">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col text-left">
                        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Current Lap</span>
                        <span className="text-xl font-bold font-mono text-indigo-400 leading-none">
                          LAP {Math.min(localRacer.lap, 3)} <span className="text-[11px] text-slate-500 font-normal">/ 3</span>
                        </span>
                      </div>
                      <div className="h-6 w-[1px] bg-slate-800" />
                      <div className="flex flex-col text-left">
                        <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Checkpoint</span>
                        <span className="text-xl font-bold font-mono text-pink-400 leading-none">
                          CP {localRacer.checkpoint + 1} <span className="text-[11px] text-slate-500 font-normal">/ 5</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center border-t border-slate-900 pt-2 mt-1 font-mono text-[10px]">
                      <span className="text-slate-500 uppercase">SCORE OVERALL</span>
                      <span className="text-yellow-400 font-bold tracking-tight">
                        {localRacer.totalDriftScore.toLocaleString()} PTS
                      </span>
                    </div>
                  </div>

                  {/* Center Top: High Precision Timer */}
                  <div className="bg-slate-950/80 border border-slate-800/60 h-11 px-4 rounded-xl backdrop-blur flex items-center justify-center font-mono">
                    <div className="text-slate-500 text-[10px] uppercase font-bold tracking-wider mr-2">TIME:</div>
                    <div className="text-base font-extrabold text-slate-200 tracking-tight select-all pointer-events-auto">
                      {formatTime(raceTimeMs)}
                    </div>
                  </div>

                  {/* Right Side: Action toolbar & Controls */}
                  <div className="flex items-center gap-2 pointer-events-auto">
                    <div className="hidden lg:flex flex-col bg-slate-950/80 border border-slate-800/60 px-3 py-1.5 rounded-xl backdrop-blur font-mono text-[9px] text-left text-slate-400 space-y-0.5">
                      <div>▲ / ▼ : Drive &bull; ◀ / ▶ : Steer</div>
                      <div>SPACE : Nitro &bull; R : Reset</div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800/60 p-1.5 rounded-xl backdrop-blur">
                      <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="px-2.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/70 text-slate-200 hover:text-white rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1 shadow-sm"
                        title="Settings Menu (ESC)"
                      >
                        <Settings className="w-3.5 h-3.5 text-slate-300" />
                        <span className="hidden sm:inline">SETTINGS</span>
                        <span className="text-[9px] bg-slate-800 px-1 py-0.2 rounded text-slate-400 border border-slate-700">ESC</span>
                      </button>
                      <button
                        onClick={handleDisconnect}
                        className="px-3 py-2 bg-slate-900 hover:bg-red-950/60 border border-slate-700/70 hover:border-red-500/50 text-slate-300 hover:text-red-300 rounded-lg text-[10px] font-mono font-bold transition flex items-center gap-1.5 shadow-sm"
                        title="Leave Multiplayer Grid"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>LEAVE</span>
                      </button>
                      <button
                        onClick={toggleTheme}
                        className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700/70 rounded-lg transition flex items-center justify-center text-amber-400 shadow-sm"
                        title={`Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`}
                      >
                        {theme === "dark" ? (
                          <Sun className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Moon className="w-3.5 h-3.5 text-indigo-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* HUD Middle panel */}
                <div className="flex-1 flex items-center justify-center relative">
                  {localRacer.finished && (
                    <div className="p-8 bg-slate-950/95 border border-indigo-500 max-w-sm rounded-2xl shadow-2xl backdrop-blur-lg flex flex-col items-center z-30 pointer-events-auto animate-scaleIn">
                      <div className="text-[11px] font-mono font-bold text-indigo-400 tracking-widest uppercase mb-1">🏁 FINISHED 🏁</div>
                      <h3 className="text-xl font-sans font-black text-white tracking-wide">GRADE ACCOMPLISHED</h3>
                      <p className="text-xs text-slate-400 mb-4 mt-1 font-sans text-center">Waiting for your telemetry grid crews to finalize.</p>
                      
                      <div className="w-full space-y-2 font-mono text-xs">
                        <div className="flex justify-between p-2.5 bg-slate-900 border border-slate-800/50 rounded-lg">
                          <span className="text-slate-500 uppercase text-[9px]">PLACE</span>
                          <span className="text-green-400 font-bold">#{localRacer.place || 1}</span>
                        </div>
                        <div className="flex justify-between p-2.5 bg-slate-900 border border-slate-800/50 rounded-lg">
                          <span className="text-slate-500 uppercase text-[9px]">FINAL TIME</span>
                          <span className="text-indigo-300 font-bold">{formatTime(localRacer.finishTime || raceTimeMs)}</span>
                        </div>
                        <div className="flex justify-between p-2.5 bg-slate-900 border border-slate-800/50 rounded-lg">
                          <span className="text-slate-500 uppercase text-[9px]">TOTAL DRIFTS</span>
                          <span className="text-yellow-400 font-bold">{localRacer.totalDriftScore} PTS</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* HUD Bottom panel: Standings & Speedometer & Minimap */}
                <div className="flex justify-between items-end">
                  {/* Left Bottom corner */}
                  <div className="flex flex-col gap-2 pointer-events-auto items-start">
                    <Minimap
                      players={playersList}
                      myPlayerId={myPlayerId}
                      theme={theme}
                    />

                    <div className="flex flex-col gap-1.5 bg-slate-950/80 border border-slate-800/60 p-3 rounded-xl backdrop-blur text-left min-w-[140px]">
                      <div className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1">
                        Placement Standings
                      </div>
                      {leaderboardRankings.map((p, idx) => (
                        <div key={p.id} className="flex items-center gap-2 text-[11px] font-mono">
                          <span className="w-4 text-slate-500 font-bold">#{idx + 1}</span>
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                          <span className={`${p.id === myPlayerId ? "text-indigo-200 font-bold" : "text-slate-300"} truncate max-w-[80px]`}>
                            {p.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Bottom corner */}
                  <div className="pointer-events-auto">
                    <Speedometer
                      speed={localRacer.speed}
                      driftMeter={localRacer.driftMeter}
                      driftScore={localRacer.driftScore}
                      isDrifting={localRacer.isDrifting}
                      isBoosting={localRacer.speed > 62}
                      theme={theme}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* HUD SCREEN: FINALIZED GRID RACE RESULTS */}
            {room.status === "results" && (
              <div className="absolute inset-x-4 top-4 bottom-4 bg-slate-950/95 border border-slate-800 max-w-lg mx-auto rounded-2xl shadow-2xl backdrop-blur-lg z-30 flex flex-col justify-between p-6 select-text pointer-events-auto overflow-y-auto animate-scaleIn">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    <h2 className="text-base font-extrabold font-sans text-slate-100 tracking-tight uppercase">
                      LOBBY TERMINATED - RESULTS
                    </h2>
                  </div>

                  <div className="space-y-2 mb-6">
                    {leaderboardRankings.map((player, idx) => (
                      <div
                        key={player.id}
                        className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black font-mono text-indigo-400">#{idx + 1}</span>
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: player.color }} />
                          <span className="font-bold text-slate-200">{player.name}</span>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                          <div>
                            <span className="text-[9px] text-slate-500 mr-1 uppercase">DRIFT</span>
                            <span className="text-yellow-400 font-medium">{player.totalDriftScore.toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 mr-1 uppercase">TIME</span>
                            <span className="text-slate-100 font-bold">
                              {player.finished && player.finishTime ? formatTime(player.finishTime) : "DNF"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2 border-t border-slate-900 pt-4">
                  {localRacer?.isHost && (
                    <button
                      onClick={handleStartRaceByHost}
                      className="px-6 py-2 bg-gradient-to-r from-pink-500 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 font-mono text-xs font-bold text-white rounded-lg transition-transform active:scale-95 shadow"
                    >
                      ENGAGE AGAIN
                    </button>
                  )}
                  <button
                    onClick={handleDisconnect}
                    className="px-4 py-2 border border-slate-800 hover:bg-slate-900 font-mono text-xs text-slate-300 hover:text-slate-100 rounded-lg transition"
                  >
                    RETURN TO OUT-BOARD
                  </button>
                </div>
              </div>
            )}

            {/* HUD SCREEN: IDLE LOBBY WAITING SCREEN */}
            {room.status === "lobby" && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 z-20 pointer-events-auto">
                <div className="max-w-md w-full text-center space-y-6">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-400/20 text-indigo-400 rounded-full flex items-center justify-center animate-pulse">
                      <RotateCcw className="w-6 h-6" />
                    </div>
                    <div className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold">
                      Pending Telemetry Grid Load
                    </div>
                    <h2 className="text-2xl font-black font-sans text-white tracking-tight">
                      LOBBY RACING HUB
                    </h2>
                  </div>

                  <p className="text-xs text-slate-400 font-sans max-w-sm mx-auto leading-relaxed">
                    Confirm your Ready status on the left panels. The Host can initiate game grids once connection checks pass.
                  </p>

                  <div className="bg-slate-950/90 border border-slate-900/60 p-4 rounded-xl text-left space-y-3 font-mono text-xs max-h-[140px] overflow-y-auto">
                    <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">Lobby Instructions</div>
                    <div className="text-slate-300">🎮 Press <span className="text-pink-400 font-bold">▲ / ▼ (or W/S)</span> to Accelerate or reverse.</div>
                    <div className="text-slate-300">🕹️ Press <span className="text-pink-400 font-bold">◀ / ▶ (or A/D)</span> to steer left / right.</div>
                    <div className="text-slate-300">🚀 Press <span className="text-pink-400 font-bold">Spacebar</span> for Nitro Boost and automatic drift when turning at speed!</div>
                    <div className="text-slate-300">🩹 If you get stuck, press <span className="text-indigo-400 font-bold">R</span> to respawn on road.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GLOBAL SETTINGS / PAUSE MODAL (TRIGGERED BY ESC OR SETTINGS BUTTON) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onRestart={() => {
          if (gameMode === "single") {
            handleSinglePlayerRestart();
          } else if (gameMode === "multi") {
            if (localRacer?.isHost) {
              handleStartRaceByHost();
            }
          }
        }}
        onExit={() => {
          if (gameMode === "single") {
            handleExitToMainMenu();
          } else if (gameMode === "multi") {
            handleDisconnect();
            setGameMode(null);
          }
        }}
        theme={theme}
        onToggleTheme={toggleTheme}
        isMultiplayer={gameMode === "multi"}
      />

    </div>
  );
}

