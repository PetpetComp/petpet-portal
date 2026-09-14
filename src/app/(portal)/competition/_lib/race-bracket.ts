export type MatchType = "Qualification" | "Final";

export interface MatchResult {
  position: string;
  time: number | null;
  checkpointTimes?: number[];
}

export interface RaceMatch {
  id: string;
  round: number;
  match: number;
  type: MatchType;
  participantIds: string[];
  results: Record<string, MatchResult>;
  confirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
}

export interface RaceBracket {
  rounds: RaceMatch[][];
}

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups.length ? groups : [[]];
}

function buildRound(participantIds: string[], round: number, lanes: number): RaceMatch[] {
  const groups = chunk(participantIds, lanes);
  return groups.map((ids, index) => ({
    id: "R" + round + "M" + (index + 1),
    round,
    match: index + 1,
    type: groups.length <= 1 ? "Final" : "Qualification",
    participantIds: ids,
    results: {},
    confirmed: false,
  }));
}

export function buildInitialBracket(participantIds: string[], lanes: number): RaceBracket {
  return { rounds: [buildRound(participantIds, 1, lanes)] };
}

export function parseBracket(
  json: string | undefined,
  participantIds: string[],
  lanes: number,
): RaceBracket {
  if (!json) return buildInitialBracket(participantIds, lanes);
  try {
    const parsed = JSON.parse(json) as RaceBracket;
    if (!parsed.rounds?.length || !parsed.rounds[0].length) {
      return buildInitialBracket(participantIds, lanes);
    }
    return parsed;
  } catch {
    return buildInitialBracket(participantIds, lanes);
  }
}

export function isRoundComplete(round: RaceMatch[]): boolean {
  return round.length > 0 && round.every((item) => item.confirmed);
}

export function qualifiersFrom(match: RaceMatch, perMatch: number): string[] {
  return Object.entries(match.results)
    .filter(([, result]) => result.position !== "" && !["DNS", "DSQ"].includes(result.position))
    .sort((a, b) => Number(a[1].position) - Number(b[1].position))
    .slice(0, perMatch)
    .map(([petId]) => petId);
}

export function generateNextRound(
  currentRound: RaceMatch[],
  perMatch: number,
  lanes: number,
): RaceMatch[] {
  const qualifiers = currentRound.flatMap((match) => qualifiersFrom(match, perMatch));
  const roundNumber = (currentRound[0]?.round ?? 0) + 1;
  return buildRound(qualifiers, roundNumber, lanes);
}

export function canSwap(match: RaceMatch, petId: string): boolean {
  return !match.confirmed && !match.results[petId];
}

export function swapParticipants(
  bracket: RaceBracket,
  roundIndex: number,
  petA: string,
  petB: string,
): RaceBracket {
  return {
    rounds: bracket.rounds.map((round, index) =>
      index !== roundIndex
        ? round
        : round.map((match) => ({
            ...match,
            participantIds: match.participantIds.map((id) =>
              id === petA ? petB : id === petB ? petA : id,
            ),
          })),
    ),
  };
}

export function shuffleIds(ids: string[]): string[] {
  const next = [...ids];
  for (let index = next.length - 1; index > 0; index--) {
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    const target = Math.floor(random * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}
