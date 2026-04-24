import { IParallelizationStrategy } from './IParallelizationStrategy.js';
import { ResourceType } from './ResourceType.js';

export class ParallelStrategy implements IParallelizationStrategy {
    getTaskChannel(resourceType: ResourceType, resourceUrl: URL | null): string {
        const parts: string[] = [];
        parts.push(resourceType);

        if (resourceUrl !== null) {
            parts.push(resourceUrl.hostname);
        }

        return parts.join('_');
    }
}
