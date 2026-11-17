/** What the chat service returns for a chat and a message (see its toChat and toMessage). */
export interface ChatSummary {
  id: string;
  title: string;
  pinned: boolean;
  lastMessageAt: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  agent: string | null;
  status: 'streaming' | 'complete' | 'stopped' | 'failed';
  clientMessageId: string | null;
  attachments: string[];
  /** Files the answer made (PDFs, slides, images), by ID. */
  fileRefs: string[];
  artifacts: unknown[];
  sources: unknown[];
  citations: unknown[];
  /** For a finished answer: what it cost, and how long it took in all and to its first word. */
  credits?: number | null;
  latencyMs?: number | null;
  firstTokenMs?: number | null;
  createdAt: string;
}

/** One page of a list, with the cursor for the next page (null on the last one). */
export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ChatGroup {
  label: 'Pinned' | 'Today' | 'Previous 7 days' | 'Older';
  chats: ChatSummary[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Splits the sidebar list into Pinned, Today, Previous 7 days and Older, in the order the service
 * sent them. "Today" starts at local midnight. Empty groups are left out.
 */
export function groupChats(chats: readonly ChatSummary[], now: Date = new Date()): ChatGroup[] {
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = midnight - 7 * DAY_MS;
  const groups: ChatGroup[] = [
    { label: 'Pinned', chats: [] },
    { label: 'Today', chats: [] },
    { label: 'Previous 7 days', chats: [] },
    { label: 'Older', chats: [] },
  ];
  const seen = new Set<string>();
  for (const chat of chats) {
    if (seen.has(chat.id)) {
      continue;
    }
    seen.add(chat.id);
    const at = Date.parse(chat.lastMessageAt);
    const index = chat.pinned ? 0 : at >= midnight ? 1 : at >= weekAgo ? 2 : 3;
    groups[index]?.chats.push(chat);
  }
  return groups.filter((group) => group.chats.length > 0);
}
