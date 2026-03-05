import { beforeEach, describe, expect, it } from '@jest/globals';

import { ContentType } from '../../enums/ContentType.js';
import { ContentTypeCategory } from '../../enums/ContentTypeCategory.js';
import { ContentTypeService } from './ContentTypeService.js';

describe('ContentTypeService', () => {
    let service: ContentTypeService;

    beforeEach(() => {
        service = new ContentTypeService();
    });

    describe('getContentTypeFromFileName()', () => {
        it('should return Jpeg for .jpeg extension', () => {
            expect(service.getContentTypeFromFileName('image.jpeg')).toBe(ContentType.Jpeg);
        });

        it('should return Jpeg for .JPEG extension (case insensitive)', () => {
            expect(service.getContentTypeFromFileName('image.JPEG')).toBe(ContentType.Jpeg);
        });

        it('should return Jpg for .jpg extension', () => {
            expect(service.getContentTypeFromFileName('image.jpg')).toBe(ContentType.Jpg);
        });

        it('should return Png for .png extension', () => {
            expect(service.getContentTypeFromFileName('image.png')).toBe(ContentType.Png);
        });

        it('should return WebP for .webp extension', () => {
            expect(service.getContentTypeFromFileName('image.webp')).toBe(ContentType.WebP);
        });

        it('should return Json for .json extension', () => {
            expect(service.getContentTypeFromFileName('data.json')).toBe(ContentType.Json);
        });

        it('should return Mp3 for .mp3 extension', () => {
            expect(service.getContentTypeFromFileName('audio.mp3')).toBe(ContentType.Mp3);
        });

        it('should return Mp4 for .mp4 extension', () => {
            expect(service.getContentTypeFromFileName('video.mp4')).toBe(ContentType.Mp4);
        });

        it('should return Unknown for unknown extension', () => {
            expect(service.getContentTypeFromFileName('file.xyz')).toBe(ContentType.Unknown);
        });

        it('should return Unknown for file with no extension', () => {
            expect(service.getContentTypeFromFileName('filename')).toBe(ContentType.Unknown);
        });

        it('should return Unknown for empty string', () => {
            expect(service.getContentTypeFromFileName('')).toBe(ContentType.Unknown);
        });

        it('should handle multiple dots in filename', () => {
            expect(service.getContentTypeFromFileName('my.image.file.png')).toBe(ContentType.Png);
        });

        it('should handle file starting with dot', () => {
            expect(service.getContentTypeFromFileName('.json')).toBe(ContentType.Json);
        });

        it('should handle mixed case extension', () => {
            expect(service.getContentTypeFromFileName('image.JpG')).toBe(ContentType.Jpg);
        });

        it('should handle file ending with dot', () => {
            expect(service.getContentTypeFromFileName('file.')).toBe(ContentType.Unknown);
        });
    });

    describe('getContentTypeCategoryFromContentType()', () => {
        it('should return Image category for jpeg content type', () => {
            expect(service.getContentTypeCategoryFromContentType(ContentType.Jpeg)).toBe(ContentTypeCategory.Image);
        });

        it('should return Image category for png content type', () => {
            expect(service.getContentTypeCategoryFromContentType(ContentType.Png)).toBe(ContentTypeCategory.Image);
        });

        it('should return Image category for webp content type', () => {
            expect(service.getContentTypeCategoryFromContentType(ContentType.WebP)).toBe(ContentTypeCategory.Image);
        });

        it('should return Image category for jpg content type', () => {
            expect(service.getContentTypeCategoryFromContentType(ContentType.Jpg)).toBe(ContentTypeCategory.Image);
        });

        it('should return Audio category for mp3 content type', () => {
            expect(service.getContentTypeCategoryFromContentType(ContentType.Mp3)).toBe(ContentTypeCategory.Audio);
        });

        it('should return Video category for mp4 content type', () => {
            expect(service.getContentTypeCategoryFromContentType(ContentType.Mp4)).toBe(ContentTypeCategory.Video);
        });

        it('should return Application category for json content type', () => {
            expect(service.getContentTypeCategoryFromContentType(ContentType.Json)).toBe(ContentTypeCategory.Application);
        });

        it('should return Application category for unknown content type', () => {
            expect(service.getContentTypeCategoryFromContentType(ContentType.Unknown)).toBe(ContentTypeCategory.Application);
        });

        it('should return Unknown for null', () => {
            expect(service.getContentTypeCategoryFromContentType(null as unknown as ContentType)).toBe(ContentTypeCategory.Unknown);
        });

        it('should return Unknown for empty string', () => {
            expect(service.getContentTypeCategoryFromContentType('' as ContentType)).toBe(ContentTypeCategory.Unknown);
        });

        it('should return Unknown for content type without slash', () => {
            expect(service.getContentTypeCategoryFromContentType('invalid' as ContentType)).toBe(ContentTypeCategory.Unknown);
        });

        it('should handle custom content types', () => {
            expect(service.getContentTypeCategoryFromContentType('text/plain' as ContentType)).toBe('text');
        });
    });
});
