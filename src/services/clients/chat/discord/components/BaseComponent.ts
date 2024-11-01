import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';

export abstract class BaseComponent<ComponentType> {
    protected featureService: IFeatureService;

    get label(): string {
        return '';
    }

    constructor(services: IServiceContainer) {
        this.featureService = services.featureService;
    }

    build(): ComponentType {
        throw 'The build() implementation must be overridden.';
    }
}
