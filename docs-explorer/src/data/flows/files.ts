import type { Flow, SymbolRef } from '../schema.ts';

/**
 * Files in the agent: an upload in two calls around the client's own upload to S3, a PDF made
 * searchable in the background, and the files of deleted chats removed every few minutes.
 */

const FILES: SymbolRef = 'backend/services/agent/src/files/file-routes.ts#fileRouter';
const STORE: SymbolRef = 'backend/services/agent/src/files/file-store.ts#createS3FileStore';
const INDEX: SymbolRef = 'backend/services/agent/src/rag/indexer.ts#indexPdf';
const QDRANT: SymbolRef = 'backend/services/agent/src/rag/vector-store.ts#createQdrantStore';
const CLEANUP: SymbolRef = 'backend/services/agent/src/rag/cleanup.ts#cleanUpDeletedChats';
const CLEANUP_TIMER: SymbolRef = 'backend/services/agent/src/rag/cleanup.ts#startFileCleanup';

// ---------------------------------------------------------------------------------------------
// Upload a file

const uploadFile: Flow = {
  id: 'upload-file',
  title: 'Upload a file',
  category: 'api',
  apps: ['gateway', 'agent', 'chat'],
  summary:
    "An upload, in two calls to the agent around the client's own upload to S3. Start checks the type, the size and the chat, records the file as pending under a key made from IDs only, and returns a signed form for that one key, type and size range. The client posts the file straight to S3. Complete then checks what actually arrived: that it is there, its type and size, its first bytes, and a PDF's page count. A file that fails is deleted and marked failed; a PDF that passes is queued for indexing (see Index an uploaded PDF). Uploads are off (503) unless the agent has all four S3 settings. file-routes.test.ts and file-checks.test.ts run every check against an in-memory bucket; a live upload needs a bucket the agent's key can use.",
  status: 'partial',
  steps: [
    {
      id: 'start-call',
      title: 'Start an upload',
      kind: 'trigger',
      status: 'verified',
      what: 'A signed-in client posts what it is about to upload to POST /api/files/uploads: the chat, the file name, its type and its size. The Next.js server and the gateway forward it to the agent (target /files/uploads, Origin checked, session required), with a token that names the user.',
      why: 'The agent decides where the file goes before any bytes move.',
      input:
        'POST /api/files/uploads, { "chatId": "...", "name": "trip.pdf", "mime": "application/pdf", "sizeBytes": 48213 }',
    },
    {
      id: 'start-checks',
      title: 'Check the type and the size',
      kind: 'handler',
      status: 'verified',
      symbol: FILES,
      highlight: 'if (!isUploadType(body.mime)) {',
      what: "The body is strict. The type must be one of UPLOAD_TYPES: a PDF (up to 20 MB) or a PNG, JPEG or WebP image (up to 10 MB each). Another type is a 415 'Upload a PDF, or a PNG, JPEG or WebP image'; a bigger file is a 413 that names the limit. Without S3 settings the route answers 503 'File uploads are not set up on this server'.",
      why: 'A claimed type and size are only a first filter, but they let the agent refuse early and fix the limits in the signed form.',
      next: [
        { to: 'own-chat', kind: 'next' },
        { to: 'refused', kind: 'error', label: '415, 413 or 503' },
      ],
    },
    {
      id: 'own-chat',
      title: "The chat must be the user's",
      kind: 'external',
      status: 'verified',
      symbol: FILES,
      highlight: 'await deps.chat.getChat(userId, body.chatId);',
      what: "The agent asks chat for the chat with its own key, for this user. Someone else's chat, a deleted one or a wrong ID is chat's 404, passed on unchanged.",
      why: 'A file belongs to a chat, and goes when that chat is deleted.',
      next: [
        { to: 'record', kind: 'next' },
        { to: 'refused', kind: 'error', label: "404: not the user's chat" },
      ],
    },
    {
      id: 'record',
      title: 'Record the file, keyed by IDs only',
      kind: 'datastore',
      status: 'verified',
      symbol: FILES,
      highlight: "s3Key: storageKey(userId, 'upload', id.toString()),",
      what: "A File record gets a new ID, the user and chat, kind upload, a purpose from the type (pdf or image), status pending, and a display name cleaned by displayName: no folders or control characters, at most 120 characters, and the type's own extension. Its key is users/<user ID>/uploads/<file ID>, built by storageKey from IDs only.",
      why: 'A file name can never choose or change where a file is stored, so names like ../other-user cannot reach anything (SEC-07).',
      sideEffects: ['Creates a file record in MongoDB (gilder_agent).'],
    },
    {
      id: 'form',
      title: 'Sign a form for this key, type and size',
      kind: 'function',
      status: 'verified',
      symbol: STORE,
      highlight: "['content-length-range', 1, maxBytes],",
      what: "createPresignedPost signs an S3 upload form for exactly this key, with Content-Type fixed to the claimed type and a size from 1 byte to the type's limit, valid for 5 minutes. The agent answers 201 with the file and the form's URL and fields.",
      why: 'S3 itself enforces the size and type the agent agreed to; a plain signed PUT link could not limit the size.',
      output:
        '201 { "file": { "id": "...", "status": "pending", "name": "trip.pdf", ... }, "upload": { "url": "https://...", "fields": { ... } } }',
    },
    {
      id: 's3-upload',
      title: 'The client posts the file to S3',
      kind: 'external',
      status: 'inferred',
      what: "The client posts the form fields and the file to the form's URL. S3 refuses a file outside the size range or with another Content-Type. The bytes never pass through the gateway or the agent. This part happens outside the app's code and has been tested only against an in-memory bucket; a live run needs a bucket the agent's key can use.",
      why: 'Large files go straight to storage instead of through every server on the way.',
    },
    {
      id: 'complete-call',
      title: "Complete: find the owner's pending file",
      kind: 'handler',
      status: 'verified',
      symbol: FILES,
      highlight:
        'const file = await findOwnedFile(userId, (req.params as z.output<typeof fileParams>).fileId);',
      what: "The client posts POST /api/files/<file ID>/complete, which the gateway forwards to the agent. findOwnedFile reads the file only for its owner: someone else's, a missing one or a generated file is a 404 'No such file'. A file already ready is returned as it is; one already refused is a 409 'This upload was refused; upload the file again'.",
      why: 'Only the owner can complete an upload, and completing twice is harmless.',
      next: [
        { to: 'head', kind: 'next' },
        { to: 'refused', kind: 'error', label: '404 or 409' },
      ],
    },
    {
      id: 'head',
      title: 'Has the upload arrived?',
      kind: 'datastore',
      status: 'verified',
      symbol: FILES,
      highlight: 'const stored = await files.head(file.s3Key);',
      what: "A HEAD request on the key gives the stored size and type. Nothing there yet is a 409 'The upload hasn't arrived yet', and the client can try again.",
      why: 'The agent checks what S3 holds, not what the client says it sent.',
      next: [
        { to: 'sniff', kind: 'next' },
        { to: 'refused', kind: 'error', label: '409: not there yet' },
      ],
    },
    {
      id: 'sniff',
      title: 'Check the type, the size and the first bytes',
      kind: 'function',
      status: 'verified',
      symbol: FILES,
      highlight: 'if (!matchesSignature(mime, await files.read(file.s3Key, 16))) {',
      what: 'The stored type must be the announced one and the size within its limit. Then the first 16 bytes must start the way that type always does (matchesSignature): %PDF- for a PDF, the PNG signature, FF D8 FF for a JPEG, RIFF…WEBP for a WebP.',
      why: 'A renamed file cannot pass as a PDF or an image, whatever its name or claimed type (SEC-07).',
      next: [
        { to: 'pages', kind: 'next' },
        { to: 'refuse', kind: 'error', label: 'not what it claims' },
      ],
    },
    {
      id: 'pages',
      title: 'A PDF: count its pages',
      kind: 'function',
      status: 'verified',
      symbol: FILES,
      highlight: 'pages = await countPdfPages(await files.read(file.s3Key));',
      what: 'For a PDF, countPdfPages opens the whole file with unpdf and reads its page count. A PDF that cannot be read, or has more than 200 pages (MAX_PDF_PAGES), is refused. Images skip the page count.',
      why: 'A broken or huge PDF is stopped before anything tries to index it.',
      next: [
        { to: 'ready', kind: 'next' },
        { to: 'refuse', kind: 'error', label: 'unreadable, or over 200 pages' },
      ],
    },
    {
      id: 'ready',
      title: 'Mark the file ready',
      kind: 'datastore',
      status: 'verified',
      symbol: FILES,
      highlight: "file.status = 'ready';",
      what: 'The file gets the stored size, the page count for a PDF, and status ready. For a PDF the agent also creates a Document record with status indexing. The agent answers with the file.',
      why: 'From here the file can be read and downloaded; a PDF also waits for its indexing.',
      sideEffects: ['Updates the file, and creates a document for a PDF, in MongoDB.'],
      output: '200 { "file": { "id": "...", "status": "ready", "pageCount": 3, ... } }',
    },
    {
      id: 'queue-index',
      title: 'A PDF: start indexing in the background',
      kind: 'function',
      status: 'verified',
      symbol: FILES,
      highlight: 'deps.onPdfReady?.(file);',
      what: 'onPdfReady starts indexPdf without waiting for it, so the answer does not wait for the indexing. GET /api/files/<file ID> then reports the file with its indexing status (indexing, ready or failed), and GET /api/files/<file ID>/url gives the owner a fresh download link, valid for 5 minutes, for a ready file.',
      why: 'Indexing can take a while; links are made on request, so nothing stores a link that expires.',
      next: [],
    },
    {
      id: 'refuse',
      title: 'Refuse the file and delete it',
      kind: 'error',
      status: 'verified',
      symbol: FILES,
      highlight: 'await files.remove([file.s3Key]).catch(() => undefined);',
      what: "The object is deleted from storage, the file is marked failed, and the answer is a 415 with the reason, such as 'That is not a PDF file' or 'That PDF has 250 pages; the limit is 200'.",
      why: 'Nothing that failed a check stays in the bucket.',
      sideEffects: ['Deletes the object, and marks the file failed in MongoDB.'],
      next: [],
    },
    {
      id: 'refused',
      title: 'Refused before anything is stored',
      kind: 'error',
      status: 'verified',
      symbol: 'backend/shared/src/errors.ts#errorHandler',
      what: 'The error becomes problem+json with its status (413, 415, 404, 409 or 503) and the request ID. Nothing new is stored.',
      why: 'The client learns why, in the same error shape as every other route.',
      next: [],
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// Index an uploaded PDF

const indexPdfFlow: Flow = {
  id: 'index-pdf',
  title: 'Index an uploaded PDF',
  category: 'lifecycle',
  apps: ['agent'],
  summary:
    "How a PDF becomes searchable, in the background once its upload completes. The agent reads the file, extracts its text page by page with unpdf, cuts it into overlapping pieces of about 1,000 characters that each keep their page, embeds them (Gemini's embedding model in live mode, a stand-in in mock mode) and stores them in Qdrant, labelled with the owner, document, chat and page. The document is then marked ready, or failed with the reason. Every search filters by owner and document. indexer.test.ts runs it with a real PDF, the stand-in embedder and an in-memory store; a live check with real Gemini embeddings and a local Qdrant ranked the right page first. Answering questions from indexed PDFs is not built yet.",
  status: 'verified',
  steps: [
    {
      id: 'start',
      title: 'A PDF upload completes',
      kind: 'trigger',
      status: 'verified',
      symbol: 'backend/services/agent/src/index.ts#app',
      highlight: 'void indexPdf(file, { store: fileStore, embedder, vectors, logger });',
      what: "The agent's onPdfReady, set up in index.ts, calls indexPdf without waiting, with the file store, the embedder and the vector store picked at startup: Gemini embeddings when LLM_MODE is live and GEMINI_API_KEY is set (otherwise mockEmbedder), and Qdrant when QDRANT_URL is set (otherwise an in-memory store).",
      why: 'The upload answers at once; indexing runs on its own.',
    },
    {
      id: 'document',
      title: "Find the PDF's document",
      kind: 'datastore',
      status: 'verified',
      symbol: INDEX,
      highlight: 'const document = await DocumentModel.findOne({ fileId: file._id });',
      what: 'The document created when the upload completed holds the indexing status. Without one there is nothing to do.',
      why: 'The status lives on the document, so the file details can report it.',
    },
    {
      id: 'extract',
      title: 'Read the text, page by page',
      kind: 'function',
      status: 'verified',
      symbol: 'backend/services/agent/src/rag/indexer.ts#extractPages',
      highlight: 'const { text } = await extractText(pdf, { mergePages: false });',
      what: 'The whole file is read from storage, and unpdf extracts its text as one string per page.',
      why: 'Keeping pages apart lets every piece say which page it came from.',
      next: [
        { to: 'chunk', kind: 'next' },
        { to: 'failed', kind: 'error', label: 'the file cannot be read' },
      ],
    },
    {
      id: 'chunk',
      title: 'Cut the text into overlapping pieces',
      kind: 'function',
      status: 'verified',
      symbol: 'backend/services/agent/src/rag/chunks.ts#chunkPages',
      highlight: 'start = Math.max(end - overlap, start + 1);',
      what: "chunkPages collapses whitespace and cuts each page into pieces of up to 1,000 characters (CHUNK_CHARS), ending on a space when one is in the second half, and starts each next piece 200 characters (CHUNK_OVERLAP) before the last one ended. Every piece keeps its page number. A PDF with no text at all, such as scanned images, fails with 'This PDF has no text to read (it may be scanned images)'.",
      why: 'Small pieces make search precise; the overlap keeps a sentence cut at one piece whole in the next.',
      next: [
        { to: 'embed', kind: 'next' },
        { to: 'failed', kind: 'error', label: 'no text' },
      ],
    },
    {
      id: 'embed',
      title: 'Embed the pieces',
      kind: 'external',
      status: 'verified',
      symbol: 'backend/services/agent/src/rag/embeddings.ts#createGeminiEmbedder',
      highlight: "taskType: task === 'document' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY',",
      what: "In live mode, Gemini's gemini-embedding-001 turns the pieces into 768-number vectors, 100 per batchEmbedContents call, embedded as documents, with a 30-second limit per call. A failure becomes a 503 AppError, which marks the document failed. In mock mode, mockEmbedder makes a vector from the words' hashes instead, so the same text always gives the same vector.",
      why: 'Vectors let a question find the pieces that mean the same thing, not only the same words. Questions are embedded with the query task.',
      next: [
        { to: 'collection', kind: 'next' },
        { to: 'failed', kind: 'error', label: 'the embedding call failed' },
      ],
    },
    {
      id: 'collection',
      title: 'Make sure the collection exists',
      kind: 'datastore',
      status: 'verified',
      symbol: QDRANT,
      highlight:
        "await call('PUT', '', { vectors: { size: EMBEDDING_DIMENSIONS, distance: 'Cosine' } });",
      what: "ensureReady looks for the document_chunks collection over Qdrant's REST API. The first time, it creates it (768 dimensions, cosine distance) with keyword indexes on userId, documentId and chatId.",
      why: 'Indexed owner and document fields keep the filtered searches fast.',
      next: [
        { to: 'upsert', kind: 'next' },
        { to: 'failed', kind: 'error', label: 'Qdrant unreachable or refusing' },
      ],
    },
    {
      id: 'upsert',
      title: 'Store the pieces with their labels',
      kind: 'datastore',
      status: 'verified',
      symbol: QDRANT,
      highlight: "await call('PUT', '/points?wait=true', {",
      what: 'The pieces go into Qdrant 256 at a time, each with a random ID, its vector, and the owner, document, chat, page and text. Every search later filters on the owner and the document IDs.',
      why: "One user's documents can never answer another user's question.",
      sideEffects: ['Writes points to Qdrant (or the in-memory store).'],
      next: [
        { to: 'ready', kind: 'next' },
        { to: 'failed', kind: 'error', label: 'the write failed' },
      ],
    },
    {
      id: 'ready',
      title: 'Mark the document ready',
      kind: 'datastore',
      status: 'verified',
      symbol: INDEX,
      highlight: "document.status = 'ready';",
      what: "The document is saved as ready, and the agent logs 'PDF indexed' with the number of pieces.",
      why: 'GET /api/files/<file ID> now reports indexing: ready.',
      sideEffects: ['Updates the document in MongoDB; logs an info line.'],
      next: [],
    },
    {
      id: 'failed',
      title: 'Mark the document failed, with the reason',
      kind: 'error',
      status: 'verified',
      symbol: INDEX,
      highlight: "document.status = 'failed';",
      what: "Any failure is caught: the document is saved as failed with the first 300 characters of the reason, and the agent logs 'PDF indexing failed' at warn. The file itself stays ready.",
      why: 'A failed index is reported, never left looking as if it were still running.',
      sideEffects: ['Updates the document in MongoDB; logs a warn line.'],
      next: [],
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// Clean up the files of deleted chats

const chatFileCleanup: Flow = {
  id: 'chat-file-cleanup',
  title: 'Clean up the files of deleted chats',
  category: 'lifecycle',
  apps: ['agent', 'chat'],
  summary:
    "Files belong to their chat. Every ten minutes the agent lists the chats its files belong to, per user, and asks chat which of them are gone for that user. For those chats it removes the indexed pieces from the vector store, the objects from storage, and the document and file records. Chat never calls the agent: deleting a chat stays one quick update, and the agent catches up on its own schedule. cleanup.test.ts runs it with an in-memory bucket and vector store and two users, and internal-routes.test.ts covers chat's side.",
  status: 'verified',
  steps: [
    {
      id: 'timer',
      title: 'Every ten minutes',
      kind: 'trigger',
      status: 'verified',
      symbol: CLEANUP_TIMER,
      highlight: 'const timer = setInterval(() => {',
      what: 'startFileCleanup, started at startup, runs cleanUpDeletedChats every ten minutes, and skips a turn while the last run is still going. The timer does not keep the process alive, and shutdown stops it.',
      why: 'Clean-up can lag a little behind a delete; it never runs twice at once.',
    },
    {
      id: 'owners',
      title: "List each user's chats that have files",
      kind: 'datastore',
      status: 'verified',
      symbol: CLEANUP,
      highlight: "{ $group: { _id: '$userId', chatIds: { $addToSet: '$chatId' } } },",
      what: 'One aggregation over the file records groups the chat IDs by user.',
      why: 'Chat answers per user, so the question is asked per user.',
    },
    {
      id: 'ask-chat',
      title: 'Ask chat which chats are gone',
      kind: 'external',
      status: 'verified',
      symbol: 'backend/services/agent/src/services.ts#chatService',
      highlight: "'/internal/chats/deleted',",
      what: "For each user, up to 200 chat IDs at a time, deletedChats posts { ids } to chat's POST /internal/chats/deleted with the agent's own key for that user, with one retry allowed.",
      why: 'Chat owns the truth about which chats exist; the agent does not keep a copy.',
      next: [
        { to: 'chat-answers', kind: 'next' },
        { to: 'failed', kind: 'error', label: 'chat unreachable' },
      ],
    },
    {
      id: 'chat-answers',
      title: 'Chat: name the chats that are gone',
      kind: 'handler',
      status: 'verified',
      symbol: 'backend/services/chat/src/internal-routes.ts#internalRouter',
      highlight:
        "router.post('/internal/chats/deleted', validate({ body: deletedBody }), async (req, res) => {",
      what: "Only the agent's key may call it, for a user. Chat looks up which of the IDs are this user's chats and not deleted, and answers { deleted } with every other ID: deleted, missing, someone else's, or not an ID at all.",
      why: "Treating someone else's chat as gone means a file can never outlive its owner's chat.",
      output: '200 { "deleted": ["..."] }',
      next: [
        { to: 'remove-vectors', kind: 'branch', label: 'some chats are gone' },
        { to: 'log', kind: 'branch', label: 'none are gone' },
      ],
    },
    {
      id: 'remove-vectors',
      title: 'Remove the indexed pieces',
      kind: 'datastore',
      status: 'verified',
      symbol: CLEANUP,
      highlight: 'await deps.vectors.removeDocuments({',
      what: 'The documents of those chats are found, and their pieces deleted from the vector store with the same owner and document filter that searches use.',
      why: "A deleted chat's PDFs must not be searchable any more.",
      sideEffects: ['Deletes points from Qdrant (or the in-memory store).'],
    },
    {
      id: 'remove-files',
      title: 'Remove the files and their records',
      kind: 'datastore',
      status: 'verified',
      symbol: CLEANUP,
      highlight: 'await deps.store?.remove(files.map((file) => file.s3Key));',
      what: 'The objects of those chats are deleted from storage in one call (when uploads are set up), then the document and file records.',
      why: 'Nothing of a deleted chat is left behind.',
      sideEffects: ['Deletes objects from storage, and documents and files from MongoDB.'],
    },
    {
      id: 'log',
      title: 'Log what was removed',
      kind: 'function',
      status: 'verified',
      symbol: CLEANUP_TIMER,
      highlight: "deps.logger.info({ removed }, 'removed the files of deleted chats');",
      what: "When anything was removed, the agent logs 'removed the files of deleted chats' with the count.",
      why: 'A quiet run writes nothing.',
      next: [],
    },
    {
      id: 'failed',
      title: 'A failed run: log it and try again later',
      kind: 'error',
      status: 'verified',
      symbol: CLEANUP_TIMER,
      highlight: "'file clean-up failed; it runs again shortly'",
      what: "Any error stops this run and is logged at error as 'file clean-up failed; it runs again shortly'. The next run starts over.",
      why: 'Clean-up is safe to repeat, so a failed run just waits for the next one.',
      next: [],
    },
  ],
};

export const fileFlows: Flow[] = [uploadFile, indexPdfFlow, chatFileCleanup];
