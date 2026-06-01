export interface Player {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  ready: boolean;
  
  // Game positional state
  x: number;
  y: number;
  z: number;
  rotationY: number;
  speed: number;
  
  // Scoring & progress state
  driftScore: number;
  isDrifting: boolean;
  driftMeter: number; // 0 to 100
  totalDriftScore: number;
  lap: number; // starts at 1
  checkpoint: number; // index of last checkpoint passed
  finished: boolean;
  finishTime?: number; // timestamp or speedrun duration in ms
  place?: number;
}

export interface Room {
  id: string;
  players: Record<string, Player>;
  status: 'lobby' | 'countdown' | 'racing' | 'results';
  countdown: number; // countdown remaining in seconds
  trackId: string;
  startTime?: number; // timestamp when race actually started
  results: Record<string, Player>; // results mapping when finished
}

export type WSMessage =
  | { type: 'join_room'; roomId: string; name: string; color: string }
  | { type: 'leave_room' }
  | { type: 'ready'; ready: boolean }
  | { type: 'start_game' }
  | { type: 'update_state'; state: Partial<Player> }
  | { type: 'chat'; message: string }
  | { type: 'ping' }
  | { type: 'room_state'; room: Room }
  | { type: 'countdown_tick'; countdown: number }
  | { type: 'game_started'; startTime: number }
  | { type: 'game_ended'; results: Record<string, Player> }
  | { type: 'pong' }
  | { type: 'chat_msg'; sender: string; message: string; color: string }
  | { type: 'error'; message: string };

export interface BestTime {
  player: string;
  color: string;
  timeMs: number;
  date: string;
}
