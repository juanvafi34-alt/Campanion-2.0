const http = require("http");
const { Server } = require("socket.io");

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200);
    return res.end("ok");
  }
  res.writeHead(200);
  res.end("Campanion server running");
});

const io = new Server(server, {
  cors: {
    origin: "https://campanion20.netlify.app",
    methods: ["GET", "POST"]
  }
});

const VALID_ROOMS = new Set([
  "PINE123",
  "LAKE777",
  "CAMP999"
]);

io.on("connection", (socket) => {

  socket.on("joinRoom", ({ name, code }) => {

    if (!VALID_ROOMS.has(code)) {
      socket.emit("invalidRoom");
      return;
    }

    socket.join(code);
    socket.roomCode = code;
    socket.name = name;

    socket.emit("joined", code);

    socket.to(code).emit("system", `${name} joined the room`);
  });

  socket.on("chat", (msg) => {
    if (!socket.roomCode) return;
    io.to(socket.roomCode).emit("chat", {
      name: socket.name,
      text: msg
    });
  });

  socket.on("disconnect", () => {
    if (socket.roomCode) {
      socket.to(socket.roomCode).emit("system", `${socket.name} left`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});