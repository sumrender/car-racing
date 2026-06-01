import { useEffect, useRef, useState, FormEvent } from "react";
import { Maximize2, Trophy, Users, Send, ArrowRight, Play, CheckCircle, RotateCcw, Volume2, Sparkles, MessageCircle, Sun, Moon } from "lucide-react";
import { Player, Room, WSMessage, BestTime } from "./types";
import RaceCanvas from "./components/RaceCanvas.tsx";
import Speedometer from "./components/Speedometer.tsx";
import Leaderboard, { formatTime } from "./components/Leaderboard.tsx";

const CAR_COLOR_PRESETS = [
  { name: "Speed Crimson", hex: "#ef4444" },
  { name: "Cyber Cyan", hex: "#06b6d4" },
  { name: "Toxic Lime", hex: "#22c55e" },
  { name: "Apex Purple", hex: "#a855f7" },
  { name: "Neon Gold", hex: "#eab308" },
  { name: "Ghost White", hex: "#f1f5f9" },
];

export default function App() {
  // Theme state settings
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("racer_theme") as "light" | "dark") || "dark"
  );

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("racer_theme", nextTheme);
  }

  // Username and connection settings states
  const [userName, setUserName] = useState(() => localStorage.getItem("racer_name") || "");
  const [userColor, setUserColor] = useState(() => localStorage.getItem("racer_color") || "#ef4444");
  const [roomInput, setRoomInput] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connError, setConnError] = useState("");
  // Real-time occupied colors list for specified room on login screen
  const [takenLobbyColors, setTakenLobbyColors] = useState<string[]>([]);

  // Room synchronization states
  const [room, setRoom] = useState<Room | null>(null);
  const [myPlayerId, setMyPlayerId] = useState("");
  
  // HUD dynamics
  const [raceTimeMs, setRaceTimeMs] = useState(0);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<Array<{ sender: string; text: string; color: string }>>([]);

  // Websocket ref
  const wsRef = useRef<WebSocket | null>(null);
  const raceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isChatHoveredRef = useRef(false);

  // Connection Handler
  function handleConnect(joinedRoomId?: string) {
    if (!userName.trim()) return;
    setIsConnecting(true);
    setConnError("");

    // Persist profile
    localStorage.setItem("racer_name", userName.trim());
    localStorage.setItem("racer_color", userColor);

    const targetRoomId = (joinedRoomId || roomInput || "LOBBY").trim().toUpperCase();

    // Protocol resolution
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        setIsJoined(true);
        // Request Join
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
              // Find matching local player id
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
              // Global start timestamp
              (window as any).raceStartTime = msg.startTime;
              setRaceTimeMs(0);
              // Start local HUD timer counting duration
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
              ].slice(-40)); // keep last 40 MSGPACKS
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

  // Lobby interactions
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

  // Cleanup timers on shutdown
  useEffect(() => {
    return () => {
      if (raceTimerRef.current) clearInterval(raceTimerRef.current);
    };
  }, []);

  // Autoscroll chat on newer messages if user is not hovering to read history
  useEffect(() => {
    if (chatContainerRef.current && !isChatHoveredRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Dynamically fetch and poll taken colors of entered room on setup screen to enforce distinctiveness
  useEffect(() => {
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
  }, [roomInput]);

  // Compute leaderboard placement onHUD racer rankings
  const playersList: Player[] = room ? (Object.values(room.players) as Player[]) : [];

  const leaderboardRankings = [...playersList].sort((a, b) => {
        // Finished sorting
        if (a.finished && !b.finished) return -1;
        if (!a.finished && b.finished) return 1;
        if (a.finished && b.finished) return (a.place || 9) - (b.place || 9);

        // Progress sorting
        if (a.lap !== b.lap) return b.lap - a.lap;
        if (a.checkpoint !== b.checkpoint) return b.checkpoint - a.checkpoint;

        // Subordinate sorting by total drift score/speed
        return b.totalDriftScore - a.totalDriftScore;
      });

  const localRacer = room && myPlayerId ? room.players[myPlayerId] : null;

  return (
    <div className={`w-screen h-screen flex flex-col overflow-hidden font-sans transition-colors duration-300 relative ${
      theme === "dark" ? "bg-[#070913] text-slate-100" : "bg-slate-50 text-slate-800"
    }`}>
      
      {/* GLOBAL THEME SWITCHER */}
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

      {/* 1. OFF-BOARD SCREEN: AUTH & ROOM LAUNCHER */}
      {!isJoined && (
        <div id="start-screen" className="flex-1 w-full max-w-lg mx-auto flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">
          {/* Centered minimalist master card */}
          <div className={`w-full p-8 rounded-2xl border transition-colors duration-300 relative ${
            theme === "dark" ? "bg-slate-900/60 border-slate-800/80 shadow-2xl" : "bg-white border-slate-200/80 shadow-xl"
          }`}>
            <div className="flex flex-col items-center text-center mb-8">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-400/20 text-indigo-400 font-mono text-[10px] font-bold tracking-wider uppercase mb-3">
                <Sparkles className="w-3.5 h-3.5" /> High-Performance Physics Mode Enabled
              </div>
              <h1 className={`text-3xl font-black tracking-tight leading-tight uppercase ${
                theme === "dark" ? "text-white" : "text-slate-900"
              }`}>
                DRIFT LOBBY
              </h1>
              <p className={`text-xs mt-2 leading-relaxed ${
                theme === "dark" ? "text-slate-400" : "text-slate-650"
              }`}>
                Choose your name, select an available vehicle color, and enter the active race grid.
              </p>
            </div>

            <div className="space-y-5">
              {/* Name field */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}>
                  What is your name?
                </label>
                <input
                  type="text"
                  maxLength={12}
                  value={userName}
                  onChange={(e) => setUserName(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ""))}
                  placeholder="Enter your nickname..."
                  className={`w-full px-4 py-3 rounded-xl font-mono text-sm outline-none transition-all duration-300 ${
                    theme === "dark"
                      ? "bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 focus:ring-1 focus:ring-indigo-500"
                      : "bg-slate-100/50 border border-slate-200 focus:border-indigo-600 focus:bg-white text-slate-900 focus:ring-1 focus:ring-indigo-600"
                  }`}
                />
              </div>

              {/* Color swatch selection */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}>
                  Choose your car color:
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
                        className={`h-11 rounded-xl border-2 transition-transform duration-75 relative flex items-center justify-center ${
                          isSelected
                            ? "border-sky-400 scale-105 shadow-md"
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
                  <p className="text-[9px] text-slate-500 font-mono mt-1">
                    * Colors struck out are already chosen by online racers in this room.
                  </p>
                )}
              </div>

              {/* Room input */}
              <div className="flex flex-col gap-1.5 text-left">
                <label className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  theme === "dark" ? "text-slate-400" : "text-slate-500"
                }`}>
                  Room Code (Optional)
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={roomInput}
                  onChange={(e) => setRoomInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  placeholder="LOBBY"
                  className={`w-full px-4 py-3 rounded-xl font-mono text-sm outline-none uppercase tracking-wider transition-all duration-300 ${
                    theme === "dark"
                      ? "bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 focus:ring-1 focus:ring-indigo-500"
                      : "bg-slate-100/50 border border-slate-200 focus:border-indigo-600 focus:bg-white text-slate-900 focus:ring-1 focus:ring-indigo-600"
                  }`}
                />
              </div>

              {connError && (
                <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-xs font-mono text-red-400">
                  ⚠️ {connError}
                </div>
              )}

              <button
                onClick={() => handleConnect()}
                disabled={isConnecting || !userName.trim()}
                className="w-full py-3 bg-gradient-to-r from-pink-500 to-indigo-605 hover:from-pink-600 hover:to-indigo-700 disabled:from-slate-800 disabled:to-slate-800 disabled:opacity-50 text-white font-mono text-xs font-bold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-md mt-4"
              >
                {isConnecting ? "ESTABLISHING SIGNAL..." : "JOIN SESSION & DRIFT"} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. ON-BOARD INTEGRATED RACE SCREEN SYSTEM */}
      {isJoined && room && (
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
                  W / S to accelerate, A / D to steer, Space to Drift, R to Reset.
                </div>
              </div>
            )}

            {/* HUD SCREEN: REALTIME RACE INTERFACE OVERLAY */}
            {room.status === "racing" && localRacer && (
              <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between p-4 sm:p-6 select-none">
                
                {/* HUD Top panel: Lap, Checkpoint, and Time clock */}
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

                    {/* Overall Total accumulated Drifts in game */}
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

                  {/* Right Side: Keyboard controls map legend popup */}
                  <div className="hidden sm:flex flex-col bg-slate-950/80 border border-slate-800/60 px-3 py-2 rounded-xl backdrop-blur font-mono text-[9px] text-left text-slate-400 space-y-0.5">
                    <div>W / S : ACCEL / REVERSE</div>
                    <div>A / D : STEER LEFT / RIGHT</div>
                    <div>SPACE : DRIFT (HIGH SPEED)</div>
                    <div>R : SPAWN TO RESCUE APEX</div>
                  </div>
                </div>

                {/* HUD Middle panel: Drift active alert screen flash or local status metrics */}
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

                {/* HUD Bottom panel: Real-time placements lists & Gauge dial */}
                <div className="flex justify-between items-end">
                  
                  {/* Left Bottom corner: Realtime placings order */}
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

                  {/* Right Bottom corner: Digital Speed Gauge Widget */}
                  <div className="pointer-events-auto">
                    <Speedometer
                      speed={localRacer.speed}
                      driftMeter={localRacer.driftMeter}
                      driftScore={localRacer.driftScore}
                      isDrifting={localRacer.isDrifting}
                      isBoosting={localRacer.speed > 62} // Speed exceeding maximum normal speeds implies boosting
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

                  <Leaderboard />
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
                    <div className="text-slate-300">🎮 Press <span className="text-pink-400 font-bold">W/S</span> to Accelerate or reverse reverse forward gears.</div>
                    <div className="text-slate-300">🕹️ Press <span className="text-pink-400 font-bold">A/D</span> to slide tires.</div>
                    <div className="text-slate-300">💫 Stand out during turns by holding <span className="text-pink-400 font-bold">Spacebar</span> to drift and receive Speed Boost rewards.</div>
                    <div className="text-slate-300">🩹 If cornering trajectories fail, press <span className="text-indigo-400 font-bold">R</span> to revive.</div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
