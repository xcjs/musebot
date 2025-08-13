import { ContentType } from '../../enums/ContentType.js';
import { ContentTypeCategory } from '../../enums/ContentTypeCategory.js';
import { IContentTypeService } from './IContentTypeService.js';

export class ContentTypeService implements IContentTypeService {
    constructor() {}

    getContentTypeFromFileName(fileName: string): ContentType {
        let matchingContentType = ContentType.Unknown;

        if(!fileName.includes('.')) {
            return matchingContentType;
        }

        const extension = fileName.split('.').pop();

        for(const key in ContentType) {
            if(key.toLowerCase() === extension.toLowerCase()) {
                 matchingContentType = ContentType[key] as ContentType;
            }
        }

        return matchingContentType;
    }

    getContentTypeCategoryFromContentType(contentType: ContentType): ContentTypeCategory {
        if (contentType === null
            || !contentType.includes('/')) {
            return ContentTypeCategory.Unknown;
        }

        const contentTypeCategory = contentType.split('/')[0] as ContentTypeCategory;

        return contentTypeCategory || ContentTypeCategory.Unknown;
    }
}
