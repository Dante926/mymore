export interface LLMRunParams {
    prompt: string;
    systemPrompt?: string;
    taskId: string;
    timeoutMs?: number;
    maxTokens?: number;
}
export declare class LLMRunner {
    private cfg;
    constructor(cfg: {
        baseUrl: string;
        apiKey: string;
        model: string;
        timeoutMs?: number;
    });
    run(params: LLMRunParams): Promise<string>;
}
//# sourceMappingURL=llm.d.ts.map