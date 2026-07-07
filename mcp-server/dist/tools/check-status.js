"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkStatus = checkStatus;
const aws_helpers_1 = require("../utils/aws-helpers");
async function checkStatus(input) {
    try {
        const response = await (0, aws_helpers_1.invokeLambda)("atx-get-job-status", { jobId: input.jobId });
        if (response.statusCode !== 200) {
            return {
                success: false,
                jobId: input.jobId,
                status: "UNKNOWN",
                error: response.error || "Failed to get job status",
                nextStep: "Retry after a few seconds. If persistent, check CloudWatch logs.",
            };
        }
        const status = response.status;
        const logStreamName = response.container?.logStreamName;
        // Try to extract conversation ID from logs if job has started
        let conversationId = null;
        if (logStreamName && (status === "RUNNING" || status === "SUCCEEDED" || status === "FAILED")) {
            conversationId = await (0, aws_helpers_1.getConversationIdFromLogs)(logStreamName);
        }
        // Also try to extract from s3OutputPath
        if (!conversationId && response.s3OutputPath) {
            const pathParts = response.s3OutputPath.split("/").filter(Boolean);
            // Path format: s3://bucket/transformations/job-xxx/conversation-id/
            if (pathParts.length >= 4) {
                conversationId = pathParts[pathParts.length - 1] || null;
            }
        }
        let nextStep;
        switch (status) {
            case "SUBMITTED":
            case "RUNNABLE":
            case "STARTING":
                nextStep = "Job is queuing. Check again in 60 seconds.";
                break;
            case "RUNNING":
                nextStep = "Job is running. Check again in 60 seconds. Pre-built container means no install delays.";
                break;
            case "SUCCEEDED":
                nextStep = "Job completed successfully. Use ezt_get_results to retrieve the output.";
                break;
            case "FAILED":
                if (response.statusReason?.includes("timeout") || response.statusReason?.includes("timed out")) {
                    nextStep = `Job timed out. Resume with ezt_resume_job using conversationId: ${conversationId || "check CloudWatch logs"}. NEVER start a new job.`;
                }
                else {
                    nextStep = "Job failed. Check CloudWatch logs for details. Load troubleshooting guidance.";
                }
                break;
            default:
                nextStep = "Unknown status. Check again in 60 seconds.";
        }
        return {
            success: true,
            jobId: input.jobId,
            jobName: response.jobName,
            status,
            submittedAt: response.submittedAt,
            startedAt: response.startedAt,
            completedAt: response.completedAt,
            durationSeconds: response.duration,
            s3OutputPath: response.s3OutputPath,
            conversationId: conversationId || undefined,
            logStreamName,
            exitCode: response.container?.exitCode,
            nextStep,
        };
    }
    catch (err) {
        return {
            success: false,
            jobId: input.jobId,
            status: "ERROR",
            error: err.message || String(err),
            nextStep: "Check AWS credentials are valid and retry.",
        };
    }
}
//# sourceMappingURL=check-status.js.map