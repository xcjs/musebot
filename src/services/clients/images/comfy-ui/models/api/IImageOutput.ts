import { ImageOutputType } from './enums/ImageOutputType.js';

export interface IImageOutput {
    filename: string;
    subfolder: string;
    type: ImageOutputType;
}
