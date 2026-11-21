import net from 'node:net';

import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { BotMode } from '../../../enums/BotMode.js';
import { NodeEnvironment } from '../../../enums/NodeEnvironment.js';
import { TaskQueueStrategy } from '../../../enums/TaskQueueStrategy.js';
import type { IConfigurationService } from '../../environment-settings/IConfigurationService.js';
import type { IBotServiceContainer } from '../../IBotServiceContainer.js';
import type { ILogger } from '../../ILogger.js';
import { LlmHostFlavor } from './enums/LlmHostFlavor.js';
import { LlmModality } from './enums/LlmModality.js';
import { LlmClient } from './LlmClient.js';
import { LlmMessage } from './models/LlmMessage.js';

// Regression test for nodejs/undici#5360: an SSE- streamed response whose
// consumer stalls (Musebot paces streaming edits for Discord) while the peer
// fills the undici fetch body queue to its high-water mark and then closes the
// connection used to crash with an uncaught AssertionError
// (`assert(!this.paused)` in undici's client-h1 Parser.finish(), raised from
// the socket 'end' event). The crash was uncatchable and killed the process.
// The undici dependency (8.x) removes the assertion; if a regression ever
// reappears, the uncaught AssertionError aborts the Jest worker, which fails
// this test file.

const CHUNK_CONTENT = 'undici-5360-fixed';
const HWM_MINUS_ONE = 16383; // one byte below the default 16 KiB high-water mark

function createMockLogger(): jest.Mocked<ILogger> {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  };
}

function createMockConfigurationService(port: number): IConfigurationService {
  return {
    packageName: 'musebot',
    version: '10.0.0',
    nodeEnvironment: NodeEnvironment.Test,
    botId: 'bot-1',
    botFunction: BotMode.Chat,
    discordToken: 'token',
    discordChannels: [],
    discordChannelsDisallowed: [],
    botRequiresMention: false,
    botResponseRate: 100,
    botPrivateMessageUsers: [],
    errorMessage: 'error',
    maxTaskAttempts: 3,
    taskRetryDelayMilliseconds: 100,
    taskQueueStrategy: TaskQueueStrategy.Serial,
    taskQueueForceSerialAcrossHosts: false,
    comfyUiHosts: [],
    comfyUiTimeoutMinutes: 30,
    comfyUiGuidanceScaleInterval: 0.5,
    randomPrompts: [],
    llmHosts: [{ url: new URL(`http://127.0.0.1:${port}/v1`), token: null, isLocal: false }],
    llmModels: ['test-model'],
    llmModelConfigs: [{ name: 'test-model', inputModalities: [LlmModality.Text], outputModalities: [LlmModality.Text] }],
    llmSystemPrompt: '',
    llmStreamsResponse: true,
    llmTimeoutMinutes: 0,
    llmEmbeddingModel: 'embed-model',
    llmTopK: 5,
    llmContextWindow: null,
    llmContextCompressionThreshold: 0.75,
    llmEmbeddingInputLimit: 2000,
    applicationName: 'Musebot',
    isProduction: false,
  };
}

function createMockServices(configurationService: IConfigurationService, logger: jest.Mocked<ILogger>): IBotServiceContainer {
  return {
    configurationService,
    featureService: null as never,
    taskQueue: null as never,
    typingService: null as never,
    discordClient: null as never,
    generativeChatClient: null as never,
    helpService: null as never,
    workflowService: null as never,
    webContentService: null as never,
    parallelizationStrategy: null as never,
    llmHostFlavorRegistry: {
      resolve: jest.fn((): { flavor: LlmHostFlavor; isLocal: boolean } => ({ flavor: LlmHostFlavor.Ollama, isLocal: false }))
    } as never,
    getLogger: jest.fn(() => logger),
    getTaskChannelPostProcessor: () => null as never,
    getContextMessageFactory: () => null as never,
    getContextService: () => null as never,
    getContextCompressionService: () => null as never,
    getLlmGenerateTask: () => null as never,
    getLlmGenerateStructuredTask: () => null as never,
    getEmojiReactionTask: () => null as never,
    getEmbedTask: () => null as never,
    getMessageTask: () => null as never,
    getInteractionTask: () => null as never,
    getAttachmentTask: () => null as never,
    getCustomInteractionTask: () => null as never,
    getWorkflowMutator: () => null as never,
    getReplyService: () => null as never,
    contentTypeService: null as never,
    comfyUiClient: null as never,
    comfyUiReplyService: null as never,
    llmClient: null as never,
  } as unknown as IBotServiceContainer;
}

// One SSE data frame padded with comment bytes so that the first socket write
// lands exactly one byte below the body queue's high-water mark. The second
// write pushes the queue past the mark while (thanks to the consumer stall
// below) nobody is reading - undici pauses the socket at a read boundary.
// The FIN that follows is then the crashing condition.
function buildBodyParts(): { partA: Buffer; partB: Buffer } {
  const frame = Buffer.from(`data: {"choices":[{"delta":{"content":"${CHUNK_CONTENT}"}}]}\n\n`);
  // Padding sliced from an oversized buffer so partA is EXACTLY hwm - 1 bytes.
  const partA = Buffer.concat([
    frame,
    Buffer.from(`:${'x'.repeat(20000)}`, 'utf8').subarray(0, HWM_MINUS_ONE - frame.length)
  ]);

  return { partA, partB: Buffer.from('b') };
}

let server: net.Server;
let port: number;

describe('LlmClient streaming', (): void => {
  beforeAll(async (): Promise<void> => {
    const { partA, partB } = buildBodyParts();

    server = net.createServer((socket): void => {
      socket.setNoDelay(true);

      socket.once('data', (): void => {
        socket.write(
          'HTTP/1.1 200 OK\r\n' +
          'Content-Type: text/event-stream\r\n' +
          `Content-Length: ${partA.length + partB.length}\r\n` +
          'Connection: close\r\n' +
          '\r\n'
        );
        socket.write(partA);
        setTimeout((): void => {
          socket.write(partB); // overflows the queue -> PAUSED
          socket.end();        // FIN while paused and the read buffer is drained
        }, 50);
      });

      socket.on('error', (): void => {});
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as net.AddressInfo).port;
  });

  afterAll(async (): Promise<void> => {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));

    // Allow lingering sockets from the Connection: close exchanges to drain.
    server.unref();
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach((): void => {
    jest.restoreAllMocks();
  });

  it('drains a stalled stream whose peer closes mid-body without crashing (undici#5360)', async (): Promise<void> => {
    const logger = createMockLogger();
    const client = new LlmClient(createMockServices(createMockConfigurationService(port), logger));

    const { exchange } = await client.sendMessageAndGetStream('hello', [] as LlmMessage[]);

    // The consumer stall LlmMessageTask.#processAsStream produces while
    // preparing and pacing the Discord streaming reply. The peer has by now
    // filled the body queue to its high-water mark and closed the connection.
    await new Promise((resolve) => setTimeout(resolve, 300));

    const contents: string[] = [];

    for await (const chunk of exchange.response) {
      contents.push(chunk.content);
    }

    expect(contents).toContain(CHUNK_CONTENT);
  }, 15000);
});
