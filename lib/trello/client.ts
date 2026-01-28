/**
 * Trello API client
 */

const TRELLO_API_BASE = "https://api.trello.com/1";

interface TrelloConfig {
  apiKey: string;
  apiToken: string;
}

function getConfig(): TrelloConfig {
  const apiKey = process.env.TRELLO_API_KEY;
  const apiToken = process.env.TRELLO_API_TOKEN;

  if (!apiKey || !apiToken) {
    throw new Error(
      "Missing Trello credentials. Set TRELLO_API_KEY and TRELLO_API_TOKEN in environment."
    );
  }

  return { apiKey, apiToken };
}

function buildUrl(path: string, params: Record<string, string> = {}): string {
  const config = getConfig();
  const url = new URL(`${TRELLO_API_BASE}${path}`);

  url.searchParams.set("key", config.apiKey);
  url.searchParams.set("token", config.apiToken);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.toString();
}

async function fetchTrello<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
  const url = buildUrl(path, params);
  const response = await fetch(url);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Trello API error: ${response.status} - ${text}`);
  }

  return response.json();
}

// API Response Types
export interface TrelloMember {
  id: string;
  fullName: string;
  username: string;
}

export interface TrelloLabel {
  id: string;
  idBoard: string;
  name: string;
  color: string;
  uses: number;
}

export interface TrelloList {
  id: string;
  name: string;
  pos: number;
  closed: boolean;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  dueComplete: boolean;
  idBoard: string;
  idList: string;
  idLabels: string[];
  idMembers: string[];
  labels: TrelloLabel[];
  members?: TrelloMember[];
  pos: number;
  shortLink: string;
  shortUrl: string;
  url: string;
  dateLastActivity: string;
  closed: boolean;
}

export interface TrelloBoard {
  id: string;
  name: string;
  url: string;
  shortUrl: string;
}

// Client functions

/**
 * Get current authenticated member info
 */
export async function getMe(): Promise<TrelloMember> {
  return fetchTrello<TrelloMember>("/members/me", {
    fields: "id,fullName,username",
  });
}

/**
 * Get all boards for the authenticated member
 */
export async function getBoards(): Promise<TrelloBoard[]> {
  return fetchTrello<TrelloBoard[]>("/members/me/boards", {
    fields: "id,name,url,shortUrl",
  });
}

/**
 * Get all lists for a board
 */
export async function getBoardLists(boardId: string): Promise<TrelloList[]> {
  return fetchTrello<TrelloList[]>(`/boards/${boardId}/lists`, {
    fields: "id,name,pos,closed",
  });
}

/**
 * Get all labels for a board
 */
export async function getBoardLabels(boardId: string): Promise<TrelloLabel[]> {
  return fetchTrello<TrelloLabel[]>(`/boards/${boardId}/labels`);
}

/**
 * Get all cards for a board with full details
 */
export async function getBoardCards(boardId: string): Promise<TrelloCard[]> {
  return fetchTrello<TrelloCard[]>(`/boards/${boardId}/cards`, {
    fields:
      "id,name,desc,due,dueComplete,idBoard,idList,idLabels,idMembers,labels,pos,shortLink,shortUrl,url,dateLastActivity,closed",
    members: "true",
    member_fields: "id,fullName,username",
  });
}

/**
 * Get cards for a specific list
 */
export async function getListCards(listId: string): Promise<TrelloCard[]> {
  return fetchTrello<TrelloCard[]>(`/lists/${listId}/cards`, {
    fields:
      "id,name,desc,due,dueComplete,idBoard,idList,idLabels,idMembers,labels,pos,shortLink,shortUrl,url,dateLastActivity,closed",
    members: "true",
    member_fields: "id,fullName,username",
  });
}

/**
 * Get a single card by ID
 */
export async function getCard(cardId: string): Promise<TrelloCard> {
  return fetchTrello<TrelloCard>(`/cards/${cardId}`, {
    fields:
      "id,name,desc,due,dueComplete,idBoard,idList,idLabels,idMembers,labels,pos,shortLink,shortUrl,url,dateLastActivity,closed",
    members: "true",
    member_fields: "id,fullName,username",
  });
}

/**
 * Get all board members
 */
export async function getBoardMembers(
  boardId: string
): Promise<TrelloMember[]> {
  return fetchTrello<TrelloMember[]>(`/boards/${boardId}/members`, {
    fields: "id,fullName,username",
  });
}

// Publishing board ID (can be moved to config)
export const PUBLISHING_BOARD_ID = "66f358bba2848a046daa5e45";

/**
 * Get all data from the Publishing board
 */
export async function getPublishingBoardData(): Promise<{
  lists: TrelloList[];
  cards: TrelloCard[];
  labels: TrelloLabel[];
  members: TrelloMember[];
}> {
  const [lists, cards, labels, members] = await Promise.all([
    getBoardLists(PUBLISHING_BOARD_ID),
    getBoardCards(PUBLISHING_BOARD_ID),
    getBoardLabels(PUBLISHING_BOARD_ID),
    getBoardMembers(PUBLISHING_BOARD_ID),
  ]);

  return { lists, cards, labels, members };
}
