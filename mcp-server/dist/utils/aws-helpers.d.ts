import { STSClient } from "@aws-sdk/client-sts";
import { CloudFormationClient } from "@aws-sdk/client-cloudformation";
import { LambdaClient } from "@aws-sdk/client-lambda";
import { S3Client } from "@aws-sdk/client-s3";
import { CloudWatchLogsClient } from "@aws-sdk/client-cloudwatch-logs";
export declare const stsClient: STSClient;
export declare const cfnClient: CloudFormationClient;
export declare const lambdaClient: LambdaClient;
export declare const s3Client: S3Client;
export declare const cwlClient: CloudWatchLogsClient;
export declare function getAccountId(): Promise<string>;
export declare function getStackStatus(stackName: string): Promise<string | null>;
export declare function invokeLambda(functionName: string, payload: object): Promise<any>;
export declare function uploadToS3(bucket: string, key: string, body: Buffer): Promise<void>;
export declare function listS3Objects(bucket: string, prefix: string): Promise<string[]>;
export declare function getConversationIdFromLogs(logStreamName: string): Promise<string | null>;
export declare function getSourceBucket(accountId: string): string;
export declare function getOutputBucket(accountId: string): string;
//# sourceMappingURL=aws-helpers.d.ts.map