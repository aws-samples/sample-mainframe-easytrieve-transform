"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const check_prereqs_1 = require("./tools/check-prereqs");
const prepare_workspace_1 = require("./tools/prepare-workspace");
const run_bre_1 = require("./tools/run-bre");
const run_transform_1 = require("./tools/run-transform");
const check_status_1 = require("./tools/check-status");
const resume_job_1 = require("./tools/resume-job");
const get_results_1 = require("./tools/get-results");
const run_batch_1 = require("./tools/run-batch");
const server = new mcp_js_1.McpServer({
    name: "ezt-transform-mcp",
    version: "1.2.0",
});
// Tool 1: Check prerequisites
server.tool("ezt_check_prereqs", "Verify all prerequisites for EZT transformation: AWS credentials, remote infrastructure (AtxInfrastructureStack), pre-built container image, and published transformation definitions. Returns structured pass/fail for each check.", {}, async () => {
    const result = await (0, check_prereqs_1.checkPrereqs)();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});
// Tool 2: Prepare workspace
server.tool("ezt_prepare_workspace", "Prepare an EZT transformation workspace: downloads source/input/output from S3, organizes into the 4-folder structure, initializes git, zips, and uploads to the managed S3 bucket. Returns the S3 path for job submission.", {
    sourcePath: zod_1.z.string().describe("S3 path to EZT source files (.ezt, .jcl, .mac)"),
    inputDataPath: zod_1.z.string().describe("S3 path to mainframe input data files (EBCDIC)"),
    outputDataPath: zod_1.z.string().describe("S3 path to baseline mainframe output files (EBCDIC)"),
    breDocPath: zod_1.z.string().optional().describe("S3 path to BRE document (if already generated)"),
    programName: zod_1.z.string().describe("Name for this program/workload (used in job naming)"),
}, async ({ sourcePath, inputDataPath, outputDataPath, breDocPath, programName }) => {
    const result = await (0, prepare_workspace_1.prepareWorkspace)({ sourcePath, inputDataPath, outputDataPath, breDocPath, programName });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});
// Tool 3: Run BRE extraction
server.tool("ezt_run_bre", "Submit a Business Rule Extract (BRE) generation job via Lambda+Batch. The BRE must be generated and human-reviewed before transformation can proceed. Returns the job ID for monitoring.", {
    workspaceS3Path: zod_1.z.string().describe("S3 path to the prepared workspace zip (from ezt_prepare_workspace)"),
    programName: zod_1.z.string().describe("Program name for job identification"),
}, async ({ workspaceS3Path, programName }) => {
    const result = await (0, run_bre_1.runBre)({ workspaceS3Path, programName });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});
// Tool 4: Run transformation
server.tool("ezt_run_transform", "Submit an EZT-to-Java transformation job via Lambda+Batch. HARD GATE: This tool will REFUSE to run if the workspace does not contain a non-empty bre-doc/ folder. The BRE step must be completed first. Returns job ID for monitoring.", {
    workspaceS3Path: zod_1.z.string().describe("S3 path to the prepared workspace zip (must include non-empty bre-doc/)"),
    programName: zod_1.z.string().describe("Program name for job identification"),
}, async ({ workspaceS3Path, programName }) => {
    const result = await (0, run_transform_1.runTransform)({ workspaceS3Path, programName });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});
// Tool 5: Check job status
server.tool("ezt_check_status", "Check the status of a running EZT transformation or BRE job. Returns status, duration, conversation ID (for recovery), and log stream name.", {
    jobId: zod_1.z.string().describe("The batchJobId returned from ezt_run_bre or ezt_run_transform"),
}, async ({ jobId }) => {
    const result = await (0, check_status_1.checkStatus)({ jobId });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});
// Tool 6: Resume interrupted job
server.tool("ezt_resume_job", "Resume an interrupted transformation job using its conversation ID. Use when a job timed out or token expired. NEVER start a new job when one was interrupted — always resume.", {
    workspaceS3Path: zod_1.z.string().describe("S3 path to the workspace zip"),
    conversationId: zod_1.z.string().describe("Conversation ID from the interrupted job (from ezt_check_status or S3 output path)"),
    programName: zod_1.z.string().describe("Program name for the resume job"),
}, async ({ workspaceS3Path, conversationId, programName }) => {
    const result = await (0, resume_job_1.resumeJob)({ workspaceS3Path, conversationId, programName });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});
// Tool 7: Get results
server.tool("ezt_get_results", "Retrieve the results of a completed transformation job. Returns the S3 paths to code.zip and logs.zip, validation status, and download commands.", {
    jobId: zod_1.z.string().describe("The batchJobId of the completed job"),
}, async ({ jobId }) => {
    const result = await (0, get_results_1.getResults)({ jobId });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});
// Tool 8: Run batch transformation
server.tool("ezt_run_batch", "Submit multiple EZT programs for parallel transformation. Each program must have its own workspace zip with non-empty bre-doc/. Up to 128 concurrent. Returns batch ID for monitoring.", {
    jobs: zod_1.z.array(zod_1.z.object({
        workspaceS3Path: zod_1.z.string().describe("S3 path to workspace zip for this program"),
        programName: zod_1.z.string().describe("Program name"),
    })).describe("Array of programs to transform in parallel"),
}, async ({ jobs }) => {
    const result = await (0, run_batch_1.runBatch)({ jobs });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main().catch(console.error);
//# sourceMappingURL=index.js.map