"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBatch = runBatch;
const aws_helpers_1 = require("../utils/aws-helpers");
async function runBatch(input) {
    const batchName = `EZT-Batch-${Date.now()}`;
    if (input.jobs.length === 0) {
        return {
            success: false,
            batchName,
            jobCount: 0,
            error: "No jobs provided.",
            nextStep: "Provide at least one job with workspaceS3Path and programName.",
        };
    }
    if (input.jobs.length > 128) {
        return {
            success: false,
            batchName,
            jobCount: input.jobs.length,
            error: `Too many jobs (${input.jobs.length}). Maximum 128 per batch. Split into multiple batches.`,
            nextStep: "Split the jobs array into chunks of 128 and submit each chunk separately.",
        };
    }
    // Build the batch payload
    const batchJobs = input.jobs.map((job) => {
        const zipFile = job.workspaceS3Path.split("/").pop().replace(".zip", "");
        const codePath = `/source/${zipFile}/source-code`;
        return {
            source: job.workspaceS3Path,
            command: `atx custom def exec -n Easytrieve-to-Java-Transformation -p ${codePath} -x -t`,
            jobName: `EZT-${job.programName}`,
            environment: { JAVA_VERSION: "17" },
        };
    });
    try {
        const payload = {
            batchName,
            jobs: batchJobs,
        };
        const response = await (0, aws_helpers_1.invokeLambda)("atx-trigger-batch-jobs", payload);
        if (response.statusCode === 200) {
            return {
                success: true,
                batchId: response.batchId,
                batchName,
                jobCount: input.jobs.length,
                status: "SUBMITTED",
                nextStep: `Batch submitted with ${input.jobs.length} jobs. Monitor with: aws lambda invoke --function-name atx-get-batch-status --payload '{"batchId":"${response.batchId}"}'. All jobs run in parallel (~10 min regardless of count).`,
            };
        }
        else {
            return {
                success: false,
                batchName,
                jobCount: input.jobs.length,
                error: response.error || `Lambda returned status ${response.statusCode}`,
                nextStep: "Check the error. Common issues: invalid characters in command strings, missing TD.",
            };
        }
    }
    catch (err) {
        return {
            success: false,
            batchName,
            jobCount: input.jobs.length,
            error: err.message || String(err),
            nextStep: "Verify infrastructure is deployed and retry.",
        };
    }
}
//# sourceMappingURL=run-batch.js.map