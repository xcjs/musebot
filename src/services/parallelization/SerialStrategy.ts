import { ApiResourceType } from './ApiResourceType.js';
import { IParallelizationStrategy } from './IParallelizationStrategy.js';

export class SerialStrategy implements IParallelizationStrategy {
    constructor() {

    }

    getTaskChannel(resourceType: ApiResourceType, resourceUrl: URL | null = null): string {
        const parts: string[] = [];

        if (resourceType === ApiResourceType.LargeLanguageModel
            || resourceType === ApiResourceType.Media) {
            resourceType = ApiResourceType.GenerativeAI
        }

        parts.push(resourceType);

        if (resourceUrl !== null) {
            parts.push(resourceUrl.toString());
        }

        return parts.join('_');
    }
}
