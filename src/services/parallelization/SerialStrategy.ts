import { ResourceType } from './ResourceType.js';
import { IParallelizationStrategy } from './IParallelizationStrategy.js';

export class SerialStrategy implements IParallelizationStrategy {
    constructor() {

    }

    getTaskChannel(resourceType: ResourceType, resourceUrl: URL | null = null): string {
        const parts: string[] = [];

        if (resourceType === ResourceType.LargeLanguageModel
            || resourceType === ResourceType.Media) {
            resourceType = ResourceType.GenerativeAI
        }

        parts.push(resourceType);

        if (resourceUrl !== null) {
            parts.push(resourceUrl.toString());
        }

        return parts.join('_');
    }
}
