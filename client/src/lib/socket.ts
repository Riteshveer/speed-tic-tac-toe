// ─── Socket.IO singleton ──────────────────────────────────────────────────────
import { io, Socket } from "socket.io-client";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

let _socket: Socket | null = null;

export function getSocket(): Socket {
  if (!_socket) {
    _socket = io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1500,
    });
  }
  return _socket;
}

export function disconnectSocket(): void {
  _socket?.disconnect();
  _socket = null;
}
