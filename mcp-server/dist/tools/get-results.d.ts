interface GetResultsInput {
    jobId: string;
}
interface GetResultsResult {
    success: boolean;
    jobId: string;
    jobName?: string;
    status: string;
    validationPassed?: boolean;
    s3OutputPath?: string;
    artifacts: string[];
    downloadCommands: string[];
    dashboardUrl: string;
    error?: string;
}
export declare function getResults(input: GetResultsInput): Promise<GetResultsResult>;
export {};
//# sourceMappingURL=get-results.d.ts.map