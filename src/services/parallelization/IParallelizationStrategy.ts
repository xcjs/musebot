import { ResourceType } from './ResourceType.js';

export interface IParallelizationStrategy {
    getTaskChannel(resourceType: ResourceType, resourceUrl: URL | null): string;
}
