interface PrepareInput {
    sourcePath: string;
    inputDataPath: string;
    outputDataPath: string;
    breDocPath?: string;
    programName: string;
}
interface PrepareResult {
    success: boolean;
    workspaceS3Path: string;
    workspaceLocalPath: string;
    sourceFileCount: number;
    inputFileCount: number;
    outputFileCount: number;
    breFileCount: number;
    error?: string;
}
export declare function prepareWorkspace(input: PrepareInput): Promise<PrepareResult>;
export {};
//# sourceMappingURL=prepare-workspace.d.ts.map