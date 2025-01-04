import { getRandomInt } from '../../../../../../utilities/random-utilities.js';
import { maxSeed } from '../../../stable-diffusion/constants/constants.js';
import { VRamUsageLevel } from '../../enums/VRamUsageLevel.js';

export class RenderRequest {
    prompt = '';
    seed = 0;
    used_random_seed = true;
    negative_prompt = '';
    num_outputs = 1;
    num_inference_steps = 25;
    guidance_scale = 7.5;
    width = 1024; // Discord image previews are 676x676.
    height = 1024;
    vram_usage_level = VRamUsageLevel.Balanced;
    sampler_name = 'euler_a';
    use_stable_diffusion_model: string;
    clip_skip = false;
    use_vae_model = '';
    stream_progress_updates = true;
    stream_image_progress = false;
    show_only_filtered_image = true;
    block_nsfw = false;
    output_format = 'jpeg';
    output_quality = 75;
    output_lossless = false;
    metadata_output_format = false;
    original_prompt: string;
    active_tags = [];
    inactive_tags = [];
    enable_vae_tiling = true;
    session_id = 0;

    constructor(model: string, prompt: string) {
        this.use_stable_diffusion_model = model;
        this.prompt = prompt;
        this.original_prompt = prompt;
        this.session_id = Date.now();
        this.seed = this.#getRandomSeed();
    }

    toString(): string {
        return JSON.stringify(this);
    }

    refreshSeed(): void {
        this.seed = getRandomInt(0, maxSeed);
    }

    #getRandomSeed(): number {
        return
    }

    static fromJson(renderRequestJson: string): RenderRequest {
        const requestObj = JSON.parse(renderRequestJson) as RenderRequest;
        const request = new RenderRequest(requestObj.use_stable_diffusion_model, requestObj.prompt);

        return Object.assign(request, requestObj);
    }
}
