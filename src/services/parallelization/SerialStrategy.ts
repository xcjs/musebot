import { IParallelizationStrategy } from './IParallelizationStrategy.js';
import { ResourceType } from './ResourceType.js';

export class SerialStrategy implements IParallelizationStrategy {
    getTaskChannel(resourceType: ResourceType, resourceUrl: URL | null = null): string {
        const parts: string[] = [];

        if (resourceType === ResourceType.LargeLanguageModel
            || resourceType === ResourceType.Media) {
            resourceType = ResourceType.GenerativeAI
        }

        parts.push(resourceType);

        if (resourceUrl !== null) {
            parts.push(resourceUrl.hostname);
        }

        return parts.join('_');
    }
}
