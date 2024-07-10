export class GenerateRequest {
    model: string;
    prompt: string;
    system: string;
    context: Array<number>;
    stream: boolean = false;
}
