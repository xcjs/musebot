import { Txt2ImgOptions } from '@lancercomet/sd-api';

export type SerializableRenderRequest = {
    request: Txt2ImgOptions,
    modelName: string
}
