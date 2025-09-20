import { ContentType } from '../../enums/ContentType.js';
import { ContentTypeCategory } from '../../enums/ContentTypeCategory.js';

export interface IContentTypeService {
    getContentTypeFromFileName(fileName: string): ContentType;
    getContentTypeCategoryFromContentType(contentType: ContentType): ContentTypeCategory;
}
