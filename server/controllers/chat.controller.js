// =====================================================================
// CHAT CONTROLLER
// =====================================================================
// Sending/receiving messages live happens over Socket.io (see
// socket/index.js) — this REST endpoint exists so a client can load
// history when first opening a chat view, before/without a socket
// connection (e.g. server-rendering a page, or a "load older
// messages" button using the `before` cursor).
// =====================================================================

const asyncHandler = require('../utils/asyncHandler');
const chatChannelModel = require('../models/chatChannel.model');
const chatMessageModel = require('../models/chatMessage.model');
const tournamentModel = require('../models/tournament.model');

/** GET /api/chat/:channel/messages — channel is 'global' or a tournament uuid. */
const getMessages = asyncHandler(async (req, res) => {
  const { channel } = req.params;
  const { limit = 50, before } = req.query;

  let channelId;
  if (channel === 'global') {
    channelId = await chatChannelModel.getGlobalChannelId();
  } else {
    const tournament = await tournamentModel.getInternalId(channel);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Unknown chat channel' });
    }
    channelId = await chatChannelModel.getOrCreateTournamentChannelId(tournament.id);
  }

  const messages = await chatMessageModel.listMessages(channelId, {
    limit: Number(limit),
    before: before ? Number(before) : null,
  });

  res.status(200).json({ success: true, data: { messages } });
});

module.exports = { getMessages };
