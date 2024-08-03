import { RenderRequest } from './RenderRequest';

export class UpscaledRenderRequest extends RenderRequest {
    use_upscale = 'RealESRGAN_x4plus';
    upscale_amount = '4';

    constructor(model: string, prompt: string) {
        super(model, prompt);
    }

    static FromRenderRequest(renderRequest: RenderRequest): UpscaledRenderRequest {
        const upscaledRenderRequest = new UpscaledRenderRequest(
            renderRequest.use_stable_diffusion_model, renderRequest.prompt);

        upscaledRenderRequest.seed = renderRequest.seed;
        upscaledRenderRequest.used_random_seed = renderRequest.used_random_seed;
        upscaledRenderRequest.negative_prompt = renderRequest.negative_prompt;
        upscaledRenderRequest.num_outputs = renderRequest.num_outputs;
        upscaledRenderRequest.num_inference_steps = renderRequest.num_inference_steps;
        upscaledRenderRequest.guidance_scale = renderRequest.guidance_scale;
        upscaledRenderRequest.width = renderRequest.width;
        upscaledRenderRequest.height = renderRequest.height;
        upscaledRenderRequest.vram_usage_level = renderRequest.vram_usage_level;
        upscaledRenderRequest.sampler_name = renderRequest.sampler_name;
        upscaledRenderRequest.clip_skip = renderRequest.clip_skip;
        upscaledRenderRequest.use_vae_model = renderRequest.use_vae_model;
        upscaledRenderRequest.stream_progress_updates = renderRequest.stream_progress_updates;
        upscaledRenderRequest.stream_image_progress = renderRequest.stream_image_progress;
        upscaledRenderRequest.show_only_filtered_image = renderRequest.show_only_filtered_image;
        upscaledRenderRequest.block_nsfw = renderRequest.block_nsfw;
        upscaledRenderRequest.output_format = renderRequest.output_format;
        upscaledRenderRequest.output_quality = renderRequest.output_quality;
        upscaledRenderRequest.output_lossless = renderRequest.output_lossless;
        upscaledRenderRequest.metadata_output_format = renderRequest.metadata_output_format;
        upscaledRenderRequest.original_prompt = renderRequest.original_prompt;
        upscaledRenderRequest.active_tags = renderRequest.active_tags;
        upscaledRenderRequest.inactive_tags = renderRequest.inactive_tags;
        upscaledRenderRequest.enable_vae_tiling = renderRequest.enable_vae_tiling;
        upscaledRenderRequest.session_id = renderRequest.session_id;

        return upscaledRenderRequest;
    }
}
