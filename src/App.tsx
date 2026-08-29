import { useState, useEffect } from "react";
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
import { useSinglePlayerRace } from "./hooks/useSinglePlayerRace";

export default function App() {
  const { theme, toggleTheme } = useTheme();

  // Navigation mode: null (selection), "single", "multi"
  const [gameMode, setGameMode] = useState<null | "single" | "multi">(null);

  // User Profile
  const [userName, setUserName] = useState(() => localStorage.getItem("racer_name") || "Racer 1");
  const [userColor, setUserColor] = useState(() => localStorage.getItem("racer_color") || "#ef4444");

  // Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // ==================== SINGLE PLAYER RACE STATE & LIFECYCLE ====================
  const singleRace = useSinglePlayerRace({
    userName,
    userColor,
  });

  // ==================== MULTIPLAYER STATE & LIFECYCLE ====================
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
        setIsSettingsOpen((prev) => {
          const next = !prev;
          if (gameMode === "single" && (singleRace.status === "racing" || singleRace.status === "countdown")) {
            singleRace.setIsPaused(next);
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [gameMode, singleRace]);

  function handleExitToMainMenu() {
    singleRace.resetToSetup();
    stopMultiTimer();
    disconnectMultiplayer();
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
    (gameMode === "single" && singleRace.status === "setup") ||
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
      {gameMode === "single" && singleRace.status === "setup" && (
        <SinglePlayerSetupView
          userName={userName}
          onUserNameChange={setUserName}
          userColor={userColor}
          onUserColorChange={setUserColor}
          aiDifficulty={singleRace.aiDifficulty}
          onAiDifficultyChange={singleRace.setAiDifficulty}
          aiOpponentsCount={singleRace.aiOpponentsCount}
          onAiOpponentsCountChange={singleRace.setAiOpponentsCount}
          speedBreakersCount={singleRace.speedBreakersCount}
          onSpeedBreakersCountChange={singleRace.setSpeedBreakersCount}
          trafficCount={singleRace.trafficCount}
          onTrafficCountChange={singleRace.setTrafficCount}
          onStartRace={singleRace.startRace}
          onBackToMenu={handleExitToMainMenu}
          theme={theme}
        />
      )}

      {/* ========================================================================= */}
      {/* 3. SCREEN: SINGLE PLAYER ACTIVE RACE (Canvas + HUD)                       */}
      {/* ========================================================================= */}
      {gameMode === "single" && (singleRace.status === "racing" || singleRace.status === "countdown") && (
        <div className="relative w-full h-full flex-grow overflow-hidden">
          {singleRace.status === "countdown" && <CountdownOverlay count={singleRace.countdown} />}

          <RaceCanvas
            localPlayer={singleRace.player}
            remotePlayers={singleRace.aiOpponents}
            activeRoomStatus={singleRace.status}
            onUpdateState={singleRace.handlePlayerUpdate}
            theme={theme}
            isSinglePlayer={true}
            isPaused={singleRace.isPaused}
            aiDifficulty={singleRace.aiDifficulty}
            aiCount={singleRace.aiOpponentsCount}
            speedBreakersCount={singleRace.speedBreakersCount}
            trafficCount={singleRace.trafficCount}
            onAIPackUpdate={singleRace.handleAIPackUpdate}
            onTrafficUpdate={singleRace.setTrafficVehicles}
          />

          <RaceHUD
            lap={singleRace.player.lap}
            checkpoint={singleRace.player.checkpoint}
            raceTimeMs={singleRace.raceTimeMs}
            driftScore={singleRace.player.driftScore}
            driftMeter={singleRace.player.driftMeter}
            totalDriftScore={singleRace.player.totalDriftScore}
            speed={singleRace.player.speed}
            isDrifting={singleRace.player.isDrifting}
            isBoosting={false}
            place={singleRace.player.place || 1}
            totalRacers={singleRace.aiOpponentsCount + 1}
            gapMeters={singleRace.aiStandings.gapMeters}
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenSettings={() => {
              singleRace.setIsPaused(true);
              setIsSettingsOpen(true);
            }}
            onRestart={singleRace.startRace}
            onExit={handleExitToMainMenu}
            players={[singleRace.player, ...singleRace.aiOpponents]}
            myPlayerId={singleRace.player.id}
            speedBreakersCount={singleRace.speedBreakersCount}
            trafficCount={singleRace.trafficCount}
            trafficVehicles={singleRace.trafficVehicles}
            bestTime={singleRace.bestTime}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. SCREEN: SINGLE PLAYER RESULTS PODIUM                                   */}
      {/* ========================================================================= */}
      {gameMode === "single" && singleRace.status === "results" && (
        <SinglePlayerResultsView
          player={singleRace.player}
          aiOpponents={singleRace.aiOpponents}
          standings={singleRace.aiStandings}
          bestTime={singleRace.bestTime}
          onRestart={singleRace.startRace}
          onBackToSetup={() => singleRace.setStatus("setup")}
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
        onClose={() => {
          setIsSettingsOpen(false);
          if (gameMode === "single") {
            singleRace.setIsPaused(false);
          }
        }}
        onRestart={singleRace.startRace}
        onExit={handleExitToMainMenu}
        theme={theme}
        onToggleTheme={toggleTheme}
        isMultiplayer={gameMode === "multi"}
        isPaused={singleRace.isPaused}
        onTogglePause={singleRace.togglePause}
        speedBreakersCount={singleRace.speedBreakersCount}
        onSpeedBreakersChange={singleRace.setSpeedBreakersCount}
        trafficCount={singleRace.trafficCount}
        onTrafficCountChange={singleRace.setTrafficCount}
      />
    </div>
  );
}
