import { Dictionary } from '../../../../../../types/Dictionary.js';
import { ImageOutputFormat } from '../../enums/ImageOutputFormat.js';
import { MetadataOutputFormat } from '../../enums/MetadataOutputFormat.js';
import { VRamUsageLevel } from '../../enums/VRamUsageLevel.js';
import { IFilter } from './IFilter.js';

export interface ITaskData {
    request_id: number;
    session_id: number;
    vram_usage_level: VRamUsageLevel;
    use_face_correction: boolean | null;
    use_upscale: string | undefined;
    upscale_amount: number;
    latent_upscaler_steps: number;
    use_stable_diffusion_model: string;
    use_vae_model: string;
    use_hypernetwork_model: string | null;
    use_lora_model: null;
    use_controlnet_model: null;
    use_embeddings_model: null;
    filters: Array<string>;
    filter_params: Dictionary<string, IFilter>;
    control_filter_to_apply: null;
    enable_vae_tiling: boolean;
    show_only_filtered_image: boolean;
    block_nsfw: boolean;
    stream_image_progress: boolean;
    stream_image_progress_interval: number;
    clip_skip: boolean;
    codeformer_upscale_faces: false;
    codeformer_fidelity: number;
    output_format: ImageOutputFormat;
    output_quality: number;
    output_lossless: boolean;
    save_to_disk_path: string | null;
    metadata_output_format: MetadataOutputFormat;
}
