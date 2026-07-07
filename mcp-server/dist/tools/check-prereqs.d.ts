interface PrereqResult {
    allPassed: boolean;
    checks: {
        awsCredentials: {
            passed: boolean;
            detail: string;
        };
        remoteInfrastructure: {
            passed: boolean;
            detail: string;
        };
        transformationDefinitions: {
            passed: boolean;
            detail: string;
            tds?: string[];
        };
    };
    accountId?: string;
    resolution?: string;
}
export declare function checkPrereqs(): Promise<PrereqResult>;
export {};
//# sourceMappingURL=check-prereqs.d.ts.map