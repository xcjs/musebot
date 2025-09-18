import { ApiResourceType } from './ApiResourceType.js';

export interface IParallelizationStrategy {
    getTaskChannel(resourceType: ApiResourceType, resourceUrl: URL | null): string;
}
