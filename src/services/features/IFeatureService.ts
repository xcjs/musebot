import { SupportedFeature } from './enum/SupportedFeature.js';

export interface IFeatureService {
    supportedFeatures: Array<SupportedFeature>;
    hasFeature(feature: SupportedFeature): boolean;
}
