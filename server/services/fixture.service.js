// =====================================================================
// FIXTURE GENERATION SERVICE
// =====================================================================
// Bridges the pure algorithms in utils/fixtureGenerators.js to the
// database: pulls a tournament's approved participants, generates
// pairings for its format, and persists them as `matches` rows.
// =====================================================================

const { v4: uuidv4 } = require('uuid');

const tournamentModel = require('../models/tournament.model');
const matchModel = require('../models/match.model');
const { query } = require('../config/database');
const {
  generateRoundRobin,
  generateKnockoutRound1,
  knockoutRoundLabel,
  generateGroups,
  generateSwissRound1,
} = require('../utils/fixtureGenerators');

/** Assign group_label on tournament_participants rows for a 'groups' format tournament. */
async function assignGroupLabels(groups) {
  for (const group of groups) {
    for (const participantId of group.members) {
      // eslint-disable-next-line no-await-in-loop
      await query('UPDATE tournament_participants SET group_label = $2 WHERE id = $1', [participantId, group.label]);
    }
  }
}

/**
 * Generate and persist fixtures for a tournament based on its format.
 * Throws a descriptive error (with .statusCode) on invalid states —
 * callers pass these straight to next(err) via asyncHandler.
 */
async function generateFixtures(tournamentUuid) {
  const tournament = await tournamentModel.getInternalId(tournamentUuid);
  if (!tournament) {
    const err = new Error('Tournament not found');
    err.statusCode = 404;
    throw err;
  }

  const alreadyGenerated = await matchModel.tournamentHasMatches(tournament.id);
  if (alreadyGenerated) {
    const err = new Error('Fixtures have already been generated for this tournament');
    err.statusCode = 409;
    throw err;
  }

  const approved = await tournamentModel.listParticipants(tournament.id, { status: 'approved' });
  if (approved.length < 2) {
    const err = new Error('At least 2 approved participants are required to generate fixtures');
    err.statusCode = 400;
    throw err;
  }

  // We only have participant uuids/names from listParticipants — pull the internal
  // participant ids (needed for match foreign keys) with one lightweight query.
  const idsResult = await query(
    'SELECT id FROM tournament_participants WHERE tournament_id = $1 AND status = $2 ORDER BY id',
    [tournament.id, 'approved']
  );
  const participantIds = idsResult.rows.map((r) => r.id);

  // Fetch the tournament's format directly (getInternalId doesn't include it).
  const formatResult = await query('SELECT format FROM tournaments WHERE id = $1', [tournament.id]);
  const { format } = formatResult.rows[0];

  const fixturesToInsert = [];

  if (format === 'league' || format === 'round_robin') {
    const rounds = generateRoundRobin(participantIds);
    rounds.forEach((pairs, roundIndex) => {
      pairs.forEach(([home, away]) => {
        fixturesToInsert.push({ uuid: uuidv4(), round: `Round ${roundIndex + 1}`, homeParticipantId: home, awayParticipantId: away });
      });
    });
  } else if (format === 'knockout') {
    const pairs = generateKnockoutRound1(participantIds);
    const label = knockoutRoundLabel(pairs.length * 2);
    pairs.forEach(([home, away]) => {
      fixturesToInsert.push({ uuid: uuidv4(), round: label, homeParticipantId: home, awayParticipantId: away });
    });
  } else if (format === 'swiss') {
    const pairs = generateSwissRound1(participantIds);
    pairs.forEach(([home, away]) => {
      fixturesToInsert.push({ uuid: uuidv4(), round: 'Round 1', homeParticipantId: home, awayParticipantId: away });
    });
  } else if (format === 'groups') {
    const groups = generateGroups(participantIds, 4);
    await assignGroupLabels(groups);
    groups.forEach((group) => {
      const rounds = generateRoundRobin(group.members);
      rounds.forEach((pairs, roundIndex) => {
        pairs.forEach(([home, away]) => {
          fixturesToInsert.push({
            uuid: uuidv4(),
            round: `${group.label} - Round ${roundIndex + 1}`,
            homeParticipantId: home,
            awayParticipantId: away,
          });
        });
      });
    });
  } else {
    const err = new Error(`Unsupported tournament format: ${format}`);
    err.statusCode = 400;
    throw err;
  }

  const created = await matchModel.bulkCreateMatches(tournament.id, fixturesToInsert);
  return created;
}

module.exports = { generateFixtures };
