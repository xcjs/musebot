import { IServiceContainer } from '../IServiceContainer.js';
import { IParallelizationStrategy } from './IParallelizationStrategy.js';
import { ResourceType } from './ResourceType.js';

export class SerialStrategy implements IParallelizationStrategy {
    readonly #includeHostname: boolean;

    constructor(services: IServiceContainer) {
        this.#includeHostname = services.environmentSettings.taskQueueForceSerialAcrossHosts;
    }

    getTaskChannel(resourceType: ResourceType, resourceUrl: URL | null = null): string {
        const parts: string[] = [];

        if (resourceType === ResourceType.LargeLanguageModel
            || resourceType === ResourceType.Media) {
            resourceType = ResourceType.GenerativeAI
        }

        parts.push(resourceType);

        if (this.#includeHostname && resourceUrl !== null) {
            parts.push(resourceUrl.hostname);
        }

        return parts.join('_');
    }
}
