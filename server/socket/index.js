// =====================================================================
// SOCKET.IO SERVER
// =====================================================================
// Real-time layer: live chat (global + per-tournament), typing
// indicators, online-player presence, and the transport used by
// notification.service.js to push notifications live. Attached to the
// same HTTP server as Express (see server.js) — Socket.io upgrades
// the connection from plain HTTP, it doesn't need its own port.
// =====================================================================

const { Server } = require('socket.io');

const { verifyAccessToken } = require('../utils/jwt');
const userModel = require('../models/user.model');
const chatChannelModel = require('../models/chatChannel.model');
const chatMessageModel = require('../models/chatMessage.model');
const tournamentModel = require('../models/tournament.model');

let ioInstance = null;

// uuid -> Set of socket ids. A Set (not a single id) supports a user
// having the app open in multiple tabs/devices at once — presence
// only flips to "offline" once every connection for that uuid closes.
const onlineUsers = new Map();

function markOnline(uuid, socketId) {
  if (!onlineUsers.has(uuid)) {
    onlineUsers.set(uuid, new Set());
  }
  onlineUsers.get(uuid).add(socketId);
  return onlineUsers.get(uuid).size === 1; // true if this is their first connection
}

function markOffline(uuid, socketId) {
  const sockets = onlineUsers.get(uuid);
  if (!sockets) return false;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(uuid);
    return true; // true if they now have zero connections left
  }
  return false;
}

function getOnlineUuids() {
  return Array.from(onlineUsers.keys());
}

/** Resolve a client-supplied channel key ('global' or a tournament uuid) to a numeric channel id. */
async function resolveChannelId(channelKey) {
  if (channelKey === 'global') {
    return chatChannelModel.getGlobalChannelId();
  }
  const tournament = await tournamentModel.getInternalId(channelKey);
  if (!tournament) {
    throw new Error('Unknown chat channel');
  }
  return chatChannelModel.getOrCreateTournamentChannelId(tournament.id);
}

function initSocket(httpServer) {
  const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000').split(',');

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  // ---------------------------------------------------------------
  // Auth middleware — every socket connection must present a valid
  // access token (same JWT used for REST requests), passed as
  // `socket.handshake.auth.token` from the client.
  // ---------------------------------------------------------------
  io.use((socket, next) => {
    const { token } = socket.handshake.auth || {};
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = verifyAccessToken(token);
      socket.user = { uuid: decoded.sub, role: decoded.role, username: decoded.username };
      return next();
    } catch (err) {
      return next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const { uuid, username } = socket.user;

    // Every user gets a personal room for direct pushes (notifications).
    socket.join(`user:${uuid}`);

    const isFirstConnection = markOnline(uuid, socket.id);
    if (isFirstConnection) {
      io.emit('presence:online', { uuid, username });
    }
    // Let the newly-connected client know who else is already online.
    socket.emit('presence:list', { online: getOnlineUuids() });

    // -------------------------------------------------------------
    // Chat: join a channel and receive its recent history
    // -------------------------------------------------------------
    socket.on('chat:join', async ({ channel }, callback) => {
      try {
        const channelId = await resolveChannelId(channel);
        socket.join(`chat:${channelId}`);
        const history = await chatMessageModel.listMessages(channelId, { limit: 50 });
        if (typeof callback === 'function') callback({ success: true, channelId, history });
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, message: err.message });
      }
    });

    socket.on('chat:leave', ({ channel }) => {
      resolveChannelId(channel)
        .then((channelId) => socket.leave(`chat:${channelId}`))
        .catch(() => {}); // leaving a channel that fails to resolve is a no-op, not an error worth surfacing
    });

    // -------------------------------------------------------------
    // Chat: send a message — persists then broadcasts to the room
    // -------------------------------------------------------------
    socket.on('chat:message', async ({ channel, message }, callback) => {
      try {
        const trimmed = (message || '').trim();
        if (!trimmed) {
          throw new Error('Message cannot be empty');
        }
        if (trimmed.length > 2000) {
          throw new Error('Message is too long (max 2000 characters)');
        }

        const channelId = await resolveChannelId(channel);
        const sender = await userModel.findByUuid(uuid);
        const saved = await chatMessageModel.createMessage(channelId, sender.id, trimmed);

        io.to(`chat:${channelId}`).emit('chat:message', {
          id: saved.id,
          message: saved.message,
          createdAt: saved.created_at,
          senderUuid: uuid,
          senderUsername: username,
        });

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        if (typeof callback === 'function') callback({ success: false, message: err.message });
      }
    });

    // -------------------------------------------------------------
    // Chat: typing indicator — ephemeral, not persisted, sent to
    // everyone else in the room except the typer.
    // -------------------------------------------------------------
    socket.on('chat:typing', async ({ channel, isTyping }) => {
      try {
        const channelId = await resolveChannelId(channel);
        socket.to(`chat:${channelId}`).emit('chat:typing', { username, isTyping: Boolean(isTyping) });
      } catch (err) {
        // Typing indicators are best-effort — silently drop failures.
      }
    });

    // -------------------------------------------------------------
    // Disconnect: update presence once all of a user's tabs/devices
    // have disconnected.
    // -------------------------------------------------------------
    socket.on('disconnect', () => {
      const wentFullyOffline = markOffline(uuid, socket.id);
      if (wentFullyOffline) {
        io.emit('presence:offline', { uuid, username });
      }
    });
  });

  ioInstance = io;
  return io;
}

/** Used by notification.service.js (and anywhere else that needs to push events) to reach the live socket server. */
function getIO() {
  return ioInstance;
}

module.exports = { initSocket, getIO };
