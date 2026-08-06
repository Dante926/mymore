export interface MyMoreConfig {
    llm: {
        baseUrl: string;
        apiKey: string;
        model: string;
        embeddingModel?: string;
    };
    pipeline: {
        everyNConversations: number;
        l1IdleTimeoutSeconds: number;
        l2DelayAfterL1Seconds: number;
        l2MinIntervalSeconds: number;
        l2MaxIntervalSeconds: number;
        triggerEveryN: number;
    };
}
export declare function loadConfig(rootDir?: string): MyMoreConfig;
export declare function saveConfig(config: MyMoreConfig, rootDir?: string): void;
//# sourceMappingURL=config.d.ts.map