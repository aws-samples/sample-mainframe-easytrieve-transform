import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import { CloudFormationClient, DescribeStacksCommand } from "@aws-sdk/client-cloudformation";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { CloudWatchLogsClient, FilterLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";

const REGION = process.env.AWS_REGION || "us-east-1";

export const stsClient = new STSClient({ region: REGION });
export const cfnClient = new CloudFormationClient({ region: REGION });
export const lambdaClient = new LambdaClient({ region: REGION });
export const s3Client = new S3Client({ region: REGION });
export const cwlClient = new CloudWatchLogsClient({ region: REGION });

export async function getAccountId(): Promise<string> {
  const response = await stsClient.send(new GetCallerIdentityCommand({}));
  return response.Account!;
}

export async function getStackStatus(stackName: string): Promise<string | null> {
  try {
    const response = await cfnClient.send(
      new DescribeStacksCommand({ StackName: stackName })
    );
    return response.Stacks?.[0]?.StackStatus || null;
  } catch {
    return null;
  }
}

export async function invokeLambda(functionName: string, payload: object): Promise<any> {
  const response = await lambdaClient.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from(JSON.stringify(payload)),
    })
  );
  const responsePayload = Buffer.from(response.Payload!).toString("utf-8");
  return JSON.parse(responsePayload);
}

export async function uploadToS3(bucket: string, key: string, body: Buffer): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
    })
  );
}

export async function listS3Objects(bucket: string, prefix: string): Promise<string[]> {
  const response = await s3Client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    })
  );
  return (response.Contents || []).map((obj) => obj.Key!);
}

export async function getConversationIdFromLogs(logStreamName: string): Promise<string | null> {
  try {
    const response = await cwlClient.send(
      new FilterLogEventsCommand({
        logGroupName: "/aws/batch/atx-transform",
        logStreamNames: [logStreamName],
        filterPattern: "Conversation log",
        limit: 1,
      })
    );
    const message = response.events?.[0]?.message;
    if (message) {
      // Extract conversation ID from path like /home/atxuser/.aws/atx/custom/20260629_133934_abc123/logs/...
      const match = message.match(/\/(\d{8}_\d{6}_[a-f0-9]+)\//);
      return match ? match[1] : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function getSourceBucket(accountId: string): string {
  return `atx-source-code-${accountId}`;
}

export function getOutputBucket(accountId: string): string {
  return `atx-custom-output-${accountId}`;
}
