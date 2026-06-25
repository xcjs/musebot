import { IParallelizationStrategy } from './IParallelizationStrategy.js';
import { CHILD_TASK_CHANNEL_SUFFIX, ResourceType } from './ResourceType.js';

export class ParallelStrategy implements IParallelizationStrategy {

    getTaskChannel(resourceType: ResourceType, isChild: boolean, resourceUrl: URL | null): string {
        const parts: string[] = [];
        parts.push(resourceType);

        if(isChild) {
            parts.push(CHILD_TASK_CHANNEL_SUFFIX);
        }

        if (resourceUrl !== null) {
            parts.push(resourceUrl.hostname);
        }

        return parts.join('_');
    }
}
