import { Txt2ImgOptionsRequest } from '../requests/Txt2ImgOptionsRequest';

export interface Txt2ImgOptionsResponse {
    images: Array<string>,
    parameters: Txt2ImgOptionsRequest,
    info: string
}
