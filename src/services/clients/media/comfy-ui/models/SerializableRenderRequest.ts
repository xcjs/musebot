import { getRandomInt } from '../../../../../utilities/random-utilities.js';
import { maxSeed } from '../../stable-diffusion/constants/constants.js';

export class SerializableRenderRequest {
    prompt: string | null;
    prompt2: string | undefined;
    promptNegative: string | null;
    workflow: string;
    seed: number;
    width: number;
    height: number;
    sampler: string;
    scheduler: string;
    cfgScale: number;
    steps: number;
    num: number = 1;

    image: string | undefined;
    model: string | undefined;
    maxWidth: number | undefined;
    maxHeight: number | undefined;
    duration: number | undefined;
    durationMin: number | undefined;
    durationMax: number | undefined;

    label: string | undefined;
    title: string | undefined;
    helpText: string | undefined;

    constructor() {

    }

    refreshSeed(): void {
        this.seed = getRandomInt(0, maxSeed);
    }

    refreshDuration(): void {
        if (this.durationMin !== undefined
            && this.durationMax !== undefined) {
            this.duration = getRandomInt(this.durationMin, this.durationMax);
        }
    }

    toString(): string {
        return JSON.stringify(this);
    }

    static fromJson(renderRequestJson: string): SerializableRenderRequest {
        const requestObj = JSON.parse(renderRequestJson) as SerializableRenderRequest;
        const request = SerializableRenderRequest.fromSerializableRenderRequest(requestObj);

        return Object.assign(request, requestObj);
    }

    static fromSerializableRenderRequest(request: SerializableRenderRequest): SerializableRenderRequest {
        const instancedRequest = new SerializableRenderRequest();

        instancedRequest.prompt = request.prompt;
        instancedRequest.prompt2 = request.prompt2;
        instancedRequest.promptNegative = request.promptNegative;
        instancedRequest.workflow = request.workflow || request.model;
        instancedRequest.seed = request.seed;
        instancedRequest.width = request.width;
        instancedRequest.height = request.height;
        instancedRequest.sampler = request.sampler;
        instancedRequest.scheduler = request.scheduler;
        instancedRequest.cfgScale = request.cfgScale;
        instancedRequest.steps = request.steps;
        instancedRequest.num = request.num || 1;

        instancedRequest.image = request.image;
        instancedRequest.maxHeight = request.maxHeight;
        instancedRequest.maxWidth = request.maxWidth;
        instancedRequest.duration = request.duration;
        instancedRequest.durationMin = request.durationMin;
        instancedRequest.durationMax = request.durationMax;

        instancedRequest.label = request.label;
        instancedRequest.title = request.title;
        instancedRequest.helpText = request.helpText;

        return instancedRequest;
    }
}
