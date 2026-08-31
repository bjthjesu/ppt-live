import { createServer } from "node:http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const presentationRooms = new Map();

io.on("connection", (socket) => {
  socket.on("join-presentation", (presentationId) => {
    if (!presentationId) return;
    socket.join(presentationId);
    presentationRooms.set(socket.id, presentationId);
  });

  socket.on("slide-changed", ({ presentationId, slideNumber }) => {
    if (!presentationId) return;
    io.to(presentationId).emit("slide-changed", { presentationId, slideNumber });
  });

  socket.on("disconnect", () => {
    const presentationId = presentationRooms.get(socket.id);
    if (presentationId) {
      presentationRooms.delete(socket.id);
    }
  });
});

const PORT = 5024;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server listening on http://localhost:${PORT}`);
});
