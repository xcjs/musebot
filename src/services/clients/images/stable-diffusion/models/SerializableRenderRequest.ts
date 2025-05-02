import { getRandomInt } from '../../../../../utilities/random-utilities.js';
import { maxSeed } from '../constants/constants.js';

export class SerializableRenderRequest {
    label: string | undefined;
    help: string | undefined;
    prompt: string;
    promptNegative: string | null;
    model: string;
    seed: number;
    width: number;
    height: number;
    sampler: string;
    scheduler: string;
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
        instancedRequest.cfgScale = request.cfgScale;
        instancedRequest.steps = request.steps;
        instancedRequest.num = request.num || 1;

        return instancedRequest;
    }
}
