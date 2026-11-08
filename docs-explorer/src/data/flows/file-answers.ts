import type { Flow, FlowStep, SymbolRef } from '../schema.ts';

/**
 * Answers that use files: a question about an attached PDF or image, and an answer that makes a
 * file (a PDF document, a slide deck or an image). All of them run in the same turn as any other
 * message; these flows follow what is different. Also here: the end-to-end test run in CI.
 */

const CHAT_THREAD: SymbolRef = 'frontend/src/components/chat/chat-thread.tsx#ChatThread';
const THREAD: SymbolRef = 'frontend/src/hooks/use-chat-thread.ts#useChatThread';
const RUN: SymbolRef = 'backend/services/agent/src/turns.ts#runTurn';
const RESOLVE: SymbolRef = 'backend/services/agent/src/turns.ts#resolveAttachments';
const STREAM: SymbolRef = 'backend/services/agent/src/turns.ts#streamAnswer';
const ROUTE: SymbolRef = 'backend/services/agent/src/routing.ts#routeMessage';
const PDF_QA: SymbolRef = 'backend/services/agent/src/agents/pdf-qa.ts#createPdfQaAgent';
const IMAGE_QA: SymbolRef = 'backend/services/agent/src/agents/image-qa.ts#createImageQaAgent';
const SAVE: SymbolRef = 'backend/services/agent/src/files/generated.ts#saveGenerated';
const MESSAGE: SymbolRef = 'frontend/src/components/chat/message-item.tsx#MessageItem';
const GATEWAY_APP: SymbolRef = 'backend/gateway/src/app.ts#createApp';

const APPS = ['frontend', 'gateway', 'agent', 'chat', 'billing'];

// ---------------------------------------------------------------------------------------------
// Shared steps

function sendWithFiles(): FlowStep {
  return {
    id: 'send',
    title: 'Send the message with its files',
    kind: 'function',
    status: 'verified',
    symbol: CHAT_THREAD,
    highlight: 'const accepted = await thread.send(content, agent, undefined, ids);',
    what: "Send is off until every attached file is ready (the composer's attachmentsReady). Then the thread sends the text with the IDs of the ready files; streamTurn posts { content, clientMessageId, attachments } to /api/chats/<chat ID>/messages, and the user's message shows at once with a chip per file. The chips clear once the message is taken.",
    why: 'The agent gets file IDs only, never file contents or links, and only files that finished uploading.',
    input:
      'POST /api/chats/<chat ID>/messages, { "content": "...", "clientMessageId": "...", "attachments": ["<file ID>"] }',
  };
}

function gatewayToAgent(): FlowStep {
  return {
    id: 'gateway',
    title: 'Next.js server and gateway: forward to the agent',
    kind: 'middleware',
    status: 'verified',
    symbol: GATEWAY_APP,
    highlight: 'const matched = matchRoute(req.method, req.path);',
    what: "The /api route forwards the request to the gateway, which checks the rate limits, the route table (POST /api/chats/:id/messages, service agent), the Origin and the session, and forwards it to the agent's POST /chats/<id>/turns with a token that names the user. The answer streams back the same way.",
    why: 'Answers with files take the same path as every other message.',
  };
}

function bodyCheck(): FlowStep {
  return {
    id: 'body',
    title: 'Agent: check the body',
    kind: 'handler',
    status: 'verified',
    symbol: 'backend/services/agent/src/turns.ts#turnBody',
    highlight: 'attachments: z.array(id).max(4).optional(),',
    what: "The strict body may carry up to 4 file IDs in attachments, each 1 to 64 letters, digits, - or _. The turn then runs as usual: the chat must be the user's, a second copy of the same request is a 409, and a user with no credits at all gets 402 before anything else.",
    why: 'The IDs are only a claim at this point; the next check decides whether they may be used.',
    next: [
      { to: 'resolve', kind: 'next' },
      { to: 'refused', kind: 'error', label: 'a bad body, 404, 409 or 402' },
    ],
  };
}

