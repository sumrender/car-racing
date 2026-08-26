import { Player, Room } from "../src/types";

export class RoomManager {
  private rooms: Record<string, Room> = {};

  public getRoom(roomId: string): Room | undefined {
    return this.rooms[roomId];
  }

  public getOrCreateRoom(roomId: string): Room {
    const cleaned = roomId.trim().toUpperCase() || "LOBBY";
    if (!this.rooms[cleaned]) {
      this.rooms[cleaned] = {
        id: cleaned,
        players: {},
        status: "lobby",
        countdown: 0,
        trackId: "track_1",
        results: {},
      };
    }
    return this.rooms[cleaned];
  }

  public getTakenColors(roomId: string): string[] {
    const room = this.rooms[roomId];
    if (!room) return [];
    return Object.values(room.players).map((p) => p.color.toLowerCase());
  }

  public assignUniqueColor(room: Room, preferredColor: string): string {
    const currentColors = Object.values(room.players).map((p) => p.color.toLowerCase());
    const candidate = (preferredColor || "#ef4444").toLowerCase();
    const configPresets = ["#ef4444", "#06b6d4", "#22c55e", "#a855f7", "#eab308", "#f1f5f9"];

    if (!currentColors.includes(candidate)) {
      return candidate;
    }

    const freePreset = configPresets.find((pCol) => !currentColors.includes(pCol.toLowerCase()));
    if (freePreset) {
      return freePreset;
    }

    return "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0");
  }

  public addPlayer(
    roomId: string,
    playerId: string,
    name: string,
    color: string
  ): { room: Room; player: Player } {
    const room = this.getOrCreateRoom(roomId);
    const isHost = Object.keys(room.players).length === 0;
    const assignedColor = this.assignUniqueColor(room, color);

    const newPlayer: Player = {
      id: playerId,
      name: name.trim() || `Racer ${Object.keys(room.players).length + 1}`,
      color: assignedColor,
      isHost,
      ready: isHost,
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
      finished: false,
    };

    room.players[playerId] = newPlayer;
    return { room, player: newPlayer };
  }

  public removePlayer(
    roomId: string,
    playerId: string
  ): { room: Room | null; leavingPlayer: Player | null; newHost: Player | null } {
    const room = this.rooms[roomId];
    if (!room) return { room: null, leavingPlayer: null, newHost: null };

    const leavingPlayer = room.players[playerId] || null;
    if (!leavingPlayer) return { room, leavingPlayer: null, newHost: null };

    const wasHost = leavingPlayer.isHost;
    delete room.players[playerId];
    delete room.results[playerId];

    const remainingPlayerIds = Object.keys(room.players);
    if (remainingPlayerIds.length === 0) {
      delete this.rooms[roomId];
      return { room: null, leavingPlayer, newHost: null };
    }

    let newHost: Player | null = null;
    if (wasHost) {
      const nextHostId = remainingPlayerIds[0];
      room.players[nextHostId].isHost = true;
      room.players[nextHostId].ready = true;
      newHost = room.players[nextHostId];
    }

    if (room.status === "racing") {
      const activeCount = Object.values(room.players).filter((p) => !p.finished).length;
      if (activeCount === 0) {
        room.status = "results";
      }
    }

    return { room, leavingPlayer, newHost };
  }

  public resetPlayersForRace(room: Room): void {
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
  }
}

export const roomManager = new RoomManager();
