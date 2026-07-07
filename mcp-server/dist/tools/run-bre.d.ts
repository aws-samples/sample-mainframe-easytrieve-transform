interface RunBreInput {
    workspaceS3Path: string;
    programName: string;
}
interface RunBreResult {
    success: boolean;
    jobId?: string;
    jobName: string;
    status?: string;
    s3OutputPath?: string;
    error?: string;
    nextStep: string;
}
export declare function runBre(input: RunBreInput): Promise<RunBreResult>;
export {};
//# sourceMappingURL=run-bre.d.ts.map