import { lookup } from 'node:dns/promises';

import { ILogger } from '../../ILogger.js';
import { LlmHostFlavor } from './enums/LlmHostFlavor.js';
import { ILlmHost } from './models/ILlmHost.js';

interface IHostClassification {
  flavor: LlmHostFlavor;
  isLocal: boolean;
}

export class LlmHostFlavorRegistry {
  readonly #logger: ILogger;
  readonly #classifications = new Map<string, IHostClassification>();

  constructor(logger: ILogger) {
    this.#logger = logger;
  }

  async probeHost(host: ILlmHost, probeTimeoutMs: number = 2000): Promise<void> {
    const flavor = await this.#probeFlavor(host, probeTimeoutMs);
    const isLocal = await this.#resolveIsLocal(host);
    this.#classifications.set(host.url.toString(), { flavor, isLocal });
    this.#logger.info(`LLM host ${host.url} classified as '${flavor}' (isLocal: ${isLocal}).`);
  }

  resolve(host: ILlmHost): IHostClassification {
    const cached = this.#classifications.get(host.url.toString());

    if (cached !== undefined) {
      return cached;
    }

    // Unprobed: flavor unknown (generic), but an explicit isLocal flag still governs.
    if (host.isLocal !== null) {
      return { flavor: LlmHostFlavor.Generic, isLocal: host.isLocal };
    }

    // Conservative default: assume local until probed.
    return { flavor: LlmHostFlavor.Generic, isLocal: true };
  }

  clear(): void {
    this.#classifications.clear();
  }

  async #probeFlavor(host: ILlmHost, probeTimeoutMs: number): Promise<LlmHostFlavor> {
    const probes: Array<{ path: string, flavor: LlmHostFlavor }> = [
      { path: '/api/ps', flavor: LlmHostFlavor.Ollama },
      { path: '/models', flavor: LlmHostFlavor.LlamaCppRouter },
      { path: '/props', flavor: LlmHostFlavor.LlamaCppSingle }
    ];

    for (const probe of probes) {
      try {
        const headers: Record<string, string> = {};
        if (host.token !== null) {
          headers['Authorization'] = `Bearer ${host.token}`;
        }

        const response = await fetch(new URL(probe.path, host.url), {
          headers,
          signal: AbortSignal.timeout(probeTimeoutMs)
        });

        if (response.ok) {
          return probe.flavor;
        }
      } catch {
        // Continue to next probe.
      }
    }

    return LlmHostFlavor.Generic;
  }

  async #resolveIsLocal(host: ILlmHost): Promise<boolean> {
    if (host.isLocal !== null) {
      return host.isLocal;
    }

    const hostname = host.url.hostname;

    if (hostname === 'localhost' || hostname.startsWith('127.') || hostname === '::1') {
      return true;
    }

    try {
      const result = await lookup(hostname);
      return this.#isPrivateAddress(result.address);
    } catch {
      // Unresolvable → conservatively local.
      return true;
    }
  }

  #isPrivateAddress(address: string): boolean {
    if (address.includes(':')) {
      // IPv6 ULA fc00::/7 or link-local fe80::/10
      const lower = address.toLowerCase();
      return lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
    }

    const octets = address.split('.').map(Number);

    if (octets.length !== 4 || octets.some(o => !Number.isInteger(o) || o < 0 || o > 255)) {
      return false;
    }

    return octets[0] === 10
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168)
      || (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127)   // Tailscale CGNAT
      || (octets[0] === 169 && octets[1] === 254);                     // link-local
  }
}