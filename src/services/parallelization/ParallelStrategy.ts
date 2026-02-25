import { ResourceType } from './ResourceType.js';
import { IParallelizationStrategy } from './IParallelizationStrategy.js';

export class ParallelStrategy implements IParallelizationStrategy {
    constructor() {

    }

    getTaskChannel(resourceType: ResourceType, resourceUrl: URL | null): string {
        const parts: string[] = [];
        parts.push(resourceType);

        if (resourceUrl !== null) {
            parts.push(resourceUrl.toString());
        }

        return parts.join('_');
    }
}
