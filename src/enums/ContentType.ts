import { ContentTypeCategory } from './ContentTypeCategory.js';

export enum ContentType {
    Jpeg = `${ContentTypeCategory.Image}/jpeg`,
    Jpg = `${ContentTypeCategory.Image}/jpg`,
    Json = `${ContentTypeCategory.Application}}/json`,
    Mp3 = `${ContentTypeCategory.Audio}/mpeg`,
    Png = `${ContentTypeCategory.Image}/png`,
    WebP = `${ContentTypeCategory.Image}/webp`
}
