interface BatchJob {
    workspaceS3Path: string;
    programName: string;
}
interface RunBatchInput {
    jobs: BatchJob[];
}
interface RunBatchResult {
    success: boolean;
    batchId?: string;
    batchName: string;
    jobCount: number;
    status?: string;
    error?: string;
    nextStep: string;
}
export declare function runBatch(input: RunBatchInput): Promise<RunBatchResult>;
export {};
//# sourceMappingURL=run-batch.d.ts.map