import { useState, useRef, useEffect, FormEvent } from "react";
import { ChevronLeft, Users, Send, ArrowRight, Play, CheckCircle, MessageCircle, LogOut } from "lucide-react";
import { ThemeMode } from "../../hooks/useTheme";
import { Room, Player } from "../../types";
import { ChatMessage } from "../../hooks/useMultiplayerSocket";
import ColorPicker from "../ColorPicker";

interface MultiplayerLobbyViewProps {
  isJoined: boolean;
  isConnecting: boolean;
  connError: string;
  room: Room | null;
  myPlayerId: string;
  playersList: Player[];
  localRacer: Player | null;
  isHost: boolean;
  chatMessages: ChatMessage[];
  takenColors: string[];
  userName: string;
  onUserNameChange: (name: string) => void;
  userColor: string;
  onUserColorChange: (color: string) => void;
  roomInput: string;
  onRoomInputChange: (roomId: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onSendReady: (currentReady: boolean) => void;
  onStartRace: () => void;
  onSendChatMessage: (text: string) => void;
  onBackToMenu: () => void;
  theme: ThemeMode;
}

export default function MultiplayerLobbyView({
  isJoined,
  isConnecting,
  connError,
  room,
  myPlayerId,
  playersList,
  localRacer,
  isHost,
  chatMessages,
  takenColors,
  userName,
  onUserNameChange,
  userColor,
  onUserColorChange,
  roomInput,
  onRoomInputChange,
  onConnect,
  onDisconnect,
  onSendReady,
  onStartRace,
  onSendChatMessage,
  onBackToMenu,
  theme,
}: MultiplayerLobbyViewProps) {
  const isDark = theme === "dark";
  const [chatText, setChatText] = useState("");
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    onSendChatMessage(chatText.trim());
    setChatText("");
  };

