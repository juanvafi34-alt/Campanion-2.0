// Server/server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

/**
 * CORS:
 * - Allow your Netlify site to call Render
 * - Allow local dev too (optional)
 */
const ALLOWED_ORIGINS = new Set([
  "https://campanion20.netlify.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");

  // Preflight
  if (req.method === "OPTIONS") return res.sendStatus(204);

  next();
});

app.use(express.json());

// Health check
app.get("/health", (req, res) => res.send("ok"));

// Allowed room codes
const allowedRooms = new Set(
  (process.env.ROOM_CODES || "PINE123,LAKE777,CAMP999")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: Array.from(ALLOWED_ORIGINS),
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  socket.on("joinRoom", ({ name, code }) => {
    const room = String(code || "").trim().toUpperCase();
    const user = String(name || "Anonymous").trim().slice(0, 30);

    if (!allowedRooms.has(room)) {
      socket.emit("invalidRoom");
      return;
    }

    socket.join(room);
    socket.data.room = room;
    socket.data.name = user;

    socket.emit("joined", room);
    socket.to(room).emit("system", `${user} joined the room`);
  });

  socket.on("chat", (text) => {
    const room = socket.data.room;
    const name = socket.data.name || "Anonymous";
    if (!room) return;

    const msg = String(text || "").slice(0, 500);
    io.to(room).emit("chat", { name, text: msg });
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;
    const name = socket.data.name;
    if (room && name) socket.to(room).emit("system", `${name} left the room`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));