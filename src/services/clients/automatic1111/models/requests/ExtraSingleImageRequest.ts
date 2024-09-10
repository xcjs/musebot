import { Upscaler } from '../../enums/Upscaler.js';

export interface ExtraSingleImageRequest {
    resize_mode: number;
    show_extras_results: boolean;
    gfpgan_visibility: number;
    codeformer_visibility: number;
    codeformer_weight: number;
    upscaling_resize: number,
    upscaling_resize_w: number,
    upscaling_resize_h: number,
    upscaling_crop: boolean;
    upscaler_1: Upscaler;
    upscaler_2: Upscaler;
    extras_upscaler_2_visibility: number;
    upscale_first: boolean;
    image: Buffer;
}
