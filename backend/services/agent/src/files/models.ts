import { type HydratedDocument, type InferSchemaType, mongoose } from '@gilder/shared';

/**
 * The agent's own data (gilder_agent): the files people upload or the agents make, and the PDFs
 * indexed for questions. Every query filters by the owner.
 */

const { Schema } = mongoose;

export const FILE_KINDS = ['upload', 'generated'] as const;
export const FILE_PURPOSES = ['pdf', 'image', 'slides'] as const;
export const FILE_STATUSES = ['pending', 'ready', 'failed'] as const;

const fileSchema = new Schema(
  {
    userId: { type: String, required: true },
    chatId: { type: String, required: true },
    kind: { type: String, enum: FILE_KINDS, required: true },
    purpose: { type: String, enum: FILE_PURPOSES, required: true },
    /** The name to show and download under. Never part of the storage key. */
    name: { type: String, required: true, maxlength: 200 },
    /** users/{userId}/{kind}s/{fileId}: made by the server from IDs only. */
    s3Key: { type: String, required: true },
    mime: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 0 },
    status: { type: String, enum: FILE_STATUSES, required: true, default: 'pending' },
    pageCount: { type: Number, default: null },
  },
  { timestamps: true },
);
fileSchema.index({ userId: 1, chatId: 1, createdAt: -1 });

export const DOCUMENT_STATUSES = ['indexing', 'ready', 'failed'] as const;

const documentSchema = new Schema(
  {
    fileId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: String, required: true },
    chatId: { type: String, required: true },
    pageCount: { type: Number, required: true },
    status: { type: String, enum: DOCUMENT_STATUSES, required: true, default: 'indexing' },
    error: { type: String, default: null },
  },
  { timestamps: true },
);
documentSchema.index({ fileId: 1 }, { unique: true });
documentSchema.index({ userId: 1, chatId: 1 });

export type StoredFile = InferSchemaType<typeof fileSchema>;
export type FileDocument = HydratedDocument<StoredFile>;
export type IndexedDocument = HydratedDocument<InferSchemaType<typeof documentSchema>>;

export const FileModel = mongoose.model('File', fileSchema);
export const DocumentModel = mongoose.model('Document', documentSchema);

/** What the API shows of a file. Links are made fresh on request, never stored. */
export interface FileView {
  id: string;
  chatId: string;
  kind: (typeof FILE_KINDS)[number];
  purpose: (typeof FILE_PURPOSES)[number];
  name: string;
  mime: string;
  sizeBytes: number;
  status: (typeof FILE_STATUSES)[number];
  pageCount: number | null;
}

export function toFile(file: FileDocument): FileView {
  return {
    id: file.id,
    chatId: file.chatId,
    kind: file.kind,
    purpose: file.purpose,
    name: file.name,
    mime: file.mime,
    sizeBytes: file.sizeBytes,
    status: file.status,
    pageCount: file.pageCount ?? null,
  };
}

/** The file with this ID if it belongs to the user; otherwise null (never another user's). */
export async function findOwnedFile(userId: string, fileId: string): Promise<FileDocument | null> {
  if (!mongoose.isValidObjectId(fileId)) {
    return null;
  }
  return FileModel.findOne({ _id: fileId, userId });
}
