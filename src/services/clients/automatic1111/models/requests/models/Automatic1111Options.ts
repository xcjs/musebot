import { DatEnabledModel } from '../enums/DatEnabledModel';
import { ImageFormat } from '../enums/ImageFormat';
import { ProfilingActivity } from '../enums/ProfilingActivity';
import { RealEsrganEnabledModel } from '../enums/RealEsrganEnabledModel';
import { SaveImagesReplaceAction } from '../enums/SaveImagesReplaceAction';

export class Automatic1111Options {
  samples_save: boolean = true;
  samples_format: ImageFormat = ImageFormat.Png;
  samples_filename_pattern: string = "";
  save_images_add_number: boolean = true;
  save_images_replace_action: SaveImagesReplaceAction = SaveImagesReplaceAction.Replace;
  grid_save: boolean = true;
  grid_format: ImageFormat = ImageFormat.Png;
  grid_extended_filename: boolean = false;
  grid_only_if_multiple: boolean = true;
  grid_prevent_empty_spots: boolean = false;
  grid_zip_filename_pattern: string = '';
  n_rows: number = -1;
  font: string = '';
  grid_text_active_color: string = '#000000';
  grid_text_inactive_color: string = '#999999';
  grid_background_color: string = '#ffffff';
  save_images_before_face_restoration: boolean = false;
  save_images_before_highres_fix: boolean = false;
  save_images_before_color_correction: boolean = false;
  save_mask: boolean = false;
  save_mask_composite: boolean = false;
  jpeg_quality: number = 80;
  webp_lossless: boolean = false;
  export_for_4chan: boolean = true;
  img_downscale_threshold: number = 4;
  target_side_length: number = 4000;
  img_max_size_mp: number = 200;
  use_original_name_batch: boolean = true;
  use_upscaler_name_as_suffix: boolean = false;
  save_selected_only: boolean = true;
  save_write_log_csv: boolean = true;
  save_init_img: boolean = false;
  temp_dir: string = '';
  clean_temp_dir_at_start: boolean = false;
  save_incomplete_images: boolean = false;
  notification_audio: boolean = true;
  notification_volume: number = 100;
  outdir_samples: string = '';
  outdir_txt2img_samples: string = 'outputs/txt2img-images';
  outdir_img2img_samples: string = 'outputs/img2img-images';
  outdir_extras_samples: string = 'outputs/extras-images';
  outdir_grids: string = '';
  outdir_txt2img_grids: string = 'outputs/txt2img-grids';
  outdir_save: string = 'log/images';
  outdir_init_images: string = 'outputs/init-images';
  save_to_dirs: boolean = true;
  grid_save_to_dirs: boolean = true;
  use_save_to_dirs_for_ui: boolean = false;
  directories_filename_pattern: string = '[date]';
  directories_max_prompt_words: number = 8;
  ESRGAN_tile: number = 192;
  ESRGAN_tile_overlap: number = 8;

  realesrgan_enabled_models: Array<RealEsrganEnabledModel> = [
    RealEsrganEnabledModel.RESRGAN4xPlus,
    RealEsrganEnabledModel.RESRGAN4xPlusAnime6B
  ];

  dat_enabled_models: Array<DatEnabledModel> = [
    DatEnabledModel.DATx2,
    DatEnabledModel.DATx3,
    DatEnabledModel.DATx3
  ];

