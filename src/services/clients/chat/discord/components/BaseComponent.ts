import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IServiceContainer } from '../../../../IServiceContainer.js';

export abstract class BaseComponent<ComponentType> {
    protected featureService: IFeatureService;

    get label(): string {
        return '';
    }

    get isSupported(): boolean {
        return false;
    }

    get title(): string {
        return '';
    }

    get helpText(): string {
        return '';
    }

    constructor(services: IServiceContainer) {
        this.featureService = services.featureService;
    }

    abstract build(): ComponentType;

    abstract buildAsync(): Promise<ComponentType>;
}
