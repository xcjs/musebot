import { Txt2ImgOptions } from '@lancercomet/sd-api';

export interface ISerializableRenderRequest {
    request: Txt2ImgOptions,
    modelName: string
}
