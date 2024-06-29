import { getRandomInt } from '../../../../../utilities/random-utilities.js';
import { VRamUsageLevel } from '../../enums/VRamUsageLevel.js';

export class RenderRequest {
    prompt: string = '';
    seed: number = 0;
    used_random_seed: boolean = true;
    negative_prompt: string = '';
    num_outputs: number = 1;
    num_inference_steps: number = 35;
    guidance_scale: number = 7.5;
    width: number = 1024; // The highest resolution allowed by Discord is 676x676.
    height: number = 1024;
    vram_usage_level: VRamUsageLevel = VRamUsageLevel.Balanced;
    sampler_name: string = 'euler_a';
    use_stable_diffusion_model: string = '';
    clip_skip: boolean = false;
    use_vae_model: string = '';
    stream_progress_updates: boolean = true;
    stream_image_progress: boolean = false;
    show_only_filtered_image: boolean = true;
    block_nsfw: boolean = false;
    output_format = 'jpeg';
    output_quality = 75;
    output_lossless = false;
    metadata_output_format = false;
    original_prompt = '';
    active_tags = [];
    inactive_tags = [];
    enable_vae_tiling = true;
    session_id = 0;

    constructor(model, prompt) {
        this.use_stable_diffusion_model = model;
        this.prompt = prompt;
        this.original_prompt = prompt;
        this.session_id = Date.now();
        this.seed = this.#getRandomSeed();
    }

    #getRandomSeed() {
        return getRandomInt(0, 4294967295);
    }
}
