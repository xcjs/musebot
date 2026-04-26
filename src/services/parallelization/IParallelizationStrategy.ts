import { ResourceType } from './ResourceType.js';

export interface IParallelizationStrategy {
    getTaskChannel(resourceType: ResourceType, isChild: boolean, resourceUrl: URL | null): string;
}
