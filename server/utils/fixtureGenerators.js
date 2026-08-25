// =====================================================================
// FIXTURE GENERATION ALGORITHMS
// =====================================================================
// Pure functions only — no database access. Each takes an array of
// participant identifiers (opaque values, e.g. participant row ids)
// and returns pairings. Kept separate from fixture.service.js so the
// scheduling logic can be unit-tested without a database.
//
// A `null` in a pair means "bye" (the other side advances/gets a free
// week) — used when the participant count is odd (round robin) or not
// a power of two (knockout).
// =====================================================================

/** Fisher-Yates shuffle — used to randomize seeding where no ranking exists yet. */
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Round-robin (circle method): every participant plays every other
 * participant exactly once. Also used as the "league" format.
 * Returns an array of rounds; each round is an array of [home, away] pairs.
 */
function generateRoundRobin(participantIds) {
  const ids = [...participantIds];
  if (ids.length % 2 !== 0) {
    ids.push(null); // bye slot so the pairing math stays even
  }

  const numRounds = ids.length - 1;
  const half = ids.length / 2;
  const rounds = [];
  let arr = [...ids];

  for (let round = 0; round < numRounds; round += 1) {
    const pairs = [];
    for (let i = 0; i < half; i += 1) {
      const home = arr[i];
      const away = arr[arr.length - 1 - i];
      if (home !== null && away !== null) {
        // Alternate home/away by round parity so one side doesn't
        // always get "home advantage" in every fixture.
        pairs.push(round % 2 === 0 ? [home, away] : [away, home]);
      }
    }
    rounds.push(pairs);

    // Rotate all but the first element — standard circle-method step.
    arr = [arr[0], arr[arr.length - 1], ...arr.slice(1, arr.length - 1)];
  }

  return rounds;
}

/**
 * Single-elimination knockout, round 1 only. Higher-seeded players
 * (earlier in the array) are paired against lower-seeded ones
 * (1 vs last, 2 vs second-last, ...) — standard bracket seeding to
 * keep top seeds apart for as long as possible. Byes go to the
 * top seeds when the field isn't a power of two.
 */
function generateKnockoutRound1(participantIds) {
  const ids = [...participantIds];
  const bracketSize = 2 ** Math.ceil(Math.log2(ids.length));

  // Pad with byes at the bottom of the seed order. Under 1-vs-last
  // pairing below, this naturally hands byes to the *top* seeds
  // (seed 1 faces the last, null, slot) rather than the bottom ones.
  while (ids.length < bracketSize) {
    ids.push(null);
  }

  const pairs = [];
  for (let i = 0; i < ids.length / 2; i += 1) {
    pairs.push([ids[i], ids[ids.length - 1 - i]]);
  }
  return pairs;
}

/** Human-readable round label based on how many participants remain in a knockout bracket. */
function knockoutRoundLabel(participantsRemaining) {
  if (participantsRemaining <= 2) return 'Final';
  if (participantsRemaining === 4) return 'Semi Final';
  if (participantsRemaining === 8) return 'Quarter Final';
  return `Round of ${participantsRemaining}`;
}

/**
 * Split participants into groups of roughly `groupSize`, labeled
 * "Group A", "Group B", etc. Participants are distributed in
 * round-robin order (1st → A, 2nd → B, 3rd → A/B/C...) so groups stay
 * evenly sized rather than front-loading the first group.
 */
function generateGroups(participantIds, groupSize = 4) {
  const numGroups = Math.max(1, Math.ceil(participantIds.length / groupSize));
  const groups = Array.from({ length: numGroups }, () => []);

  participantIds.forEach((id, index) => {
    groups[index % numGroups].push(id);
  });

  return groups.map((members, index) => ({
    label: `Group ${String.fromCharCode(65 + index)}`, // A, B, C, ...
    members,
  }));
}

/**
 * Swiss round 1: no standings exist yet, so pairing is randomized
 * (optionally seeded) rather than by rank.
 */
function generateSwissRound1(participantIds) {
  const shuffled = shuffle(participantIds);
  const pairs = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    pairs.push([shuffled[i], shuffled[i + 1] ?? null]); // odd count -> last gets a bye
  }
  return pairs;
}

/**
 * Swiss round N (N > 1): pair participants with similar records,
 * avoiding rematches where possible. `standings` must be pre-sorted
 * best-to-worst (by points, then goal difference). `playedPairsSet`
 * is a Set of "idA-idB" strings (both orderings) for matches already
 * played, used to skip rematches.
 *
 * This is a greedy pairing, not a full Swiss algorithm (no backtracking
 * for edge cases with many repeat pairings) — sufficient for
 * community-tournament sizes where true FIDE-style pairing isn't needed.
 */
function generateSwissNextRound(standings, playedPairsSet = new Set()) {
  const remaining = [...standings];
  const pairs = [];

  while (remaining.length > 0) {
    const current = remaining.shift();
    if (remaining.length === 0) {
      pairs.push([current, null]); // odd count -> bye for the lowest-ranked leftover
      break;
    }

    // Find the closest-ranked opponent that hasn't already been played.
    let opponentIndex = 0;
    while (
      opponentIndex < remaining.length - 1 &&
      playedPairsSet.has(`${current}-${remaining[opponentIndex]}`)
    ) {
      opponentIndex += 1;
    }

    const [opponent] = remaining.splice(opponentIndex, 1);
    pairs.push([current, opponent]);
  }

  return pairs;
}

module.exports = {
  generateRoundRobin,
  generateKnockoutRound1,
  knockoutRoundLabel,
  generateGroups,
  generateSwissRound1,
  generateSwissNextRound,
};
