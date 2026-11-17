import { AGENTS, type HydratedDocument, type InferSchemaType, mongoose } from '@gilder/shared';

/**
 * The chat service's data, in its own database (gilder_chat): conversations and their
 * messages. Every query filters by the owner's user ID, so one user never reads another's chats.
 */

const { Schema } = mongoose;

export const DEFAULT_CHAT_TITLE = 'New chat';
export const MESSAGE_ROLES = ['user', 'assistant'] as const;
export const MESSAGE_STATUSES = ['streaming', 'complete', 'stopped', 'failed'] as const;

const conversationSchema = new Schema(
  {
    userId: { type: String, required: true },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      default: DEFAULT_CHAT_TITLE,
    },
    /** Set while the chat is pinned; pinned chats list first, latest pin first. */
    pinnedAt: { type: Date, default: null },
    /** When the last message was added; the chat list is ordered by it. */
    lastMessageAt: { type: Date, required: true, default: () => new Date() },
    /** Soft delete: a deleted chat disappears from every query but its data stays for clean-up. */
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
// The chat list: one user's chats, pinned first, then the most recently active.
conversationSchema.index({ userId: 1, pinnedAt: -1, lastMessageAt: -1 });
// Search by title within one user's chats. The userId prefix keeps every search to its owner.
conversationSchema.index({ userId: 1, title: 'text' });

const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: String, required: true },
    role: { type: String, enum: MESSAGE_ROLES, required: true },
    content: { type: String, default: '' },
    /** Which agent wrote an assistant message, such as 'chat' or 'search'. */
    agent: { type: String, enum: AGENTS },
    status: { type: String, enum: MESSAGE_STATUSES, required: true, default: 'complete' },
    /** Chosen by the browser, so a retried send can't save the same message twice. */
    clientMessageId: { type: String, maxlength: 64 },
    /** Set when an edit or a regenerate replaces this message. Superseded messages are hidden. */
    supersededBy: { type: Schema.Types.ObjectId, default: null },
    /** File IDs only, never URLs: links are made fresh each time a message is read. */
    attachments: { type: [String], default: [] },
    fileRefs: { type: [String], default: [] },
    /** Filled in by the agents that produce them (code files, web sources, page citations). */
    artifacts: { type: [Schema.Types.Mixed], default: [] },
    sources: { type: [Schema.Types.Mixed], default: [] },
    citations: { type: [Schema.Types.Mixed], default: [] },
    /** For a finished answer: the credits it cost, and how long it took in all and to its first word. */
    credits: { type: Number, min: 0 },
    latencyMs: { type: Number, min: 0 },
    firstTokenMs: { type: Number, min: 0 },
  },
  { timestamps: true },
);
// A chat's messages in order.
messageSchema.index({ conversationId: 1, createdAt: 1 });
// One message per client ID within a chat; messages without one are not constrained.
messageSchema.index(
  { conversationId: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: 'string' } } },
);
// Search message text within one user's chats.
messageSchema.index({ userId: 1, content: 'text' });

export type Conversation = InferSchemaType<typeof conversationSchema>;
export type ConversationDocument = HydratedDocument<Conversation>;
export type Message = InferSchemaType<typeof messageSchema>;
export type MessageDocument = HydratedDocument<Message>;

export const ConversationModel = mongoose.model('Conversation', conversationSchema);
export const MessageModel = mongoose.model('Message', messageSchema);

/** The chat with this ID if it belongs to the user and isn't deleted; otherwise null. */
export async function findOwnedConversation(
  userId: string,
  conversationId: string,
): Promise<ConversationDocument | null> {
  if (!mongoose.isValidObjectId(conversationId)) {
    return null;
  }
  return ConversationModel.findOne({ _id: conversationId, userId, deletedAt: null });
}

/** What the API shows of a chat. */
export interface ChatSummary {
  id: string;
  title: string;
  pinned: boolean;
  lastMessageAt: string;
  createdAt: string;
}

export function toChat(conversation: ConversationDocument): ChatSummary {
  return {
    id: conversation.id,
    title: conversation.title,
    pinned: conversation.pinnedAt !== null && conversation.pinnedAt !== undefined,
    lastMessageAt: conversation.lastMessageAt.toISOString(),
    createdAt: conversation.createdAt.toISOString(),
  };
}

/** What the API shows of a message. */
export interface MessageView {
  id: string;
  role: (typeof MESSAGE_ROLES)[number];
  content: string;
  agent: string | null;
  status: (typeof MESSAGE_STATUSES)[number];
  clientMessageId: string | null;
  attachments: string[];
  /** Files the answer made (PDFs, slides, images), by ID. */
  fileRefs: string[];
  artifacts: unknown[];
  sources: unknown[];
  citations: unknown[];
  credits: number | null;
  latencyMs: number | null;
  firstTokenMs: number | null;
  createdAt: string;
}

export function toMessage(message: MessageDocument): MessageView {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    agent: message.agent ?? null,
    status: message.status,
    clientMessageId: message.clientMessageId ?? null,
    attachments: message.attachments,
    fileRefs: message.fileRefs,
    artifacts: message.artifacts,
    sources: message.sources,
    citations: message.citations,
    credits: message.credits ?? null,
    latencyMs: message.latencyMs ?? null,
    firstTokenMs: message.firstTokenMs ?? null,
    createdAt: message.createdAt.toISOString(),
  };
}
