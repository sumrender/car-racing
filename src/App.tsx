import { useState, useEffect, useRef } from "react";
import { Player, TrafficVehicle } from "./types";
import RaceCanvas from "./components/RaceCanvas";
import SettingsModal from "./components/SettingsModal";
import ThemeToggle from "./components/ThemeToggle";
import CountdownOverlay from "./components/CountdownOverlay";
import RaceHUD from "./components/RaceHUD";
import ModeSelectView from "./components/views/ModeSelectView";
import SinglePlayerSetupView from "./components/views/SinglePlayerSetupView";
import SinglePlayerResultsView from "./components/views/SinglePlayerResultsView";
import MultiplayerLobbyView from "./components/views/MultiplayerLobbyView";
import MultiplayerResultsView from "./components/views/MultiplayerResultsView";
import { useTheme } from "./hooks/useTheme";
import { useRaceTimer } from "./hooks/useRaceTimer";
import { useMultiplayerSocket } from "./hooks/useMultiplayerSocket";
import {
  AIDifficulty,
  createAIPackState,
  StandingsResult,
} from "./utils/aiOpponent";
import { warmUpAudioEngine } from "./utils/audio";

export default function App() {
  const { theme, toggleTheme } = useTheme();

  // Navigation mode: null (selection), "single", "multi"
  const [gameMode, setGameMode] = useState<null | "single" | "multi">(null);

  // User Profile
  const [userName, setUserName] = useState(() => localStorage.getItem("racer_name") || "Racer 1");
  const [userColor, setUserColor] = useState(() => localStorage.getItem("racer_color") || "#ef4444");

  // Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // ==================== SINGLE PLAYER STATE ====================
  const [singleStatus, setSingleStatus] = useState<"setup" | "countdown" | "racing" | "results">("setup");
  const [singleCountdown, setSingleCountdown] = useState(3);
  const [singleBestTime, setSingleBestTime] = useState<number | null>(() => {
    const saved = localStorage.getItem("racer_solo_best");
    return saved ? parseInt(saved, 10) : null;
  });

  const {
    raceTimeMs: singleRaceTimeMs,
    startTimer: startSingleTimer,
    stopTimer: stopSingleTimer,
    resetTimer: resetSingleTimer,
  } = useRaceTimer();

  const singleRaceStartRef = useRef<number>(0);

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

  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>("medium");
  const [aiOpponentsCount, setAiOpponentsCount] = useState<number>(() => {
    const saved = localStorage.getItem("racer_ai_count");
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num >= 1 && num <= 5) return num;
    }
    return 3;
  });

  const [speedBreakersCount, setSpeedBreakersCount] = useState<number>(() => {
    const saved = localStorage.getItem("racer_speed_breakers_count");
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num >= 0 && num <= 10) return num;
    }
    return 4;
  });

  const [trafficCount, setTrafficCount] = useState<number>(() => {
    const saved = localStorage.getItem("racer_traffic_count");
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num >= 0 && num <= 20) return num;
    }
    return 8;
  });

  const [trafficVehicles, setTrafficVehicles] = useState<TrafficVehicle[]>([]);

  const [aiOpponents, setAiOpponents] = useState<Player[]>(() =>
    createAIPackState(3, "medium").map((s) => s.player)
  );

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

  // Sync user profile
  useEffect(() => {
    setSinglePlayer((prev) => ({
      ...prev,
      name: userName.trim() || "Solo Driver",
      color: userColor,
    }));
  }, [userName, userColor]);

  // ==================== MULTIPLAYER STATE ====================
  const [roomInput, setRoomInput] = useState("");
  const {
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
    raceStartTime: multiRaceStartTime,
    connect: connectMultiplayer,
    disconnect: disconnectMultiplayer,
    sendReady,
    startRaceByHost,
    sendChatMessage,
    updateLocalPlayerState,
    pollRoomColors,
  } = useMultiplayerSocket();

  const {
    raceTimeMs: multiRaceTimeMs,
    startTimer: startMultiTimer,
    stopTimer: stopMultiTimer,
    resetTimer: resetMultiTimer,
  } = useRaceTimer();

  // Poll colors for target room
  useEffect(() => {
    if (gameMode !== "multi" || isJoined) return;
    pollRoomColors(roomInput);
    const interval = setInterval(() => pollRoomColors(roomInput), 3000);
    return () => clearInterval(interval);
  }, [gameMode, isJoined, roomInput, pollRoomColors]);

  // Start multiplayer timer when game starts
  useEffect(() => {
    if (multiRaceStartTime) {
      startMultiTimer(multiRaceStartTime);
    }
  }, [multiRaceStartTime, startMultiTimer]);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsSettingsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // ==================== SINGLE PLAYER HANDLERS ====================
  function startSinglePlayerRace() {
    warmUpAudioEngine();
    localStorage.setItem("racer_name", userName.trim() || "Solo Driver");
    localStorage.setItem("racer_color", userColor);
    localStorage.setItem("racer_ai_count", aiOpponentsCount.toString());

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
    resetSingleTimer();

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
        startSingleTimer(startTime);
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
        stopSingleTimer();
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

  function handleAIPackUpdate(pack: Player[], standings: StandingsResult) {
    setAiOpponents(pack);
    setAiStandings(standings);
    setSinglePlayer((prev) => {
      if (prev.place !== standings.playerPlace) {
        return { ...prev, place: standings.playerPlace };
      }
      return prev;
    });
  }

  function handleExitToMainMenu() {
    stopSingleTimer();
    stopMultiTimer();
    disconnectMultiplayer();
    setSingleStatus("setup");
    setGameMode(null);
  }

  // Multiplayer rankings calculation
  const multiplayerRankings = [...playersList].sort((a, b) => {
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;
    if (a.finished && b.finished) return (a.place || 9) - (b.place || 9);
    if (a.lap !== b.lap) return b.lap - a.lap;
    if (a.checkpoint !== b.checkpoint) return b.checkpoint - a.checkpoint;
    return b.totalDriftScore - a.totalDriftScore;
  });

  const showThemeToggle =
    !gameMode ||
    (gameMode === "single" && singleStatus === "setup") ||
    (gameMode === "multi" && !isJoined);

  return (
    <div
      className={`w-screen h-screen flex flex-col overflow-hidden font-sans transition-colors duration-300 relative ${
        theme === "dark" ? "bg-[#070913] text-slate-100" : "bg-slate-50 text-slate-800"
      }`}
    >
      {/* GLOBAL THEME SWITCHER */}
      {showThemeToggle && (
        <div className="absolute top-4 right-4 z-50 pointer-events-auto">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. SCREEN: MODE SELECTION                                                 */}
      {/* ========================================================================= */}
      {gameMode === null && (
        <ModeSelectView theme={theme} onSelectMode={(mode) => setGameMode(mode)} />
      )}

      {/* ========================================================================= */}
      {/* 2. SCREEN: SINGLE PLAYER SETUP                                            */}
      {/* ========================================================================= */}
      {gameMode === "single" && singleStatus === "setup" && (
        <SinglePlayerSetupView
          userName={userName}
          onUserNameChange={setUserName}
          userColor={userColor}
          onUserColorChange={setUserColor}
          aiDifficulty={aiDifficulty}
          onAiDifficultyChange={setAiDifficulty}
          aiOpponentsCount={aiOpponentsCount}
          onAiOpponentsCountChange={setAiOpponentsCount}
          speedBreakersCount={speedBreakersCount}
          onSpeedBreakersCountChange={(count) => {
            const clamped = Math.max(0, Math.min(10, count));
            setSpeedBreakersCount(clamped);
            localStorage.setItem("racer_speed_breakers_count", clamped.toString());
          }}
          trafficCount={trafficCount}
          onTrafficCountChange={(count) => {
            const clamped = Math.max(0, Math.min(20, count));
            setTrafficCount(clamped);
            localStorage.setItem("racer_traffic_count", clamped.toString());
          }}
          onStartRace={startSinglePlayerRace}
          onBackToMenu={handleExitToMainMenu}
          theme={theme}
        />
      )}

      {/* ========================================================================= */}
      {/* 3. SCREEN: SINGLE PLAYER ACTIVE RACE (Canvas + HUD)                       */}
      {/* ========================================================================= */}
      {gameMode === "single" && (singleStatus === "racing" || singleStatus === "countdown") && (
        <div className="relative w-full h-full flex-grow overflow-hidden">
          {singleStatus === "countdown" && <CountdownOverlay count={singleCountdown} />}

          <RaceCanvas
            localPlayer={singlePlayer}
            remotePlayers={aiOpponents}
            activeRoomStatus={singleStatus}
            onUpdateState={handleSinglePlayerUpdate}
            theme={theme}
            isSinglePlayer={true}
            aiDifficulty={aiDifficulty}
            aiCount={aiOpponentsCount}
            speedBreakersCount={speedBreakersCount}
            trafficCount={trafficCount}
            onAIPackUpdate={handleAIPackUpdate}
            onTrafficUpdate={setTrafficVehicles}
          />

          <RaceHUD
            lap={singlePlayer.lap}
            checkpoint={singlePlayer.checkpoint}
            raceTimeMs={singleRaceTimeMs}
            driftScore={singlePlayer.driftScore}
            driftMeter={singlePlayer.driftMeter}
            totalDriftScore={singlePlayer.totalDriftScore}
            speed={singlePlayer.speed}
            isDrifting={singlePlayer.isDrifting}
            isBoosting={false}
            place={singlePlayer.place || 1}
            totalRacers={aiOpponentsCount + 1}
            gapMeters={aiStandings.gapMeters}
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onRestart={startSinglePlayerRace}
            onExit={handleExitToMainMenu}
            players={[singlePlayer, ...aiOpponents]}
            myPlayerId={singlePlayer.id}
            speedBreakersCount={speedBreakersCount}
            trafficCount={trafficCount}
            trafficVehicles={trafficVehicles}
            bestTime={singleBestTime}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SCREEN: SINGLE PLAYER RESULTS PODIUM                                   */}
      {/* ========================================================================= */}
      {gameMode === "single" && singleStatus === "results" && (
        <SinglePlayerResultsView
          player={singlePlayer}
          aiOpponents={aiOpponents}
          standings={aiStandings}
          bestTime={singleBestTime}
          onRestart={startSinglePlayerRace}
          onBackToSetup={() => setSingleStatus("setup")}
          onExitToMenu={handleExitToMainMenu}
          theme={theme}
        />
      )}

      {/* ========================================================================= */}
      {/* 5. SCREEN: MULTIPLAYER LOBBY / ROOM                                      */}
      {/* ========================================================================= */}
      {gameMode === "multi" && (!isJoined || room?.status === "lobby") && (
        <MultiplayerLobbyView
          isJoined={isJoined}
          isConnecting={isConnecting}
          connError={connError}
          room={room}
          myPlayerId={myPlayerId}
          playersList={playersList}
          localRacer={localRacer}
          isHost={isHost}
          chatMessages={chatMessages}
          takenColors={takenLobbyColors}
          userName={userName}
          onUserNameChange={setUserName}
          userColor={userColor}
          onUserColorChange={setUserColor}
          roomInput={roomInput}
          onRoomInputChange={setRoomInput}
          onConnect={() => {
            localStorage.setItem("racer_name", userName.trim());
            localStorage.setItem("racer_color", userColor);
            connectMultiplayer(roomInput, userName, userColor);
          }}
          onDisconnect={disconnectMultiplayer}
          onSendReady={sendReady}
          onStartRace={startRaceByHost}
          onSendChatMessage={sendChatMessage}
          onBackToMenu={handleExitToMainMenu}
          theme={theme}
        />
      )}

      {/* ========================================================================= */}
      {/* 6. SCREEN: MULTIPLAYER ACTIVE RACE (Canvas + HUD)                        */}
      {/* ========================================================================= */}
      {gameMode === "multi" && isJoined && (room?.status === "racing" || room?.status === "countdown") && localRacer && (
        <div className="relative w-full h-full flex-grow overflow-hidden">
          {room.status === "countdown" && <CountdownOverlay count={room.countdown || 3} />}

          <RaceCanvas
            localPlayer={localRacer}
            remotePlayers={playersList.filter((p) => p.id !== myPlayerId)}
            activeRoomStatus={room.status}
            onUpdateState={updateLocalPlayerState}
            theme={theme}
            isSinglePlayer={false}
          />

          <RaceHUD
            lap={localRacer.lap}
            checkpoint={localRacer.checkpoint}
            raceTimeMs={multiRaceTimeMs}
            driftScore={localRacer.driftScore}
            driftMeter={localRacer.driftMeter}
            totalDriftScore={localRacer.totalDriftScore}
            speed={localRacer.speed}
            isDrifting={localRacer.isDrifting}
            isBoosting={false}
            place={multiplayerRankings.findIndex((p) => p.id === myPlayerId) + 1 || 1}
            totalRacers={playersList.length}
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onRestart={() => {}}
            onExit={handleExitToMainMenu}
            players={playersList}
            myPlayerId={myPlayerId}
            isMultiplayer={true}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. SCREEN: MULTIPLAYER MATCH RESULTS                                      */}
      {/* ========================================================================= */}
      {gameMode === "multi" && isJoined && room?.status === "results" && (
        <MultiplayerResultsView
          rankings={multiplayerRankings}
          myPlayerId={myPlayerId}
          onReturnToLobby={() => sendReady(false)}
          onExitToMenu={handleExitToMainMenu}
          theme={theme}
        />
      )}

      {/* Global Settings & Keybindings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onRestart={startSinglePlayerRace}
        onExit={handleExitToMainMenu}
        theme={theme}
        onToggleTheme={toggleTheme}
        isMultiplayer={gameMode === "multi"}
        speedBreakersCount={speedBreakersCount}
        onSpeedBreakersChange={(count) => {
          const clamped = Math.max(0, Math.min(10, count));
          setSpeedBreakersCount(clamped);
          localStorage.setItem("racer_speed_breakers_count", clamped.toString());
        }}
        trafficCount={trafficCount}
        onTrafficCountChange={(count) => {
          const clamped = Math.max(0, Math.min(20, count));
          setTrafficCount(clamped);
          localStorage.setItem("racer_traffic_count", clamped.toString());
        }}
      />
    </div>
  );
}
