import { io } from "socket.io-client";

const CHAT_SERVICE_URL = import.meta.env.VITE_API_URL || "http://localhost:3004";

// Get token from localStorage
const getToken = () => {
  try {
    const userStr = localStorage.getItem("persist:user");
    if (userStr) {
      const userData = JSON.parse(userStr);
      if (userData.token) {
        return JSON.parse(userData.token);
      }
    }
  } catch (error) {
    console.error("Error getting token from localStorage:", error);
  }
  return null;
};

let socket = null;

export const connectSocket = () => {
  if (socket?.connected) {
    return socket;
  }

  const token = getToken();
  if (!token) {
    console.warn("No authentication token found. Socket connection requires authentication.");
    return null;
  }

  socket = io(CHAT_SERVICE_URL, {
    auth: {
      token,
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
  });

  socket.on("connect", () => {
    console.log("✅ Socket.io connected:", socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ Socket.io disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("Socket.io connection error:", error.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log("Socket.io disconnected");
  }
};

export const getSocket = () => {
  if (!socket || !socket.connected) {
    return connectSocket();
  }
  return socket;
};

export default socket;

