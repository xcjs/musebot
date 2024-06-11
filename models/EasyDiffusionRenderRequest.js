import { getRandomInt } from '../utilities/random-utilities.js';

export class EasyDiffusionRenderRequest {
    prompt = '';
    seed = 0;
    used_random_seed = true;
    negative_prompt = '';
    num_outputs = 1;
    num_inference_steps = 35;
    guidance_scale = 7.5;
    width = 1024;
    height = 1024;
    vram_usage_level = 'balanced';
    sampler_name = 'euler_a';
    use_stable_diffusion_model = '';
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
    original_prompt = '';
    active_tags = [];
    inactive_tags = [];
    use_upscale = 'RealESRGAN_x4plus';
    upscale_amount = '4';
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
