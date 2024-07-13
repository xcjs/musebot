export class GenerateResponse {
    model: string;
    created_at: string;
    response: string;
    done: boolean;
    done_reason: string;
    context: Array<number> = [];
    total_duration: number;
    load_duration: number;
    prompt_eval_count: number;
    prompt_eval_duration: number;
    eval_count: number;
    eval_duration: number;

    get tokensPerSecond(): number {
        return this.eval_count / this.eval_duration * (10 ** 9);
    }
}
