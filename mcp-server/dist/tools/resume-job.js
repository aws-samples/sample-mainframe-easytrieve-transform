"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumeJob = resumeJob;
const aws_helpers_1 = require("../utils/aws-helpers");
async function resumeJob(input) {
    const jobName = `${input.programName}-resume`;
    try {
        const payload = {
            source: input.workspaceS3Path,
            command: `atx --conversation-id ${input.conversationId}`,
            jobName,
            environment: { JAVA_VERSION: "17" },
        };
        const response = await (0, aws_helpers_1.invokeLambda)("atx-trigger-job", payload);
        if (response.statusCode === 200) {
            return {
                success: true,
                jobId: response.batchJobId,
                jobName,
                status: response.status,
                s3OutputPath: response.s3OutputPath,
                nextStep: "Resumed from interrupted session. Use ezt_check_status to monitor. The conversation continues where it left off — no work is repeated.",
            };
        }
        else {
            return {
                success: false,
                jobName,
                error: response.error || `Lambda returned status ${response.statusCode}`,
                nextStep: "Resume failed. Verify the conversationId is correct (30-day expiry). If expired, a new job must be submitted.",
            };
        }
    }
    catch (err) {
        return {
            success: false,
            jobName,
            error: err.message || String(err),
            nextStep: "Check AWS credentials and retry.",
        };
    }
}
//# sourceMappingURL=resume-job.js.map