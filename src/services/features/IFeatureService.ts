import { SupportedFeature } from 'services/features/enum/SupportedFeature';

export interface IFeatureService {
    supportedFeatures: Array<SupportedFeature>;
    hasFeature(feature: SupportedFeature): boolean;
}