function resolve(what: string): FlowStep {
  return {
    id: 'resolve',
    title: 'Check every attached file before charging',
    kind: 'datastore',
    status: 'verified',
    symbol: RESOLVE,
    highlight:
      "if (files.length !== unique.length || files.some((file) => file.status !== 'ready')) {",
    what,
    why: 'A file from another chat or another user, or one that is not uploaded yet, never reaches an agent, and the user is not charged for a message that cannot be answered.',
    next: [
      { to: 'route', kind: 'next' },
      { to: 'refused', kind: 'error', label: '404 or 409' },
    ],
  };
}

function refused(): FlowStep {
  return {
    id: 'refused',
    title: 'In the browser: put the thread back and say why',
    kind: 'error',
    status: 'verified',
    symbol: THREAD,
    highlight: 'setMessages(before);',
    what: "A refusal before the stream is problem+json with its status, such as 404 'An attached file is missing or not uploaded yet' or 409 'Still reading your PDF; try again in a moment'. Nothing was saved or charged; the thread goes back as it was and a toast shows the message.",
    why: 'The user can wait for the file, or attach it again, and send once more.',
    next: [],
  };
}

// ---------------------------------------------------------------------------------------------
// A question about a PDF

const pdfQuestion: Flow = {
  id: 'pdf-question',
  title: 'Ask about a PDF',
  category: 'api',
  apps: APPS,
  summary:
    "A question answered from the chat's PDFs, with the pages cited. The user attaches a PDF (see Upload a file); the thread waits until it has been read (see Index an uploaded PDF), then sends the question with the file's ID. The agent checks the attachment before charging, routes the message to the PDF question agent, embeds the question, searches only the user's own documents for the five closest passages, sends them as citations and streams an answer that cites pages as [p. N]. A follow-up in the same chat needs no new upload: the router may pick PDF questions whenever the chat has a ready PDF. qa.test.ts covers the agent, turns.test.ts the turn with real chat and billing apps, and chat-thread.test.tsx the browser.",
  status: 'verified',
  steps: [
    {
      id: 'attach',
      title: 'Attach a PDF and wait while it is read',
      kind: 'trigger',
      status: 'verified',
      symbol: CHAT_THREAD,
      highlight: 'const state = await pdfReadingState(uploaded.id);',
      what: "The paperclip opens a file picker for PDFs and PNG, JPEG or WebP images. uploadProblem refuses another type or a file over its limit before anything is sent. uploadFile then makes the upload in three hops (start, the post to storage, complete), and the chip shows 'Uploading…'. For a PDF it then shows 'Reading…' while the thread asks GET /api/files/<file ID> every 2 seconds, for up to 3 minutes, until the PDF is ready or failed.",
      why: 'A question can only be answered once the PDF has been read; the chip shows why Send is waiting.',
    },
    sendWithFiles(),
    gatewayToAgent(),
    bodyCheck(),
    resolve(
      "resolveAttachments reads the files by ID, owner and chat. Every one must be found and ready, or it is a 404 'An attached file is missing or not uploaded yet'. A PDF's document must be ready too: a failed one is a 409 'An attached PDF could not be read; upload it again', and one still being read a 409 'Still reading your PDF; try again in a moment'. runTurn also notes whether the chat has any ready PDF.",
    ),
    {
      id: 'route',
      title: 'An attached PDF picks the PDF question agent',
      kind: 'function',
      status: 'verified',
      symbol: ROUTE,
      highlight: "if (input.attachmentKinds?.includes('pdf')) {",
      what: 'Unless the user chose an agent, an attached PDF routes the message to pdf_qa (reason attachment). With no attachment, the router model is offered pdf_qa as a choice only when the chat already has a ready PDF, so a follow-up question finds the same documents; a pdf_qa reply in a chat without one becomes chat.',
      why: 'Follow-ups work without uploading again, and a chat with no documents can never be sent to an agent that has nothing to read.',
    },
    {
      id: 'hold',
      title: 'Hold 10 credits and save the message with its files',
      kind: 'datastore',
      status: 'verified',
      symbol: RUN,
      highlight: 'attachments: plan.attachmentIds,',
      what: "The per-agent limit for pdf_qa applies (5 a minute), then 10 credits are held. The user's message is saved in chat with its attachments, by ID, and an empty answer is saved. A regenerate later reuses the original message's attachments.",
      why: 'The thread can show the files on the message when the chat is opened again.',
      sideEffects: ['Holds credits in billing and saves two messages in chat.'],
    },
    {
      id: 'documents',
      title: 'Find the documents to search',
      kind: 'datastore',
      status: 'verified',
      symbol: 'backend/services/agent/src/files/documents.ts#readyDocuments',
      highlight: '...(attached.length > 0 ? { fileId: { $in: attached } } : {}),',
      what: "readyDocuments reads the user's ready documents in this chat: only the attached PDFs when there are any, or every ready PDF of the chat for a follow-up. None at all is a 409 'There is no readable PDF in this chat yet', which arrives as an error event, since the stream has started.",
      why: 'The question is answered from the documents the user means, and never from another chat or another user.',
    },
    {
      id: 'embed',
      title: 'Embed the question',
      kind: 'external',
      status: 'verified',
      symbol: PDF_QA,
      highlight:
        "const [question] = await tools.embedder.embed([context.text], 'query', context.signal);",
      what: "The question is embedded with the query task: Gemini's embedding model in live mode with GEMINI_API_KEY, the stand-in otherwise.",
      why: 'The question and the pieces are embedded for their roles, which makes the closest pieces the most relevant ones.',
    },
    {
      id: 'search',
      title: "Search only the user's documents",
      kind: 'datastore',
      status: 'verified',
      symbol: PDF_QA,
      highlight:
        '{ userId: context.userId, documentIds: documents.map((document) => document.id) },',
      what: 'The vector store returns the 5 closest pieces, filtered by the owner and these document IDs. A live check with real Gemini embeddings and a local Qdrant ranked the right page first.',
      why: "The owner filter is part of every query, so one user's documents can never answer another user's question.",
    },
    {
      id: 'citations',
      title: 'Send the passages as citations',
      kind: 'response',
      status: 'verified',
      symbol: STREAM,
      highlight: "stream.send('citations', { items: event.items });",
      what: 'The agent yields one citation per passage (document ID, file name, page and the first 240 characters), and streamAnswer sends them as a citations event before the answer.',
      why: 'The reader sees where the answer comes from while it is still being written.',
      output:
        'event: citations, { "items": [{ "documentId": "...", "name": "trip.pdf", "page": 2, "quote": "..." }] }',
    },
    {
      id: 'answer',
      title: 'Write the answer from the passages',
      kind: 'external',
      status: 'verified',
      symbol: PDF_QA,
      highlight: "{ role: 'system', content: PDF_QA_SYSTEM_PROMPT },",
      what: "The write route streams the answer. The system prompt says to answer only from the passages, cite each fact as [p. N] and say when the document does not cover it. The passages go inside <passages> tags, each labelled with its file and page, as untrusted text never to be obeyed, after the chat's recent messages.",
      why: 'A PDF can contain instructions; fenced off as data, they cannot steer the answer.',
    },
    {
      id: 'save',
      title: 'Save the answer with its citations and charge it',
      kind: 'datastore',
      status: 'verified',
      symbol: STREAM,
      highlight: '...(citations ? { citations } : {}),',
      what: 'The finished answer is saved in chat with its citations, the credits are committed, and usage and done follow, as for any answer.',
      why: 'Reopening the chat shows the same pages under the answer.',
      sideEffects: ['Fills in the answer in chat and commits the credits in billing.'],
    },
    {
      id: 'show',
      title: 'In the browser: the pages under the answer',
      kind: 'response',
      status: 'verified',
      symbol: 'frontend/src/components/chat/message-item.tsx#Citations',
      highlight:
        '<h3 className="mb-1.5 text-xs font-medium text-fg-subtle">From your documents</h3>',
      what: "useChatThread stores the citations on the answer as they arrive. Under the answer, 'From your documents' lists each file name and page, with the quoted passage on hover; the user's message shows a chip per attached file, which opens a fresh download link.",
      why: 'The reader can check each page the answer cites.',
      next: [],
    },
    refused(),
  ],
};

