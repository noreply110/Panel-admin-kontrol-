export interface AppState {
  qrImageUrl: string;
  useCustomText: boolean;
  qrCustomText: string;
  initialTime: number; // in seconds
  timeLeft: number;    // in seconds
  isTimerRunning: boolean;
  audioUrl: string;
  isExpired: boolean;
  logoUrl: string;
  statusMessage: string;
  virtualAccount: string; // virtual account number / code pembatalan
  
  // Separate Batal timer state
  batalInitialTime: number;
  batalTimeLeft: number;
  batalIsTimerRunning: boolean;
  batalIsExpired: boolean;
}

export interface ActiveSession {
  sessionId: string;
  lastActive: number;
  userAgent: string;
  ip: string;
  pageType: "user" | "admin";
}

export interface VisitLog {
  timestamp: string;
  userAgent: string;
  ip: string;
  action: string;
}

export interface AdminMetrics {
  activeUsersCount: number;
  activeAdminsCount: number;
  activeSessions: ActiveSession[];
  visitLogs: VisitLog[];
}
