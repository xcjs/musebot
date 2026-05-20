import { IFeatureService } from '../../../../features/IFeatureService.js';
import { IBotServiceContainer } from "../../../../IServiceContainer.js"

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

    constructor(services: IBotServiceContainer) {
        this.featureService = services.featureService;
    }

    abstract build(): ComponentType;

    abstract buildAsync(): Promise<ComponentType>;
}