// ---------------------------------------------------------------------------------------------
// A question about an image

const imageQuestion: Flow = {
  id: 'image-question',
  title: 'Ask about an image',
  category: 'api',
  apps: APPS,
  summary:
    "A question about an attached image, answered by a model that can see it. An image is ready as soon as its upload completes, so it can be sent at once. The agent checks it like any attachment, routes the message to the image question agent, reads the image's bytes from storage and sends them to Gemini as a data URL, through the vision route with its fallbacks. A live check: real Gemini answered 'Red' for a generated red PNG. qa.test.ts covers the agent with a scripted model.",
  status: 'verified',
  steps: [
    {
      id: 'attach',
      title: 'Attach an image',
      kind: 'trigger',
      status: 'verified',
      symbol: CHAT_THREAD,
      highlight: 'const uploaded = await uploadFile(file, chatId);',
      what: 'The paperclip picks a PNG, JPEG or WebP image of up to 10 MB. uploadFile starts the upload, posts the file to storage and completes it; the image is ready at once, with nothing to read first, so Send is enabled again.',
      why: 'Images need no indexing; the model looks at them when asked.',
    },
    sendWithFiles(),
    gatewayToAgent(),
    bodyCheck(),
    resolve(
      "resolveAttachments reads the files by ID, owner and chat. Every one must be found and ready, or it is a 404 'An attached file is missing or not uploaded yet'.",
    ),
    {
      id: 'route',
      title: 'An attached image picks the image question agent',
      kind: 'function',
      status: 'verified',
      symbol: ROUTE,
      highlight: "if (input.attachmentKinds?.includes('image')) {",
      what: 'Unless the user chose an agent, an attached image routes the message to image_qa (reason attachment); an attached PDF would win over it. The router model never picks image questions on its own. The agent then holds 10 credits and saves the message with its attachment.',
      why: 'There is nothing to look at without an attached image.',
    },
    {
      id: 'read-image',
      title: "Read the image's bytes",
      kind: 'datastore',
      status: 'verified',
      symbol: 'backend/services/agent/src/index.ts#agents',
      highlight: 'return fileStore.read(file.s3Key);',
      what: "The agent takes the latest attached image (none is a 400 'Attach an image to ask about it' in the stream) and reads it from storage through the file it was given at startup. Image questions run only when the agent has storage, and in live mode a Gemini key.",
      why: 'The bytes go to the model directly, so no link to the file ever leaves the server.',
    },
    {
      id: 'vision',
      title: 'Ask a model that can see',
      kind: 'external',
      status: 'verified',
      symbol: IMAGE_QA,
      highlight: "image_url: { url: `data:${image.mime};base64,${bytes.toString('base64')}` },",
      what: 'The question and the image go in one user message: a text part and an image_url part holding a data URL. The system prompt says to describe only what can be seen and to treat any text in the image as data. The vision route tries gemini-3.5-flash, then gemini-3.8-flash, then gemini-flash-latest, each with low reasoning, moving on only if one fails before its first token. Mock mode answers from the mock provider.',
      why: 'Text inside an image cannot give the model orders, and a retired or busy model does not stop image questions.',
    },
    {
      id: 'stream',
      title: 'Stream, save and charge the answer',
      kind: 'response',
      status: 'verified',
      symbol: STREAM,
      highlight: "stream.send('token', { text: event.text });",
      what: 'Each piece of text goes out as a token event; the finished answer is saved, the credits committed, and usage and done sent, as for any answer.',
      why: 'The answer arrives as it is written.',
      next: [],
    },
    refused(),
  ],
};

