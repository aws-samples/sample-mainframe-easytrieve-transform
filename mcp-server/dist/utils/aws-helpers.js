"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cwlClient = exports.s3Client = exports.lambdaClient = exports.cfnClient = exports.stsClient = void 0;
exports.getAccountId = getAccountId;
exports.getStackStatus = getStackStatus;
exports.invokeLambda = invokeLambda;
exports.uploadToS3 = uploadToS3;
exports.listS3Objects = listS3Objects;
exports.getConversationIdFromLogs = getConversationIdFromLogs;
exports.getSourceBucket = getSourceBucket;
exports.getOutputBucket = getOutputBucket;
const client_sts_1 = require("@aws-sdk/client-sts");
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const client_lambda_1 = require("@aws-sdk/client-lambda");
const client_s3_1 = require("@aws-sdk/client-s3");
const client_cloudwatch_logs_1 = require("@aws-sdk/client-cloudwatch-logs");
const REGION = process.env.AWS_REGION || "us-east-1";
exports.stsClient = new client_sts_1.STSClient({ region: REGION });
exports.cfnClient = new client_cloudformation_1.CloudFormationClient({ region: REGION });
exports.lambdaClient = new client_lambda_1.LambdaClient({ region: REGION });
exports.s3Client = new client_s3_1.S3Client({ region: REGION });
exports.cwlClient = new client_cloudwatch_logs_1.CloudWatchLogsClient({ region: REGION });
async function getAccountId() {
    const response = await exports.stsClient.send(new client_sts_1.GetCallerIdentityCommand({}));
    return response.Account;
}
async function getStackStatus(stackName) {
    try {
        const response = await exports.cfnClient.send(new client_cloudformation_1.DescribeStacksCommand({ StackName: stackName }));
        return response.Stacks?.[0]?.StackStatus || null;
    }
    catch {
        return null;
    }
}
async function invokeLambda(functionName, payload) {
    const response = await exports.lambdaClient.send(new client_lambda_1.InvokeCommand({
        FunctionName: functionName,
        Payload: Buffer.from(JSON.stringify(payload)),
    }));
    const responsePayload = Buffer.from(response.Payload).toString("utf-8");
    return JSON.parse(responsePayload);
}
async function uploadToS3(bucket, key, body) {
    await exports.s3Client.send(new client_s3_1.PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
    }));
}
async function listS3Objects(bucket, prefix) {
    const response = await exports.s3Client.send(new client_s3_1.ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
    }));
    return (response.Contents || []).map((obj) => obj.Key);
}
async function getConversationIdFromLogs(logStreamName) {
    try {
        const response = await exports.cwlClient.send(new client_cloudwatch_logs_1.FilterLogEventsCommand({
            logGroupName: "/aws/batch/atx-transform",
            logStreamNames: [logStreamName],
            filterPattern: "Conversation log",
            limit: 1,
        }));
        const message = response.events?.[0]?.message;
        if (message) {
            // Extract conversation ID from path like /home/atxuser/.aws/atx/custom/20260629_133934_abc123/logs/...
            const match = message.match(/\/(\d{8}_\d{6}_[a-f0-9]+)\//);
            return match ? match[1] : null;
        }
        return null;
    }
    catch {
        return null;
    }
}
function getSourceBucket(accountId) {
    return `atx-source-code-${accountId}`;
}
function getOutputBucket(accountId) {
    return `atx-custom-output-${accountId}`;
}
//# sourceMappingURL=aws-helpers.js.map