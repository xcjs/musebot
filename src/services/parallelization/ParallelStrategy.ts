import { ApiResourceType } from './ApiResourceType.js';
import { IParallelizationStrategy } from './IParallelizationStrategy.js';

export class ParallelStrategy implements IParallelizationStrategy {
    constructor() {

    }

    getTaskChannel(resourceType: ApiResourceType, resourceUrl: URL | null): string {
        const parts: string[] = [];

        if (resourceType === ApiResourceType.Chat
            || resourceType === ApiResourceType.Media) {
                resourceType = ApiResourceType.GenerativeAI
        }

        parts.push(resourceType);

        if(resourceUrl !== null) {
            parts.push(resourceUrl.toString());
        }

        return parts.join('_');
    }
}