// ---------------------------------------------------------------------------------------------
// Make a file

const generateFile: Flow = {
  id: 'generate-file',
  title: 'Make a PDF, a deck or an image',
  category: 'api',
  apps: APPS,
  summary:
    "An answer that makes a file. /pdf, /slides or /image (or the agent menu, or the router) sends the message to the PDF, slides or image agent, which holds 10 credits. The model writes a checked outline, or an image prompt; the file is drawn with pdfkit, pptxgenjs or Pollinations; it is saved under the user's generated files, and the stream reports progress in three parts and then the file with a fresh 5-minute link. The answer keeps the file's ID, never the link. In mock mode the outline is canned and the image is a one-colour PNG, so files are made with no AI keys. These agents run only when the agent has storage. Live checks: real Groq wrote a document outline and the PDF was drawn in about 1.5 seconds, and Pollinations returned a 1024×1024 JPEG in about 10 seconds; saving to S3 has been tested only against an in-memory bucket, and a live run needs a bucket the agent's key can use. generate.test.ts, render.test.ts, turns.test.ts and chat-thread.test.tsx cover it.",
  status: 'verified',
  steps: [
    {
      id: 'ask',
      title: 'Ask for a file',
      kind: 'trigger',
      status: 'verified',
      symbol: 'frontend/src/components/chat/composer.tsx#Composer',
      highlight: 'const canSend =',
      what: "The user types /pdf, /slides or /image, picks PDF, Slides or Image in the agent menu, or just asks; the router may pick these agents too. The message is sent like any other and forwarded by the gateway to the agent's turn route.",
      why: 'Making a file is one more kind of answer, in the same thread.',
    },
    {
      id: 'hold',
      title: 'Route, hold 10 credits and save the messages',
      kind: 'function',
      status: 'verified',
      symbol: RUN,
      highlight: 'const route: Route =',
      what: "The turn's usual checks run, the message is routed to pdf, slides or image (a shortcut or chip wins), that agent's limit applies (5 a minute), 10 credits are held, and the user's message and an empty answer are saved.",
      why: 'Making a file costs more than a chat answer, and the hold makes sure the user can pay for it before any work starts.',
    },
    {
      id: 'progress',
      title: 'Report the first part',
      kind: 'response',
      status: 'verified',
      symbol: STREAM,
      highlight:
        "stream.send('progress', { step: event.step, current: event.current, total: event.total });",
      what: "The agent yields progress 1 of 3 ('Writing the document', 'Writing the slides' or 'Writing the prompt'), and streamAnswer sends it as a progress event. Parts 2 and 3 follow the same way. In the browser a bar under the answer shows the step and how far it has got, and goes once the answer is done.",
      why: 'Making a file takes seconds; the bar shows that work is going on.',
      output: 'event: progress, { "step": "Writing the document", "current": 1, "total": 3 }',
    },
    {
      id: 'outline',
      title: 'The model writes an outline',
      kind: 'external',
      status: 'verified',
      symbol: 'backend/services/agent/src/agents/generate.ts#outline',
      highlight: 'const { value, result } = await completeJson(',
      what: "In live mode, the write route is asked for a JSON outline (up to 4,000 tokens), with the chat's recent messages and the request: a document's title, summary and sections, a deck's title, subtitle and slides, or an image's prompt and short title. completeJson checks it against its schema and asks once for a repair; the model and token use are reported for the charge. In mock mode a canned outline is used instead and no model is called.",
      why: 'The model only ever supplies text in a known shape, which the agent then lays out itself.',
      next: [
        { to: 'checked', kind: 'next' },
        { to: 'failed', kind: 'error', label: 'still not valid after one repair' },
      ],
    },
    {
      id: 'checked',
      title: 'Only text in a known shape',
      kind: 'function',
      status: 'verified',
      symbol: 'backend/services/agent/src/generate/outlines.ts#documentOutline',
      highlight: 'paragraphs: z.array(z.string().trim().max(2_000)).max(8).default([]),',
      what: 'The schemas cap everything: a document has 1 to 12 sections of up to 8 paragraphs and 12 bullets, a deck 1 to 15 slides of up to 7 bullets, and an image prompt 3 to 600 characters. Every string is trimmed and limited in length.',
      why: 'No markup, script or link from the model can end up in a file, and a runaway reply cannot make a huge one.',
      next: [
        { to: 'render-pdf', kind: 'branch', label: 'a PDF' },
        { to: 'render-slides', kind: 'branch', label: 'a deck' },
        { to: 'draw-image', kind: 'branch', label: 'an image' },
      ],
    },
    {
      id: 'render-pdf',
      title: 'Draw the PDF',
      kind: 'function',
      status: 'verified',
      symbol: 'backend/services/agent/src/generate/render.ts#renderPdf',
      highlight: 'const doc = new PDFDocument({',
      what: "renderPdf draws an A4 PDF with pdfkit: the title, the summary in grey, then each section's heading, paragraphs and bullets in Helvetica. The answer's text, 'Here is your PDF', streams before it.",
      why: 'A plain, readable layout made from checked text.',
      next: [{ to: 'save', kind: 'next' }],
    },
    {
      id: 'render-slides',
      title: 'Draw the deck',
      kind: 'function',
      status: 'verified',
      symbol: 'backend/services/agent/src/generate/render.ts#renderSlides',
      highlight: 'const pres = new PptxGenJS();',
      what: 'renderSlides makes a 16:9 PowerPoint file with pptxgenjs: a title slide, then one slide per point with its title, bullets and speaker notes.',
      why: 'A deck the user can open and edit in any presentation app.',
      next: [{ to: 'save', kind: 'next' }],
    },
    {
      id: 'draw-image',
      title: 'Draw the image',
      kind: 'external',
      status: 'verified',
      symbol: 'backend/services/agent/src/generate/images.ts#pollinationsImage',
      highlight: 'const timeout = AbortSignal.timeout(90_000);',
      what: 'In live mode the prompt goes to Pollinations, which needs no key, for a 1024×1024 image, with a 90-second limit. Anything but a JPEG or PNG, or a file over 8 MB, is a 503. In mock mode mockImage makes a small one-colour PNG from the prompt.',
      why: 'Image generation without an account or key; the rest of the flow is the same in mock mode.',
      next: [
        { to: 'save', kind: 'next' },
        { to: 'failed', kind: 'error', label: 'no answer, or not an image' },
      ],
    },
    {
      id: 'save',
      title: "Save it under the user's generated files",
      kind: 'datastore',
      status: 'verified',
      symbol: SAVE,
      highlight: "const key = storageKey(input.userId, 'generated', id.toString());",
      what: 'The file is stored at users/<user ID>/generated/<file ID>, and a File record is made with kind generated, the purpose (pdf, slides or image), a name made from the title (fileNameFrom: plain words and hyphens) and status ready.',
      why: 'Generated files live with the user and the chat, under keys made from IDs only, and go with the chat when it is deleted.',
      sideEffects: ['Writes the file to storage and a file record to MongoDB.'],
    },
    {
      id: 'link',
      title: 'Announce the file with a fresh link',
      kind: 'response',
      status: 'verified',
      symbol: STREAM,
      highlight: "stream.send('file', event.file);",
      what: 'saveGenerated signs a 5-minute download link, and the agent yields the file (ID, kind, name, link and when it expires); streamAnswer sends it as a file event and keeps the ID.',
      why: 'The browser can show or download the file at once.',
      output:
        'event: file, { "fileId": "...", "kind": "pdf", "name": "packing-list.pdf", "url": "https://...", "expiresAt": "..." }',
    },
    {
      id: 'settle',
      title: "Save the file's ID on the answer and charge it",
      kind: 'datastore',
      status: 'verified',
      symbol: STREAM,
      highlight: '...(fileRefs.length > 0 ? { fileRefs } : {}),',
      what: 'The finished answer is saved in chat with fileRefs, the IDs of the files it made, never their links; then the 10 credits are committed, and usage and done are sent.',
      why: 'An old chat never holds a link that has expired: the file is found again by its ID.',
      sideEffects: ['Fills in the answer in chat and commits the credits in billing.'],
    },
    {
      id: 'show',
      title: 'In the browser: the image, or a download card',
      kind: 'response',
      status: 'verified',
      symbol: MESSAGE,
      highlight:
        '{message.generated?.length ? <GeneratedFiles fileIds={message.generated} /> : null}',
      what: "useChatThread adds each announced file's ID to the answer. GeneratedFiles reads each file's details (getFile): an image asks for its own fresh link and shows itself with a Download button; a PDF or deck shows a card whose Download opens a fresh link. The same happens when an old chat is opened, from fileRefs.",
      why: 'Links are made when they are needed, so they always work.',
      next: [],
    },
    {
      id: 'failed',
      title: 'Nothing made: the answer fails',
      kind: 'error',
      status: 'verified',
      symbol: 'backend/services/agent/src/turns.ts#settleUnfinished',
      what: 'An outline that stays invalid, or an image service that fails, ends the answer with an error event. The answer is saved as failed and the held credits are released.',
      why: 'The user pays only for a file that was made.',
      next: [],
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// The end-to-end tests in CI

const e2eRun: Flow = {
  id: 'e2e-run',
  title: 'End-to-end tests in CI',
  category: 'lifecycle',
  apps: ['frontend', 'gateway', 'auth', 'chat', 'agent', 'billing'],
  summary:
    "The e2e job in GitHub Actions runs the whole app as a person uses it. It starts the data stores, writes fresh settings in mock mode with dev sign-in on and a raised per-IP limit, builds and starts the web app and the five backend apps, waits for each to answer, then runs Playwright on a desktop and a phone screen: a set of behaviour tests and axe accessibility checks on the main pages. A failed run keeps its report, traces and logs for a week. The tests check behaviour, not wording, so they also pass against live providers: locally all 9 passed. The run found a real problem: every server render counted against the Next.js server's one per-IP limit at the gateway, fixed by passing the visitor's address on.",
  status: 'verified',
  steps: [
    {
      id: 'start',
      title: 'A push or a pull request',
      kind: 'trigger',
      status: 'verified',
      what: "The e2e job ('End-to-end tests (mock mode)') runs beside the quality job on every push to main and every pull request, with a 25-minute limit. It installs the workspace with the frozen lockfile and starts MongoDB (a replica set, for the credit transactions), Redis and Qdrant with docker compose up -d, then polls their health checks every 2 seconds for up to 2 minutes, printing the container logs if one never becomes healthy.",
      why: 'The same data stores as in development, so the app runs as it does on a laptop. The job waits for the health checks itself because docker compose up --wait gave up on MongoDB while it was still starting on the runner.',
    },
    {
      id: 'configure',
      title: 'Fresh settings: mock mode, dev sign-in, a raised IP limit',
      kind: 'function',
      status: 'verified',
      what: "pnpm setup:env and pnpm setup:keys write new env files and keys. AUTH_DEV_LOGIN is turned on, and RATE_LIMIT_PER_IP=10000 is added for the gateway, because every test request comes from one machine. The agent's example settings run in mock mode, with no AI keys and no S3, so the file agents are off in this run.",
      why: 'No secrets are needed, and canned answers make the run free and repeatable.',
    },
    {
      id: 'gateway-limits',
      title: 'The gateway reads its limits',
      kind: 'function',
      status: 'verified',
      symbol: 'backend/gateway/src/index.ts#app',
      highlight: 'rateLimits: { perIp: env.RATE_LIMIT_PER_IP, perUser: env.RATE_LIMIT_PER_USER },',
      what: 'RATE_LIMIT_PER_IP and RATE_LIMIT_PER_USER (whole numbers from 1 to 100,000, by default 120 and 60) go to createApp, which passes them to ipRateLimit and userRateLimit.',
      why: 'The limits stay strict everywhere else, and a test run that all comes from one address can still make its requests.',
    },
    {
      id: 'boot',
      title: 'Build, start and wait for every app',
      kind: 'function',
      status: 'verified',
      what: 'The frontend is built (next build) and started (next start); the gateway and the four services start with node --env-file=.env src/index.ts, each writing a log file. The job polls /healthz on ports 8000 to 8004 and /login on port 3000, up to a minute each, and prints the logs if one never answers.',
      why: 'The tests run against a production build, the way people would use it.',
    },
    {
      id: 'playwright',
      title: 'Run Playwright on a desktop and a phone',
      kind: 'function',
      status: 'verified',
      what: 'Playwright 1.57 installs Chromium and runs the tests one at a time, with one retry in CI: the desktop project (Desktop Chrome) runs everything not tagged @phone, and the phone project (Pixel 7) runs the @phone tests. Locally it uses the installed Chrome against http://localhost:3000, or E2E_BASE_URL.',
      why: 'Both screen sizes the app is designed for are checked.',
    },
    {
      id: 'sign-in',
      title: 'Each test signs in a fresh user',
      kind: 'handler',
      status: 'verified',
      symbol: 'backend/services/auth/src/session-routes.ts#sessionRouter',
      highlight:
        "router.post('/sessions/dev', validate({ body: devSignInBody }), async (req, res) => {",
      what: "The signIn helper posts a new e2e-… email to /api/auth/dev-session with the app's Origin, as a browser would, so every test starts with its own account and 100 sign-up credits. ask types a message, waits for a new answer and for Regenerate to come back.",
      why: 'Tests never share an account or depend on each other.',
    },
    {
      id: 'server-renders',
      title: 'Server renders count per visitor',
      kind: 'function',
      status: 'verified',
      symbol: 'frontend/src/server/gateway-fetch.ts#gatewayGet',
      highlight: "...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),",
      what: "Server components call the gateway directly, and now pass on the visitor's x-forwarded-for. Before, every server render counted against the Next.js server's own address at the gateway, so a busy run hit the per-IP limit.",
      why: "The per-IP limit is meant for each visitor, not for the app's own server.",
    },
    {
      id: 'behaviour',
      title: 'Behaviour tests',
      kind: 'function',
      status: 'verified',
      what: 'app.spec.ts checks that a visitor is sent to sign-in; that a first message starts a chat, streams an answer and names the chat; that Regenerate replaces the latest answer; that /search lists its sources; that an answer is charged and shows on the usage and billing pages; that sign-out ends the session; and, on a phone, that the chat list opens from the menu.',
      why: 'They check what a person sees and can do, not exact wording, so canned and live answers both pass.',
    },
    {
      id: 'axe',
      title: 'Accessibility checks with axe',
      kind: 'function',
      status: 'verified',
      symbol: 'frontend/src/app/(app)/layout.tsx#AppLayout',
      highlight: 'tabIndex={0}',
      what: 'a11y.spec.ts runs axe on the sign-in, new chat, chat, billing and usage pages, at both sizes, with the WCAG 2.0 A and AA and 2.1 AA rules. Any serious or critical problem fails the test, naming the rule and the elements. The first runs led to two fixes: the scroll anchor of the message list moved out of the list, and <main> became focusable, with a focus ring, so keyboard users can scroll it.',
      why: 'Accessibility problems fail CI like any other bug.',
    },
    {
      id: 'report',
      title: 'Keep the report when a run fails',
      kind: 'response',
      status: 'verified',
      what: "On failure the job uploads the Playwright HTML report, the test results (with traces of failed tests) and the apps' logs as the e2e-report artifact, kept for 7 days.",
      why: 'A failure in CI can be looked into without running it again.',
      next: [],
    },
  ],
};

export const fileAnswerFlows: Flow[] = [pdfQuestion, imageQuestion, generateFile, e2eRun];
