import { getRandomInt } from '../../../../../utilities/random-utilities.js';
import { maxSeed } from '../constants/constants.js';

export class SerializableRenderRequest {
    prompt: string | null;
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

    label: string | undefined;
    title: string | undefined;
    helpText: string | undefined;

    constructor() {

    }

    refreshSeed(): void {
        this.seed = getRandomInt(0, maxSeed);
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

        instancedRequest.label = request.label;
        instancedRequest.title = request.title;
        instancedRequest.helpText = request.helpText;

        return instancedRequest;
    }
}
