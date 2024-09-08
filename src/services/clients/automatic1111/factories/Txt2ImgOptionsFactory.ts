import { SamplingMethod } from '../enums/SamplingMethod.js';
import { ScheduleType } from '../enums/ScheduleType.js';
import { Upscaler } from '../enums/Upscaler.js';
import { Txt2ImgOptionsRequest } from '../models/requests/Txt2ImgOptionsRequest.js';

export class Txt2ImgOptionsFactory {
    static getCurrentModelSettings(model: string, prompt: string): Txt2ImgOptionsRequest {
        const pathNodes = model.split('/');
        const rootPath = pathNodes.length > 0 ? pathNodes[0] : model;

        switch(rootPath.toLocaleLowerCase()) {
            case 'flux':
                return Txt2ImgOptionsFactory.getFluxSettings(prompt);
            case 'pony':
            case 'xl':
            case 'xl-hyper':
            case 'xl-turbo':
                return Txt2ImgOptionsFactory.getStableDiffusionXlSettings(prompt);
            default:
                return Txt2ImgOptionsFactory.getBaseSettings(prompt);
        }
    }

    static getBaseSettings(prompt: string): Txt2ImgOptionsRequest {
        return {
            prompt,
            negative_prompt: '',
            styles: [],
            seed: -1,
            subseed: -1,
            subseed_strength: 0.0,
            seed_resize_from_h: -1,
            seed_resize_from_w: -1,
            sampler_name: null,
            scheduler: null,
            batch_size: 1,
            n_iter: 1,
            steps: 25,
            cfg_scale:  1,
            distilled_cfg_scale: 3.5,
            width: 512,
            height: 512,
            restore_faces: true,
            tiling: true,
            do_not_save_samples: false,
            do_not_save_grid: false,
            eta: 1.0,
            denoising_strength: 0.7,
            s_min_uncond: 0,
            s_churn: 0,
            s_tmax: 0,
            s_tmin: 0,
            s_noise: 1,
            override_settings: {},
            override_settings_restore_afterwards: true,
            refiner_checkpoint: null,
            refiner_switch_at: 0,
            disable_extra_networks: false,
            firstpass_image: null,
            comments: {},
            enable_hr: false,
            firstphase_width: 0,
            firstphase_height: 0,
            hr_scale: 1,
            hr_upscaler: null,
            hr_second_pass_steps: 0,
            hr_resize_x: 0,
            hr_resize_y: 0,
            hr_checkpoint_name: null,
            hr_sampler_name: null,
            hr_scheduler: null,
            hr_prompt: '',
            hr_negative_prompt: '',
            force_task_id: null,
            sampler_index: null,
            script_name: null,
            script_args: [],
            send_images: true,
            save_images: false,
            alwayson_scripts: {},
            infotext: null,
            use_deprecated_controlnet: false,
            controlnet_units: []
        };
    }

    static getStableDiffusionXlSettings(prompt: string): Txt2ImgOptionsRequest {
        const options = Txt2ImgOptionsFactory.getBaseSettings(prompt);

        options.sampler_name = SamplingMethod.Euler_a;
        options.sampler_index = SamplingMethod.Euler_a;
        options.scheduler = ScheduleType.Karras;
        options.steps = 25;
        options.height = 1024;
        options.width = 1024;

        return options;
    }

    static getFluxSettings(prompt: string): Txt2ImgOptionsRequest {
        const options = Txt2ImgOptionsFactory.getBaseSettings(prompt);

        options.sampler_name = SamplingMethod.Euler;
        options.sampler_index = SamplingMethod.Euler;
        options.scheduler = ScheduleType.Simple;
        options.steps = 20;
        options.height = 1024;
        options.width = 1024;

        return options;
    }

    static getUpscaledSettings(request: Txt2ImgOptionsRequest, scaleAmount: number) {
        request.enable_hr = true;
        request.hr_upscaler = Upscaler.R_ESRGAN4xPlus;
        request.hr_scale = scaleAmount;
        request.denoising_strength = .02;

        return request;
    }
}
