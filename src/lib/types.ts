export interface CardAnalysis {
  id: string;
  inclusionRate: number;
  avgCount: number;
}

export interface LeaderStats {
  leader: string;
  leaderId: string;
  totalAppearances: number;
  wins: number;
  second?: number;
  third?: number;
  fourth?: number;
  top4: number;
  top8: number;
  top16: number;
  top32: number;
  uniquePlayers: number;
  uniqueEvents: number;
  players: string[];
  events: string[];
  winRate?: number;
  topRate?: number;
  conversionRate?: number;
  metaShare?: number;
  points?: number;
  coreCards?: CardAnalysis[];
  flexCards?: CardAnalysis[];
}

export interface DeckCard {
  id: string;
  count: number;
}

export interface Deck {
  placing: string;
  leader: string;
  leaderId: string;
  player: string;
  deckUrl: string;
  cards: DeckCard[];
}

export interface EventData {
  name: string;
  url: string;
  type: string;
  date: string;
  players: number;
  rounds: string;
  leaderDistribution: Record<string, number>;
  decks: Deck[];
}

export interface MetaData {
  id: string;
  name: string;
  url: string;
  events: EventData[];
  leaderStats: LeaderStats[];
}

export interface MetaSummary {
  id: string;
  name: string;
  url: string;
  eventCount: number;
  totalDecks: number;
  deckCount?: number;
  topLeaders: string[];
}

export interface SummaryData {
  metas: MetaSummary[];
  totalEvents?: number;
  totalDecks?: number;
}

export interface Card {
  id: string;
  name: string;
  fullName?: string;
  image: string;
  color: string;
  type: string;
  cost: string;
  power: string;
  counter?: string;
  rarity: string;
  text: string;
  attribute: string;
  subTypes: string;
  life: string;
  set: string;
}
