import type { Choice, RoundHistory, GameConfig, Award, Player } from '../types';

export function countBetrayers(choices: Record<string, Choice>): number {
  return Object.values(choices).filter(c => c === 'B').length;
}

export function hasCooperatedStreak(
  playerId: string,
  history: RoundHistory[],
  streakLength: number
): boolean {
  if (history.length < streakLength) return false;

  const recentRounds = history.slice(-streakLength);
  return recentRounds.every(round => round.choices[playerId] === 'C');
}

export function countRevengeTargets(
  playerId: string,
  currentChoices: Record<string, Choice>,
  history: RoundHistory[]
): number {
  if (history.length === 0) return 0;

  const lastRound = history[history.length - 1];
  let revengeCount = 0;

  for (const [otherId, otherChoice] of Object.entries(currentChoices)) {
    if (otherId === playerId) continue;

    // Check if this player betrayed us last round and is now cooperating
    const theyBetrayedUs = lastRound.choices[otherId] === 'B';
    const theyCoopNow = otherChoice === 'C';

    if (theyBetrayedUs && theyCoopNow) {
      revengeCount++;
    }
  }

  return revengeCount;
}

export function computeRoundDeltas(
  choices: Record<string, Choice>,
  history: RoundHistory[],
  config: GameConfig
): Record<string, number> {
  const B = countBetrayers(choices);
  const deltas: Record<string, number> = {};

  for (const [playerId, choice] of Object.entries(choices)) {
    let delta = 0;

    // Base scoring
    if (B === 0) {
      delta = 2; // Everyone cooperated
    } else if (B === 1) {
      delta = choice === 'B' ? 5 : -2; // Lone betrayer gets jackpot
    } else {
      delta = choice === 'B' ? 1 : -3; // Multiple betrayers
    }

    // Streak bonus: +2 if cooperated 3+ rounds in a row and B=0
    if (config.streakBonus && choice === 'C' && B === 0) {
      if (hasCooperatedStreak(playerId, history, 3)) {
        delta += 2;
      }
    }

    // Revenge bonus: +1 per player who betrayed you last round but cooperates now
    if (config.revengeBonus && choice === 'B') {
      delta += countRevengeTargets(playerId, choices, history);
    }

    deltas[playerId] = delta;
  }

  return deltas;
}

export function computeAwards(
  players: Record<string, Player>,
  history: RoundHistory[]
): Award[] {
  const awards: Award[] = [];
  const playerIds = Object.keys(players);

  if (playerIds.length === 0 || history.length === 0) return awards;

  // Most Trusted: trustedScore = (100 * coopCount / R) - (15 * loneBetrayCount)
  let mostTrusted = { playerId: '', score: -Infinity };
  for (const playerId of playerIds) {
    let coopCount = 0;
    let loneBetrayCount = 0;

    for (const round of history) {
      if (round.choices[playerId] === 'C') {
        coopCount++;
      } else if (round.betrayerCount === 1 && round.choices[playerId] === 'B') {
        loneBetrayCount++;
      }
    }

    const trustedScore = (100 * coopCount / history.length) - (15 * loneBetrayCount);
    if (trustedScore > mostTrusted.score) {
      mostTrusted = { playerId, score: trustedScore };
    }
  }

  if (mostTrusted.playerId) {
    awards.push({
      type: 'most-trusted',
      playerId: mostTrusted.playerId,
      playerName: players[mostTrusted.playerId].name,
      value: Math.round(mostTrusted.score),
    });
  }

  // Most Evil: sum of cooperators in rounds where this player betrayed
  let mostEvil = { playerId: '', score: -Infinity };
  for (const playerId of playerIds) {
    let evilScore = 0;

    for (const round of history) {
      if (round.choices[playerId] === 'B') {
        const coopersInRound = Object.values(round.choices).filter(c => c === 'C').length;
        evilScore += coopersInRound;
      }
    }

    if (evilScore > mostEvil.score) {
      mostEvil = { playerId, score: evilScore };
    }
  }

  if (mostEvil.playerId && mostEvil.score > 0) {
    awards.push({
      type: 'most-evil',
      playerId: mostEvil.playerId,
      playerName: players[mostEvil.playerId].name,
      value: mostEvil.score,
    });
  }

  // Biggest Swing: max absolute delta in any round
  let biggestSwing = { playerId: '', value: 0, round: 0 };
  for (const playerId of playerIds) {
    for (const round of history) {
      const delta = Math.abs(round.deltas[playerId] || 0);
      if (delta > biggestSwing.value) {
        biggestSwing = { playerId, value: delta, round: round.roundIndex };
      }
    }
  }

  if (biggestSwing.playerId) {
    awards.push({
      type: 'biggest-swing',
      playerId: biggestSwing.playerId,
      playerName: players[biggestSwing.playerId].name,
      value: biggestSwing.value,
    });
  }

  // Kingmaker: counterfactual impact - how much would scores change if player flipped choices
  let kingmaker = { playerId: '', impact: 0 };
  for (const playerId of playerIds) {
    let totalImpact = 0;

    for (const round of history) {
      // Calculate what would have happened if this player flipped
      const flippedChoices = { ...round.choices };
      flippedChoices[playerId] = flippedChoices[playerId] === 'C' ? 'B' : 'C';

      const actualB = round.betrayerCount;
      const flippedB = round.choices[playerId] === 'C' ? actualB + 1 : actualB - 1;

      // Calculate impact on other players
      for (const otherId of playerIds) {
        if (otherId === playerId) continue;

        const otherChoice = round.choices[otherId];

        // Actual delta for other player
        let actualDelta = 0;
        if (actualB === 0) actualDelta = 2;
        else if (actualB === 1) actualDelta = otherChoice === 'B' ? 5 : -2;
        else actualDelta = otherChoice === 'B' ? 1 : -3;

        // Flipped delta for other player
        let flippedDelta = 0;
        if (flippedB === 0) flippedDelta = 2;
        else if (flippedB === 1) flippedDelta = otherChoice === 'B' ? 5 : -2;
        else flippedDelta = otherChoice === 'B' ? 1 : -3;

        totalImpact += Math.abs(flippedDelta - actualDelta);
      }
    }

    if (totalImpact > kingmaker.impact) {
      kingmaker = { playerId, impact: totalImpact };
    }
  }

  if (kingmaker.playerId) {
    awards.push({
      type: 'kingmaker',
      playerId: kingmaker.playerId,
      playerName: players[kingmaker.playerId].name,
      value: kingmaker.impact,
    });
  }

  return awards;
}