  // 1. JOIN FORM (Before entering room)
  if (!isJoined) {
    return (
      <main className="flex-1 w-full max-w-md mx-auto flex flex-col items-center justify-center px-4 py-8 overflow-y-auto z-10">
        <div
          id="multiplayer-join-card"
          className={`w-full p-6 sm:p-8 rounded-2xl border transition-colors duration-300 relative shadow-2xl ${
            isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
          }`}
        >
          {/* Back to menu button */}
          <button
            id="back-from-multi-btn"
            onClick={onBackToMenu}
            className={`mb-4 inline-flex items-center gap-1.5 text-xs font-mono font-semibold transition-colors ${
              isDark ? "text-slate-400 hover:text-slate-200" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <ChevronLeft className="w-4 h-4" /> Back to Mode Select
          </button>

          <header className="text-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-500 flex items-center justify-center mx-auto mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h1
              className={`text-2xl font-extrabold tracking-tight uppercase ${
                isDark ? "text-white" : "text-slate-900"
              }`}
            >
              Multiplayer Grid
            </h1>
            <p
              className={`text-xs mt-1 ${
                isDark ? "text-slate-400" : "text-slate-500"
              }`}
            >
              Enter a room code and configure your vehicle livery.
            </p>
          </header>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onConnect();
            }}
            className="space-y-4"
          >
            {/* Room ID input */}
            <div className="flex flex-col gap-1 text-left">
              <label
                htmlFor="multi-room-id-input"
                className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Room Code / Name
              </label>
              <input
                id="multi-room-id-input"
                type="text"
                maxLength={12}
                value={roomInput}
                onChange={(e) => onRoomInputChange(e.target.value.toUpperCase())}
                placeholder="e.g. LOBBY or ARENA1"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm font-mono uppercase font-bold outline-none transition-all ${
                  isDark
                    ? "bg-slate-950/70 border-slate-700 focus:border-pink-500 text-white placeholder-slate-600"
                    : "bg-slate-50 border-slate-200 focus:border-pink-600 text-slate-900 placeholder-slate-400"
                }`}
              />
            </div>

            {/* Nickname input */}
            <div className="flex flex-col gap-1 text-left">
              <label
                htmlFor="multi-user-name-input"
                className={`text-[10px] font-mono font-bold tracking-wider uppercase ${
                  isDark ? "text-slate-400" : "text-slate-500"
                }`}
              >
                Driver Call-Sign
              </label>
              <input
                id="multi-user-name-input"
                type="text"
                required
                maxLength={14}
                value={userName}
                onChange={(e) => onUserNameChange(e.target.value)}
                placeholder="e.g. GhostRider"
                className={`w-full px-4 py-2.5 rounded-xl border text-sm font-sans font-medium outline-none transition-all ${
                  isDark
                    ? "bg-slate-950/70 border-slate-700 focus:border-pink-500 text-white placeholder-slate-600"
                    : "bg-slate-50 border-slate-200 focus:border-pink-600 text-slate-900 placeholder-slate-400"
                }`}
              />
            </div>

            {/* Vehicle Color Swatches */}
            <ColorPicker
              selectedColor={userColor}
              onSelectColor={onUserColorChange}
              takenColors={takenColors}
              theme={theme}
            />

            {connError && (
              <div
                id="multi-conn-error-alert"
                className="p-3 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-xs font-mono text-center"
              >
                {connError}
              </div>
            )}

            <button
              id="join-multiplayer-grid-btn"
              type="submit"
              disabled={isConnecting || !userName.trim()}
              className="w-full py-4 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 disabled:opacity-50 text-white font-mono text-sm font-bold rounded-xl transition-all shadow-lg hover:shadow-pink-500/25 flex items-center justify-center gap-2 mt-4"
            >
              {isConnecting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>CONNECT TO GRID</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    );
  }

  // 2. CONNECTED LOBBY ROOM
  const allReady = playersList.length > 0 && playersList.every((p) => p.ready);

  return (
    <main className="flex-1 w-full max-w-4xl mx-auto flex flex-col justify-center px-4 py-8 overflow-y-auto z-10">
      <div
        id="multiplayer-room-lobby-card"
        className={`w-full p-6 sm:p-8 rounded-2xl border transition-colors duration-300 shadow-2xl relative ${
          isDark ? "bg-slate-900 border-slate-800 text-white" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        {/* Lobby Header */}
        <header className="flex items-center justify-between pb-4 mb-6 border-b border-slate-700/50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-pink-600 text-white font-mono text-[10px] font-bold uppercase tracking-wider">
                ROOM: {room?.id || "LOBBY"}
              </span>
              <span className="text-xs font-mono text-slate-400">
                ({playersList.length} / 6 Racers)
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight mt-1 uppercase">
              Matchmaking Lounge
            </h1>
          </div>

          <button
            id="leave-lobby-btn"
            onClick={onDisconnect}
            className={`px-3 py-2 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition-colors ${
              isDark
                ? "bg-slate-800/80 border-slate-700 hover:bg-red-950/40 hover:border-red-800 text-slate-300 hover:text-red-300"
                : "bg-slate-100 border-slate-200 hover:bg-red-50 hover:border-red-200 text-slate-700 hover:text-red-600"
            }`}
          >
            <LogOut className="w-4 h-4" /> Leave
          </button>
        </header>

        {/* 2-Column Layout: Players List + Chat Terminal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Racers Grid */}
          <div>
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-60 mb-2">
              Connected Drivers
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {playersList.map((p) => {
                const isMe = p.id === myPlayerId;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center justify-between p-3 rounded-xl border font-mono text-xs ${
                      isMe
                        ? "bg-pink-600/10 border-pink-500/40"
                        : isDark
                        ? "bg-slate-950/60 border-slate-800"
                        : "bg-slate-50 border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3.5 h-3.5 rounded-full shadow-sm shrink-0"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="font-bold truncate max-w-[130px]">
                        {p.name}
                      </span>
                      {p.isHost && (
                        <span className="text-[9px] bg-amber-500/20 border border-amber-500/30 text-amber-400 px-1.5 py-0.2 rounded font-sans font-bold">
                          HOST
                        </span>
                      )}
                      {isMe && (
                        <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.2 rounded font-sans">
                          YOU
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {p.ready ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
                          <CheckCircle className="w-3.5 h-3.5" /> READY
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-bold">WAITING</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Chat Terminal */}
          <div className="flex flex-col">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider opacity-60 mb-2 flex items-center gap-1">
              <MessageCircle className="w-3 h-3 text-pink-400" /> Crew Communications
            </div>

            <div
              ref={chatContainerRef}
              className={`flex-grow h-44 rounded-xl border p-3 font-mono text-xs overflow-y-auto space-y-1.5 mb-2.5 ${
                isDark ? "bg-slate-950/80 border-slate-800 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-700"
              }`}
            >
              {chatMessages.length === 0 ? (
                <div className="text-center py-10 text-[11px] opacity-40 font-mono">
                  Say hello to other drivers in the paddock...
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div key={idx} className="leading-tight break-words">
                    <span className="font-bold mr-1.5" style={{ color: msg.color }}>
                      {msg.sender}:
                    </span>
                    <span>{msg.text}</span>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <input
                type="text"
                maxLength={80}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Type a message..."
                className={`flex-grow px-3 py-2 rounded-xl border text-xs font-mono outline-none ${
                  isDark
                    ? "bg-slate-950 border-slate-700 text-white placeholder-slate-600 focus:border-pink-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-pink-600"
                }`}
              />
              <button
                type="submit"
                className="px-3 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl transition-all font-mono text-xs font-bold flex items-center justify-center"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>

        {/* Lobby Actions Bottom Bar */}
        <div className="pt-4 border-t border-slate-700/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Ready Button */}
          <button
            id="toggle-ready-btn"
            onClick={() => onSendReady(!!localRacer?.ready)}
            className={`w-full sm:w-auto px-6 py-3 rounded-xl font-mono text-xs font-bold transition-all border flex items-center justify-center gap-2 ${
              localRacer?.ready
                ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500"
                : isDark
                ? "bg-slate-800 hover:bg-slate-700 text-white border-slate-700"
                : "bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200"
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            <span>{localRacer?.ready ? "I AM READY" : "SET TO READY"}</span>
          </button>

          {/* Host Start Race Button */}
          {isHost ? (
            <button
              id="host-start-race-btn"
              onClick={onStartRace}
              disabled={!allReady || playersList.length < 1}
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-pink-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 disabled:opacity-40 text-white font-mono text-xs font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>START RACE FOR ALL</span>
            </button>
          ) : (
            <div className="text-[11px] font-mono text-slate-400 text-center sm:text-right">
              Waiting for host to launch the starting countdown...
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
