interface CheckStatusInput {
    jobId: string;
}
interface CheckStatusResult {
    success: boolean;
    jobId: string;
    jobName?: string;
    status: string;
    submittedAt?: string;
    startedAt?: string;
    completedAt?: string;
    durationSeconds?: number;
    s3OutputPath?: string;
    conversationId?: string;
    logStreamName?: string;
    exitCode?: number;
    error?: string;
    nextStep: string;
}
export declare function checkStatus(input: CheckStatusInput): Promise<CheckStatusResult>;
export {};
//# sourceMappingURL=check-status.d.ts.map