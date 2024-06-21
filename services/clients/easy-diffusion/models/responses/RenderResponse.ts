export class RenderResponse {
    prompt: string;
    negative_prompt: string;
    seed: number;
    width: number;
    height: number;
    num_outputs: number;
    num_inference_steps: number;
    guidance_scale: number;
    control_alpha: boolean | null;
    prompt_strength: number;
    hypernetwork_strength: number;
    lora_alpha: number;
    tiling: boolean | null;
    preserve_init_image_color_profile: boolean = false;
    strict_mask_border: boolean = false;

    constructor() {

    }
}
