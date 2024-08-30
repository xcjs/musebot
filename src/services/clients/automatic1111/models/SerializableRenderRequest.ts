import { Txt2ImgOptionsUpdated } from './Txt2ImgOptionsUpdated.js';
import { SamplingMethod } from '../enums/SamplingMethod.js';
import { ScheduleType } from '../enums/ScheduleType.js';
import { Txt2ImgOptionsFactory } from '../factories/Txt2ImgOptionsFactory.js';

export class SerializableRenderRequest {
    prompt: string;
    model: string;
    seed: number;
    width: number;
    height: number;
    sampler: SamplingMethod;
    scheduler: ScheduleType;
    distilledCfgScale: number;
    cfgScale: number;
    steps: number;

    constructor() {

    }

    toString(): string {
        return JSON.stringify(this);
    }

    toTxt2ImgOptionsUpdated(): Txt2ImgOptionsUpdated {
        const options = Txt2ImgOptionsFactory.getBaseSettings(this.prompt);

        options.seed = this.seed;
        options.width = this.width;
        options.height = this.height;
        options.sampler_index = this.sampler;
        options.sampler_name = this.sampler;
        options.scheduler = this.scheduler;
        options.distilled_cfg_scale = this.distilledCfgScale;
        options.cfg_scale = this.cfgScale;
        options.steps = this.steps;

        return options;
    }

    static fromJson(renderRequestJson: string): SerializableRenderRequest {
        const requestObj = JSON.parse(renderRequestJson) as SerializableRenderRequest;
        const request = SerializableRenderRequest.fromSerializableRenderRequest(requestObj);

        return Object.assign(request, requestObj);
    }

    static fromSerializableRenderRequest(request: SerializableRenderRequest) {
        const instancedRequest = new SerializableRenderRequest();

        instancedRequest.prompt = request.prompt;
        instancedRequest.model = request.model;
        instancedRequest.seed = request.seed;
        instancedRequest.width = request.width;
        instancedRequest.height = request.height;
        instancedRequest.sampler = request.sampler;
        instancedRequest.scheduler = request.scheduler;
        instancedRequest.distilledCfgScale = request.distilledCfgScale;
        instancedRequest.cfgScale = request.cfgScale;
        instancedRequest.steps = request.steps;

        return instancedRequest;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static fromTxt2ImgOptionsUpdated(options: any, model: string, seed: number): SerializableRenderRequest {
        const request = new SerializableRenderRequest();

        request.prompt = options.prompt;
        request.model = model;
        request.seed = seed;
        request.width = options.width;
        request.height = options.height;
        request.sampler = options.sampler_name;
        request.scheduler = options.scheduler;
        request.distilledCfgScale = options.distilled_cfg_scale;
        request.cfgScale = options.cfg_scale;
        request.steps = options.steps;

        return request;
    }
}
