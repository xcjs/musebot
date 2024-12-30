import { getRandomInt } from '../../../../../utilities/random-utilities.js';
import { SamplingMethod } from '../../automatic1111/enums/SamplingMethod.js';
import { ScheduleType } from '../../automatic1111/enums/ScheduleType.js';
import { Txt2ImgOptionsFactory } from '../../automatic1111/factories/Txt2ImgOptionsFactory.js';
import { Txt2ImgOptionsRequest } from '../../automatic1111/models/requests/Txt2ImgOptionsRequest.js';
import { maxSeed } from '../constants/constants.js';

export class SerializableRenderRequest {
    prompt: string;
    promptNegative: string | null;
    model: string;
    seed: number;
    width: number;
    height: number;
    sampler: string;
    scheduler: string;
    distilledCfgScale: number | null;
    cfgScale: number;
    steps: number;
    num: number = 1;

    constructor() {

    }

    refreshSeed(): void {
        this.seed = getRandomInt(0, maxSeed);
    }

    toString(): string {
        return JSON.stringify(this);
    }

    toTxt2ImgOptionsRequest(): Txt2ImgOptionsRequest {
        const options = Txt2ImgOptionsFactory.getCurrentModelSettings(this.model, this.prompt);

        options.negative_prompt = this.promptNegative;
        options.seed = this.seed;
        options.width = this.width;
        options.height = this.height;
        options.sampler_index = this.sampler as SamplingMethod;
        options.sampler_name = this.sampler as SamplingMethod;
        options.scheduler = this.scheduler as ScheduleType;
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

    static fromSerializableRenderRequest(request: SerializableRenderRequest): SerializableRenderRequest {
        const instancedRequest = new SerializableRenderRequest();

        instancedRequest.prompt = request.prompt;
        instancedRequest.promptNegative = request.promptNegative;
        instancedRequest.model = request.model;
        instancedRequest.seed = request.seed;
        instancedRequest.width = request.width;
        instancedRequest.height = request.height;
        instancedRequest.sampler = request.sampler;
        instancedRequest.scheduler = request.scheduler;
        instancedRequest.distilledCfgScale = request.distilledCfgScale;
        instancedRequest.cfgScale = request.cfgScale;
        instancedRequest.steps = request.steps;
        instancedRequest.num = request.num || 1;

        return instancedRequest;
    }

    static fromTxt2ImgOptionsRequest(options: Txt2ImgOptionsRequest, model: string, seed: number): SerializableRenderRequest {
        const request = new SerializableRenderRequest();

        request.prompt = options.prompt;
        request.promptNegative = options.negative_prompt;
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
