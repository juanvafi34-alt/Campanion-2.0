const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();

const ALLOWED_ORIGINS = new Set([
  "https://campanion20.netlify.app",
  "http://localhost:5173",
  "http://localhost:3000",
]);

const PARK_RANGER_PASSWORD = process.env.PARK_RANGER_PASSWORD || "RANGER123";

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") return res.sendStatus(204);

  next();
});

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Campanion backend is running ✅");
});

app.get("/health", (req, res) => {
  res.send("ok");
});

const allowedRooms = new Set(["GENERAL", "UPDATES"]);
const roomHistory = {
  GENERAL: [],
  UPDATES: [
    {
      name: "Park Ranger",
      text: "1PM - Bear close to the cafeteria - Be careful!",
      isAdmin: true,
      time: new Date().toISOString(),
    },
    {
      name: "Park Ranger",
      text: "2PM - Mr.Bowman spotted near main commons, go give him a high five!",
      isAdmin: true,
      time: new Date().toISOString(),
    },
  ],
};
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: Array.from(ALLOWED_ORIGINS),
    methods: ["GET", "POST"],
  },
});

function getUsers(room) {
  const roomSet = io.sockets.adapter.rooms.get(room);
  if (!roomSet) return [];

  return Array.from(roomSet)
    .map((socketId) => {
      const userSocket = io.sockets.sockets.get(socketId);
      if (!userSocket) return null;

      return {
        id: userSocket.id,
        name: userSocket.data.name || "Anonymous",
        isAdmin: Boolean(userSocket.data.isAdmin),
      };
    })
    .filter(Boolean);
}

function emitUsers(room) {
  io.to(room).emit("users", getUsers(room));
}

io.on("connection", (socket) => {
  socket.on("joinRoom", ({ name, room, rangerPassword }) => {
    const selectedRoom = String(room || "").trim().toUpperCase();

    if (!allowedRooms.has(selectedRoom)) {
      socket.emit("invalidRoom");
      return;
    }

    const isAdmin = String(rangerPassword || "") === PARK_RANGER_PASSWORD;

    let user = String(name || "Anonymous").trim().slice(0, 30);

    if (isAdmin) {
      user = "Park Ranger";
    }

    if (!isAdmin && user.toLowerCase() === "park ranger") {
      user = "Camper";
    }

    const previousRoom = socket.data.room;
    const previousName = socket.data.name;

    if (previousRoom) {
      socket.leave(previousRoom);
      socket.to(previousRoom).emit("system", `${previousName || "Anonymous"} left the room`);
      emitUsers(previousRoom);
    }

    socket.join(selectedRoom);

    socket.data.room = selectedRoom;
    socket.data.name = user;
    socket.data.isAdmin = isAdmin;

    socket.emit("joined", {
      room: selectedRoom,
      isAdmin,
    });
    socket.emit("history", roomHistory[selectedRoom] || []);
    socket.to(selectedRoom).emit(
      "system",
      `${isAdmin ? "🛡️ " : ""}${user} joined the room`
    );

    emitUsers(selectedRoom);
  });

  socket.on("chat", (text) => {
  const room = socket.data.room;
  const name = socket.data.name || "Anonymous";
  const isAdmin = Boolean(socket.data.isAdmin);

  if (!room) return;

  if (room === "UPDATES" && !isAdmin) {
    socket.emit("adminOnly", "Only the Park Ranger can post in Updates/Information.");
    return;
  }

  const msg = String(text || "").trim().slice(0, 500);
  if (!msg) return;

  const newMessage = {
    name,
    text: msg,
    isAdmin,
    time: new Date().toISOString(),
  };

  if (roomHistory[room]) {
    roomHistory[room].push(newMessage);
    roomHistory[room] = roomHistory[room].slice(-20);
  }

  io.to(room).emit("chat", newMessage);
});
     
    if (!room) return;

    if (room === "UPDATES" && !isAdmin) {
      socket.emit("adminOnly", "Only the Park Ranger can post in Updates/Information.");
      return;
    }

    const msg = String(text || "").trim().slice(0, 500);
    if (!msg) return;

    io.to(room).emit("chat", {
      name,
      text: msg,
      isAdmin,
      time: new Date().toISOString(),
    });
  });

  socket.on("kickUser", ({ socketId }) => {
    if (!socket.data.isAdmin) return;

    const targetSocket = io.sockets.sockets.get(socketId);
    if (!targetSocket) return;

    if (targetSocket.id === socket.id) return;

    const room = targetSocket.data.room;
    const targetName = targetSocket.data.name || "Anonymous";

    if (!room) return;

    targetSocket.leave(room);

    targetSocket.data.room = null;
    targetSocket.data.name = null;
    targetSocket.data.isAdmin = false;

    targetSocket.emit("kicked", "You were removed from the chat by the Park Ranger.");

    io.to(room).emit("system", `${targetName} was removed by the Park Ranger.`);
    emitUsers(room);
  });

  socket.on("leaveRoom", () => {
    const room = socket.data.room;
    const name = socket.data.name || "Anonymous";

    if (room) {
      socket.leave(room);
      socket.to(room).emit("system", `${name} left the room`);
      emitUsers(room);
    }

    socket.data.room = null;
    socket.data.name = null;
    socket.data.isAdmin = false;
  });

  socket.on("disconnect", () => {
    const room = socket.data.room;
    const name = socket.data.name || "Anonymous";

    if (room) {
      socket.to(room).emit("system", `${name} left the room`);
      emitUsers(room);
    }
  });


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("Server running on port", PORT));