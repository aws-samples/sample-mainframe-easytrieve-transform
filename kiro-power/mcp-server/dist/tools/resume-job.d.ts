interface ResumeJobInput {
    workspaceS3Path: string;
    conversationId: string;
    programName: string;
}
interface ResumeJobResult {
    success: boolean;
    jobId?: string;
    jobName: string;
    status?: string;
    s3OutputPath?: string;
    error?: string;
    nextStep: string;
}
export declare function resumeJob(input: ResumeJobInput): Promise<ResumeJobResult>;
export {};
//# sourceMappingURL=resume-job.d.ts.map