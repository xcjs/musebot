import { ContentTypeCategory } from './ContentTypeCategory.js';

export enum ContentType {
    Jpeg = `${ContentTypeCategory.Image}/jpeg`,
    Jpg = `${ContentTypeCategory.Image}/jpg`,
    Json = `${ContentTypeCategory.Application}}/json`,
    Mp3 = `${ContentTypeCategory.Audio}/mpeg`,
    Mp4 = `${ContentTypeCategory.Video}/mp4`,
    Png = `${ContentTypeCategory.Image}/png`,
    Unknown = `${ContentTypeCategory.Application}/octet-stream`,
    WebP = `${ContentTypeCategory.Image}/webp`
}
