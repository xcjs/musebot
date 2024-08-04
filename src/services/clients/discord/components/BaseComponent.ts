import { FeatureService } from '../../../features/FeatureService.js';

export abstract class BaseComponent<ComponentType> {
    protected featureService: FeatureService;

    constructor(featureService: FeatureService) {
        this.featureService = featureService;
    }

    build(): ComponentType {
        throw 'The build() implementation must be overridden.';
    }
}