  DAT_tile: number =  192;
  DAT_tile_overlap: number = 8;
  upscaler_for_img2img: string = 'string';
  set_scale_by_when_changing_upscaler: boolean = false;
  face_restoration: boolean = false;
  face_restoration_model: string = 'CodeFormer';
  code_former_weight: number = 0.5;
  face_restoration_unload: boolean = false;
  auto_launch_browser: 'Local';
  enable_console_prompts: boolean = false;
  show_warnings: boolean = false;
  show_gradio_deprecation_warnings: boolean = true;
  memmon_poll_rate: number = 8;
  samples_log_stdout: boolean = false;
  multiple_tqdm: boolean = true;
  enable_upscale_progressbar: boolean = true;
  print_hypernet_extra: boolean = false;
  list_hidden_files: boolean = true;
  disable_mmap_load_safetensors: boolean = false;
  hide_ldm_prints: boolean = true;
  dump_stacks_on_signal: boolean = false;
  profiling_explanation: string = 'Those settings allow you to enable torch profiler when generating pictures.\nProfiling allows you to see which code uses how much of computer\'s resources during generation.\nEach generation writes its own profile to one file, overwriting previous.\nThe file can be viewed in <a href=\"chrome:tracing\">Chrome</a>, or on a <a href=\"https://ui.perfetto.dev/\">Perfetto</a> web site.\nWarning: writing profile can take a lot of time, up to 30 seconds, and the file itself can be around 500MB in size.';
  profiling_enable: boolean = false;

  profiling_activities: Array<ProfilingActivity> = [
    ProfilingActivity.CPU
  ];

