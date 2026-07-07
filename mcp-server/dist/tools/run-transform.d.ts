interface RunTransformInput {
    workspaceS3Path: string;
    programName: string;
}
interface RunTransformResult {
    success: boolean;
    jobId?: string;
    jobName: string;
    status?: string;
    s3OutputPath?: string;
    error?: string;
    blocked?: boolean;
    nextStep: string;
}
export declare function runTransform(input: RunTransformInput): Promise<RunTransformResult>;
export {};
//# sourceMappingURL=run-transform.d.ts.map