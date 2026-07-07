import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkPrereqs } from "./tools/check-prereqs";
import { prepareWorkspace } from "./tools/prepare-workspace";
import { runBre } from "./tools/run-bre";
import { runTransform } from "./tools/run-transform";
import { checkStatus } from "./tools/check-status";
import { resumeJob } from "./tools/resume-job";
import { getResults } from "./tools/get-results";
import { runBatch } from "./tools/run-batch";

const server = new McpServer({
  name: "ezt-transform-mcp",
  version: "1.2.0",
});

// Tool 1: Check prerequisites
server.tool(
  "ezt_check_prereqs",
  "Verify all prerequisites for EZT transformation: AWS credentials, remote infrastructure (AtxInfrastructureStack), pre-built container image, and published transformation definitions. Returns structured pass/fail for each check.",
  {},
  async () => {
    const result = await checkPrereqs();
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Tool 2: Prepare workspace
server.tool(
  "ezt_prepare_workspace",
  "Prepare an EZT transformation workspace: downloads source/input/output from S3, organizes into the 4-folder structure, initializes git, zips, and uploads to the managed S3 bucket. Returns the S3 path for job submission.",
  {
    sourcePath: z.string().describe("S3 path to EZT source files (.ezt, .jcl, .mac)"),
    inputDataPath: z.string().describe("S3 path to mainframe input data files (EBCDIC)"),
    outputDataPath: z.string().describe("S3 path to baseline mainframe output files (EBCDIC)"),
    breDocPath: z.string().optional().describe("S3 path to BRE document (if already generated)"),
    programName: z.string().describe("Name for this program/workload (used in job naming)"),
  },
  async ({ sourcePath, inputDataPath, outputDataPath, breDocPath, programName }) => {
    const result = await prepareWorkspace({ sourcePath, inputDataPath, outputDataPath, breDocPath, programName });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Tool 3: Run BRE extraction
server.tool(
  "ezt_run_bre",
  "Submit a Business Rule Extract (BRE) generation job via Lambda+Batch. The BRE must be generated and human-reviewed before transformation can proceed. Returns the job ID for monitoring.",
  {
    workspaceS3Path: z.string().describe("S3 path to the prepared workspace zip (from ezt_prepare_workspace)"),
    programName: z.string().describe("Program name for job identification"),
  },
  async ({ workspaceS3Path, programName }) => {
    const result = await runBre({ workspaceS3Path, programName });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Tool 4: Run transformation
server.tool(
  "ezt_run_transform",
  "Submit an EZT-to-Java transformation job via Lambda+Batch. HARD GATE: This tool will REFUSE to run if the workspace does not contain a non-empty bre-doc/ folder. The BRE step must be completed first. Returns job ID for monitoring.",
  {
    workspaceS3Path: z.string().describe("S3 path to the prepared workspace zip (must include non-empty bre-doc/)"),
    programName: z.string().describe("Program name for job identification"),
  },
  async ({ workspaceS3Path, programName }) => {
    const result = await runTransform({ workspaceS3Path, programName });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Tool 5: Check job status
server.tool(
  "ezt_check_status",
  "Check the status of a running EZT transformation or BRE job. Returns status, duration, conversation ID (for recovery), and log stream name.",
  {
    jobId: z.string().describe("The batchJobId returned from ezt_run_bre or ezt_run_transform"),
  },
  async ({ jobId }) => {
    const result = await checkStatus({ jobId });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Tool 6: Resume interrupted job
server.tool(
  "ezt_resume_job",
  "Resume an interrupted transformation job using its conversation ID. Use when a job timed out or token expired. NEVER start a new job when one was interrupted — always resume.",
  {
    workspaceS3Path: z.string().describe("S3 path to the workspace zip"),
    conversationId: z.string().describe("Conversation ID from the interrupted job (from ezt_check_status or S3 output path)"),
    programName: z.string().describe("Program name for the resume job"),
  },
  async ({ workspaceS3Path, conversationId, programName }) => {
    const result = await resumeJob({ workspaceS3Path, conversationId, programName });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Tool 7: Get results
server.tool(
  "ezt_get_results",
  "Retrieve the results of a completed transformation job. Returns the S3 paths to code.zip and logs.zip, validation status, and download commands.",
  {
    jobId: z.string().describe("The batchJobId of the completed job"),
  },
  async ({ jobId }) => {
    const result = await getResults({ jobId });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

// Tool 8: Run batch transformation
server.tool(
  "ezt_run_batch",
  "Submit multiple EZT programs for parallel transformation. Each program must have its own workspace zip with non-empty bre-doc/. Up to 128 concurrent. Returns batch ID for monitoring.",
  {
    jobs: z.array(z.object({
      workspaceS3Path: z.string().describe("S3 path to workspace zip for this program"),
      programName: z.string().describe("Program name"),
    })).describe("Array of programs to transform in parallel"),
  },
  async ({ jobs }) => {
    const result = await runBatch({ jobs });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
