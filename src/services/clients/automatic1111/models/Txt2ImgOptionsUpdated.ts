import { Txt2ImgOptions } from '@lancercomet/sd-api';
import { ScheduleType } from '../enums/ScheduleType';

export type Txt2ImgOptionsUpdated = {
    scheduler: ScheduleType | null,
    distilled_cfg_scale: number,
    s_min_uncond: number,
    refiner_checkpoint: string | null,
    refiner_switch_at: number,
    disable_extra_networks: boolean,
    firstpass_image: string | null,
    comments: object,
    hr_checkpoint_name: string | null,
    hr_sampler_name: string | null,
    hr_scheduler: string | null,
    hr_prompt: string | null,
    hr_negative_prompt: string | null,
    force_task_id: string | null,
    sampler_index: string,
    script_args: string | null,
    alwayson_scripts: object,
    infotext: string | null
} & Txt2ImgOptions;
