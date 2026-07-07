"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getResults = getResults;
const aws_helpers_1 = require("../utils/aws-helpers");
async function getResults(input) {
    const region = process.env.AWS_REGION || "us-east-1";
    const dashboardUrl = `https://${region}.console.aws.amazon.com/cloudwatch/home#dashboards/dashboard/ATX-Transform-CLI-Dashboard`;
    try {
        // Get job status to confirm completion and get output path
        const statusResponse = await (0, aws_helpers_1.invokeLambda)("atx-get-job-status", { jobId: input.jobId });
        if (statusResponse.status !== "SUCCEEDED") {
            return {
                success: false,
                jobId: input.jobId,
                jobName: statusResponse.jobName,
                status: statusResponse.status,
                artifacts: [],
                downloadCommands: [],
                dashboardUrl,
                error: `Job is not complete. Current status: ${statusResponse.status}. Use ezt_check_status to monitor.`,
            };
        }
        const s3OutputPath = statusResponse.s3OutputPath;
        const accountId = await (0, aws_helpers_1.getAccountId)();
        const outputBucket = (0, aws_helpers_1.getOutputBucket)(accountId);
        // List objects in the output path
        const prefix = s3OutputPath.replace(`s3://${outputBucket}/`, "");
        const objects = await (0, aws_helpers_1.listS3Objects)(outputBucket, prefix);
        // Determine validation result from exit code
        const validationPassed = statusResponse.container?.exitCode === 0;
        // Build download commands
        const downloadCommands = objects.map((key) => `aws s3 cp s3://${outputBucket}/${key} ./${key.split("/").pop()}`);
        return {
            success: true,
            jobId: input.jobId,
            jobName: statusResponse.jobName,
            status: "SUCCEEDED",
            validationPassed,
            s3OutputPath,
            artifacts: objects.map((key) => key.split("/").pop()),
            downloadCommands,
            dashboardUrl,
        };
    }
    catch (err) {
        return {
            success: false,
            jobId: input.jobId,
            status: "ERROR",
            artifacts: [],
            downloadCommands: [],
            dashboardUrl,
            error: err.message || String(err),
        };
    }
}
//# sourceMappingURL=get-results.js.map