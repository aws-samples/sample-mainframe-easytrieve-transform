"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBre = runBre;
const aws_helpers_1 = require("../utils/aws-helpers");
async function runBre(input) {
    const jobName = `BRE-${input.programName}`;
    // Extract the zip filename to determine the source path inside the container
    const zipFile = input.workspaceS3Path.split("/").pop().replace(".zip", "");
    const codePath = `/source/${zipFile}/source-code`;
    try {
        const payload = {
            source: input.workspaceS3Path,
            command: `atx custom def exec -n Easytrieve-Business-Rule-Extract -p ${codePath} -x -t`,
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
                nextStep: "Use ezt_check_status to monitor. Once SUCCEEDED, download the BRE from the output S3 path, review it with the user, then include it in the workspace for transformation.",
            };
        }
        else {
            return {
                success: false,
                jobName,
                error: response.error || `Lambda returned status ${response.statusCode}`,
                nextStep: "Check the error and retry. Common issues: invalid command characters, missing TD.",
            };
        }
    }
    catch (err) {
        return {
            success: false,
            jobName,
            error: err.message || String(err),
            nextStep: "Verify infrastructure is deployed (ezt_check_prereqs) and retry.",
        };
    }
}
//# sourceMappingURL=run-bre.js.map