  profiling_record_shapes: boolean = true;
  profiling_profile_memory: boolean = true;
  profiling_with_stack: boolean = true;
  profiling_filename: string = 'trace.json';
  api_enable_requests: boolean = true;
  api_forbid_local_requests: boolean = true;
  api_useragent: string = '';
  unload_models_when_training: boolean = false;
  pin_memory: boolean = false;
  save_optimizer_state: boolean = false;
  save_training_settings_to_txt: boolean = true;
  dataset_filename_word_regex: string = '';
  dataset_filename_join_string: string = ' ';
  training_image_repeats_per_epoch: number = 1;
  training_write_csv_every: number = 500;
  training_xattention_optimizations: boolean = false;
  training_enable_tensorboard: boolean = false;
  training_tensorboard_save_images: boolean = false;
  training_tensorboard_flush_every: number = 120;
  sd_model_checkpoint: string = 'string';
  sd_checkpoints_limit: number = 1;
  sd_checkpoints_keep_in_cpu: boolean = true;
  sd_checkpoint_cache: string = '0';
  sd_unet: string = 'Automatic';
  enable_quantization: boolean = false;
  emphasis: string = 'Original';
  enable_batch_seeds: boolean = true;
  comma_padding_backtrack: number = 20;
  sdxl_clip_l_skip: boolean = false;
  CLIP_stop_at_last_layers: number = 1;
  upcast_attn: boolean = false;
  randn_source: string = 'GPU';
  tiling: boolean = false;
  hires_fix_refiner_pass: string = 'second pass';
  sdxl_crop_top: string = '0';
  sdxl_crop_left: string = '0';
  sdxl_refiner_low_aesthetic_score: number = 2.5;
  sdxl_refiner_high_aesthetic_score: number = 6;
  sd3_enable_t5: boolean = false;
  sd_vae_explanation: string =  '<abbr title=\'Variational autoencoder\'>VAE</abbr> is a neural network that transforms a standard <abbr title=\'red/green/blue\'>RGB</abbr>\nimage into latent space representation and back. Latent space representation is what stable diffusion is working on during sampling\n(i.e. when the progress bar is between empty and full). For txt2img, VAE is used to create a resulting image after the sampling is finished.\nFor img2img, VAE is used to process user\'s input image before the sampling, and to create an image after sampling.';
  sd_vae_checkpoint_cache: string = '0';
  sd_vae: 'Automatic';
  sd_vae_overrides_per_model_preferences: boolean =  true;
  auto_vae_precision_bfloat16: boolean = false;
  auto_vae_precision: boolean = true;
  sd_vae_encode_method: 'Full';
  sd_vae_decode_method: 'Full';
  inpainting_mask_weight: number = 1;
  initial_noise_multiplier: number = 1;
  img2img_extra_noise: string = '0';
  img2img_color_correction: boolean = false;
  img2img_fix_steps: boolean = false;
  img2img_background_color: string = '#ffffff';
  img2img_sketch_default_brush_color: string = '#ffffff';
  img2img_inpaint_mask_brush_color: string = '#ffffff';
  img2img_inpaint_sketch_default_brush_color: string = '#ffffff';
  img2img_inpaint_mask_high_contrast: boolean = true;
  return_mask: boolean = false;
  "return_mask_composite": false,
  "img2img_batch_show_results_limit": 32,
  "overlay_inpaint": true,
  "img2img_autosize": false,
  "cross_attention_optimization": "Automatic",
  "s_min_uncond": "0",
  "s_min_uncond_all": false,
  "token_merging_ratio": "0",
  "token_merging_ratio_img2img": "0",
  "token_merging_ratio_hr": "0",
  "pad_cond_uncond": false,
  "pad_cond_uncond_v0": false,
  "persistent_cond_cache": true,
  "batch_cond_uncond": true,
  "fp8_storage": "Disable",
  "cache_fp16_weight": false,
  "forge_try_reproduce": "None",
  "auto_backcompat": true,
  "use_old_emphasis_implementation": false,
  "use_old_karras_scheduler_sigmas": false,
  "no_dpmpp_sde_batch_determinism": false,
  "use_old_hires_fix_width_height": false,
  "hires_fix_use_firstpass_conds": false,
  "use_old_scheduling": false,
  "use_downcasted_alpha_bar": false,
  "refiner_switch_by_sample_steps": false,
  "interrogate_keep_models_in_memory": false,
  "interrogate_return_ranks": false,
  "interrogate_clip_num_beams": 1,
  "interrogate_clip_min_length": 24,
  "interrogate_clip_max_length": 48,
  "interrogate_clip_dict_limit": 1500,
  "interrogate_clip_skip_categories": [],
  "interrogate_deepbooru_score_threshold": 0.5,
  "deepbooru_sort_alpha": true,
  "deepbooru_use_spaces": true,
  "deepbooru_escape": true,
  "deepbooru_filter_tags": "",
  "extra_networks_show_hidden_directories": true,
  "extra_networks_dir_button_function": false,
  "extra_networks_hidden_models": "When searched",
  "extra_networks_default_multiplier": 1,
  "extra_networks_card_width": "0",
  "extra_networks_card_height": "0",
  "extra_networks_card_text_scale": 1,
  "extra_networks_card_show_desc": true,
  "extra_networks_card_description_is_html": false,
  "extra_networks_card_order_field": "Path",
  "extra_networks_card_order": "Ascending",
  "extra_networks_tree_view_style": "Dirs",
  "extra_networks_tree_view_default_enabled": true,
  "extra_networks_tree_view_default_width": 180,
  "extra_networks_add_text_separator": " ",
  "ui_extra_networks_tab_reorder": "",
  "textual_inversion_print_at_load": false,
  "textual_inversion_add_hashes_to_infotext": true,
  "sd_hypernetwork": "None",
  "keyedit_precision_attention": 0.1,
  "keyedit_precision_extra": 0.05,
  "keyedit_delimiters": ".,\\/!?%^*;:{}=`~() ",
  "keyedit_delimiters_whitespace": [
    "Tab",
    "Carriage Return",
    "Line Feed"
  ],
  "keyedit_move": true,
  "disable_token_counters": false,
  "include_styles_into_token_counters": true,
  "return_grid": true,
  "do_not_show_images": false,
  "js_modal_lightbox": true,
  "js_modal_lightbox_initially_zoomed": true,
  "js_modal_lightbox_gamepad": false,
  "js_modal_lightbox_gamepad_repeat": 250,
  "sd_webui_modal_lightbox_icon_opacity": 1,
  "sd_webui_modal_lightbox_toolbar_opacity": 0.9,
  "gallery_height": "",
  "open_dir_button_choice": "Subdirectory",
  "compact_prompt_box": false,
  "samplers_in_dropdown": true,
  "dimensions_and_batch_together": true,
  "sd_checkpoint_dropdown_use_short": false,
  "hires_fix_show_sampler": false,
  "hires_fix_show_prompts": false,
  "txt2img_settings_accordion": false,
  "img2img_settings_accordion": false,
  "interrupt_after_current": true,
  "localization": "None",
  "quick_setting_list": [],
  "ui_tab_order": [],
  "hidden_tabs": [],
  "ui_reorder_list": [],
  "gradio_theme": "Default",
  "gradio_themes_cache": true,
  "show_progress_in_title": true,
  "send_seed": true,
  "send_size": true,
  "enable_reloading_ui_scripts": false,
  "infotext_explanation": "Infotext is what this software calls the text that contains generation parameters and can be used to generate the same picture again.\nIt is displayed in UI below the image. To use infotext, paste it into the prompt and click the ↙️ paste button.",
  "enable_pnginfo": true,
  "save_txt": false,
  "add_model_name_to_info": true,
  "add_model_hash_to_info": true,
  "add_vae_name_to_info": true,
  "add_vae_hash_to_info": true,
  "add_user_name_to_info": false,
  "add_version_to_infotext": true,
  "disable_weights_auto_swap": true,
  "infotext_skip_pasting": [],
  "infotext_styles": "Apply if any",
  "show_progressbar": true,
  "live_previews_enable": true,
  "live_previews_image_format": "png",
  "show_progress_grid": true,
  "show_progress_every_n_steps": 10,
  "show_progress_type": "Approx NN",
  "live_preview_allow_lowvram_full": false,
  "live_preview_content": "Prompt",
  "live_preview_refresh_period": 1000,
  "live_preview_fast_interrupt": false,
  "js_live_preview_in_modal_lightbox": false,
  "prevent_screen_sleep_during_generation": true,
  "hide_samplers": [],
  "eta_ddim": "0",
  "eta_ancestral": 1,
  "ddim_discretize": "uniform",
  "s_churn": "0",
  "s_tmin": "0",
  "s_tmax": "0",
  "s_noise": 1,
  "sigma_min": "0",
  "sigma_max": "0",
  "rho": "0",
  "eta_noise_seed_delta": "0",
  "always_discard_next_to_last_sigma": false,
  "sgm_noise_multiplier": false,
  "uni_pc_variant": "bh1",
  "uni_pc_skip_type": "time_uniform",
  "uni_pc_order": 3,
  "uni_pc_lower_order_final": true,
  "sd_noise_schedule": "Default",
  "skip_early_cond": "0",
  "beta_dist_alpha": 0.6,
  "beta_dist_beta": 0.6,
  "postprocessing_enable_in_main_ui": [],
  "postprocessing_disable_in_extras": [],
  "postprocessing_operation_order": [],
  "upscaling_max_images_in_cache": 5,
  "postprocessing_existing_caption_action": "Ignore",
  "disabled_extensions": [],
  "disable_all_extensions": "none",
  "restore_config_state_file": "",
  "sd_checkpoint_hash": "",
  "forge_unet_storage_dtype": "Automatic",
  "forge_inference_memory": 1024,
  "forge_async_loading": "Queue",
  "forge_pin_shared_memory": "CPU",
  "forge_preset": "sd",
  "forge_additional_modules": [],
  "sd_t2i_width": 512,
  "sd_t2i_height": 640,
  "sd_t2i_cfg": 7,
  "sd_t2i_hr_cfg": 7,
  "sd_i2i_width": 512,
  "sd_i2i_height": 512,
  "sd_i2i_cfg": 7,
  "xl_t2i_width": 896,
  "xl_t2i_height": 1152,
  "xl_t2i_cfg": 5,
  "xl_t2i_hr_cfg": 5,
  "xl_i2i_width": 1024,
  "xl_i2i_height": 1024,
  "xl_i2i_cfg": 5,
  "flux_t2i_width": 896,
  "flux_t2i_height": 1152,
  "flux_t2i_cfg": 1,
  "flux_t2i_hr_cfg": 1,
  "flux_t2i_d_cfg": 3.5,
  "flux_t2i_hr_d_cfg": 3.5,
  "flux_i2i_width": 1024,
  "flux_i2i_height": 1024,
  "flux_i2i_cfg": 1,
  "flux_i2i_d_cfg": 3.5,
  "settings_in_ui": "This page allows you to add some settings to the main interface of txt2img and img2img tabs.",
  "extra_options_txt2img": [],
  "extra_options_img2img": [],
  "extra_options_cols": 1,
  "extra_options_accordion": false

  constructor() {

  }
};
