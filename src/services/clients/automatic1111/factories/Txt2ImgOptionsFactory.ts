import { Txt2ImgOptions } from '@lancercomet/sd-api';

export class Txt2ImgOptionsFactory {
    static getBaseSettings(prompt: string): Txt2ImgOptions {
        return {
            prompt,
            negative_prompt: '',
            styles: [],
            seed: -1,
            subseed: -1,
            subseed_strength: 0,
            seed_resize_from_h: -1,
            seed_resize_from_w: -1,
            sampler_name: null,
            // scheduler: null,
            batch_size: 1,
            n_iter: 1,
            steps: 50,
            cfg_scale:  7,
            // distilled_cfg_scale: 3.5,
            width: 512,
            height: 512,
            restore_faces: true,
            tiling: true,
            do_not_save_samples: false,
            do_not_save_grid: false,
            eta: 0,
            denoising_strength: 0,
            // s_min_uncond: 0,
            s_churn: 0,
            s_tmax: 0,
            s_tmin: 0,
            s_noise: 0,
            override_settings: {},
            override_settings_restore_afterwards: true,
            // refiner_checkpoint: null,
            // refiner_switch_at: 0,
            // disable_extra_networks: false,
            // firstpass_image: null,
            // comments = {},
            enable_hr: false,
            firstphase_width: 0,
            firstphase_height: 0,
            hr_scale: 2,
            hr_upscaler: null,
            hr_second_pass_steps: 0,
            hr_resize_x: 0,
            hr_resize_y: 0,
            // hr_checkpoint_name: null,
            // hr_sampler_name: null,
            // hr_scheduler: null,
            // hr_prompt: null = '',
            // hr_negative_prompt: null = '',
            // force_task_id: null,
            // sampler_index: 'Euler',
            script_name: null,
            // script_args = null,
            send_images: true,
            save_images: false,
            // alwayson_scripts = {},
            // infotext: null,
        };
    }

    static getFluxSettings(prompt: string): Txt2ImgOptions {
        const options = Txt2ImgOptionsFactory.getBaseSettings(prompt);

        options.height - 1024;
        options.width = 1024;

        return options;
    }
}
