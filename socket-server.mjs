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
const participantRooms = new Map();

function broadcastParticipantCount(presentationId) {
  io.to(presentationId).emit("participant-count", {
    presentationId,
    participantCount: participantRooms.get(presentationId)?.size ?? 0,
  });
}

io.on("connection", (socket) => {
  socket.on("join-presentation", (payload) => {
    const presentationId = typeof payload === "string" ? payload : payload?.presentationId;
    const mode = typeof payload === "string" ? "student" : payload?.mode;
    const sessionId = typeof payload === "string" ? socket.id : payload?.sessionId;
    if (!presentationId) return;
    socket.join(presentationId);
    presentationRooms.set(socket.id, { presentationId, isParticipant: mode === "student", sessionId });
    if (mode === "student") {
      const participants = participantRooms.get(presentationId) ?? new Set();
      participants.add(sessionId);
      participantRooms.set(presentationId, participants);
      broadcastParticipantCount(presentationId);
    }
  });

  socket.on("request-participant-count", (presentationId) => {
    if (!presentationId) return;
    socket.emit("participant-count", {
      presentationId,
      participantCount: participantRooms.get(presentationId)?.size ?? 0,
    });
  });

  socket.on("slide-changed", ({ presentationId, slideNumber }) => {
    if (!presentationId) return;
    io.to(presentationId).emit("slide-changed", { presentationId, slideNumber });
  });

  socket.on("finish-presentation", ({ presentationId }) => {
    if (!presentationId) return;
    io.to(presentationId).emit("presentation-finished", { presentationId });
  });

  socket.on("disconnect", () => {
    const connection = presentationRooms.get(socket.id);
    if (connection) {
      presentationRooms.delete(socket.id);
      if (connection.isParticipant) {
        const participants = participantRooms.get(connection.presentationId);
        const hasReplacementConnection = [...presentationRooms.values()].some(
          (otherConnection) =>
            otherConnection.presentationId === connection.presentationId &&
            otherConnection.isParticipant &&
            otherConnection.sessionId === connection.sessionId,
        );
        if (!hasReplacementConnection) participants?.delete(connection.sessionId);
        if (participants?.size === 0) participantRooms.delete(connection.presentationId);
        broadcastParticipantCount(connection.presentationId);
      }
    }
  });
});

const PORT = 5024;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server listening on http://localhost:${PORT}`);
});
