import type { ReadyDocument } from '../agents/pdf-qa.ts';
import type { AgentContext } from '../agents/types.ts';
import { DocumentModel, FileModel } from './models.ts';

/**
 * The PDFs a question is about: the ones attached to the message, or, for a follow-up with none
 * attached, every PDF of the chat that has finished being read. Always the user's own.
 */
export async function readyDocuments(context: AgentContext): Promise<ReadyDocument[]> {
  if (!context.userId || !context.chatId) {
    return [];
  }
  const attached = (context.attachments ?? [])
    .filter((file) => file.purpose === 'pdf')
    .map((file) => file.fileId);
  const documents = await DocumentModel.find({
    userId: context.userId,
    chatId: context.chatId,
    status: 'ready',
    ...(attached.length > 0 ? { fileId: { $in: attached } } : {}),
  });
  const files = await FileModel.find({
    _id: { $in: documents.map((document) => document.fileId) },
  });
  const names = new Map(files.map((file) => [file.id, file.name]));
  return documents.map((document) => ({
    id: document.id,
    name: names.get(document.fileId.toString()) ?? 'Document',
  }));
}
