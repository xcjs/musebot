import { IServiceContainer } from '../../../IServiceContainer.js';
import { FeatureService } from '../../../features/FeatureService.js';

export abstract class BaseComponent<ComponentType> {
    protected featureService: FeatureService;

    constructor(services: IServiceContainer) {
        this.featureService = services.featureService;
    }

    build(): ComponentType {
        throw 'The build() implementation must be overridden.';
    }
}
