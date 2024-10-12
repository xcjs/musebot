import { IServiceContainer } from 'services/IServiceContainer.js';
import { IFeatureService } from 'services/features/IFeatureService';

export abstract class BaseComponent<ComponentType> {
    protected featureService: IFeatureService;

    constructor(services: IServiceContainer) {
        this.featureService = services.featureService;
    }

    build(): ComponentType {
        throw 'The build() implementation must be overridden.';
    }
}
