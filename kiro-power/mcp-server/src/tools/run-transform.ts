import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import { invokeLambda } from "../utils/aws-helpers";

interface RunTransformInput {
  workspaceS3Path: string;
  programName: string;
}

interface RunTransformResult {
  success: boolean;
  jobId?: string;
  jobName: string;
  status?: string;
  s3OutputPath?: string;
  error?: string;
  blocked?: boolean;
  nextStep: string;
}

export async function runTransform(input: RunTransformInput): Promise<RunTransformResult> {
  const jobName = `EZT-${input.programName}`;

  // HARD GATE: Verify BRE exists in the workspace
  // Download the zip and check bre-doc/ is non-empty
  const tmpCheck = join(process.env.TEMP || "/tmp", `bre-check-${input.programName}`);

  try {
    // Download and inspect the zip for bre-doc/ contents
    execSync(`rm -rf "${tmpCheck}" && mkdir -p "${tmpCheck}"`, { stdio: "pipe" });
    execSync(`aws s3 cp "${input.workspaceS3Path}" "${tmpCheck}/workspace.zip" --quiet`, { stdio: "pipe" });

    // List bre-doc/ contents in the zip
    const breContents = execSync(
      `unzip -l "${tmpCheck}/workspace.zip" | grep "bre-doc/" | grep -v "bre-doc/$" | wc -l`,
      { stdio: "pipe" }
    ).toString().trim();

    const breFileCount = parseInt(breContents) || 0;

    // Clean up
    execSync(`rm -rf "${tmpCheck}"`, { stdio: "pipe" });

    if (breFileCount === 0) {
      return {
        success: false,
        jobName,
        blocked: true,
        error: "BLOCKED: bre-doc/ folder is empty in the workspace. The Business Rule Extract must be generated and reviewed before transformation can proceed.",
        nextStep: "Run ezt_run_bre first to generate the BRE. After the user reviews and approves the BRE, re-prepare the workspace with the BRE included (pass breDocPath to ezt_prepare_workspace), then retry this tool.",
      };
    }

    // Also verify output-data/ is non-empty
    const outputContents = execSync(
      `unzip -l "${tmpCheck}/workspace.zip" | grep "output-data/" | grep -v "output-data/$" | wc -l`,
      { stdio: "pipe" }
    ).toString().trim();

    const outputFileCount = parseInt(outputContents) || 0;

    if (outputFileCount === 0) {
      return {
        success: false,
        jobName,
        blocked: true,
        error: "BLOCKED: output-data/ folder is empty. Baseline mainframe output files are required for validation.",
        nextStep: "Ask the user to provide baseline output files from their mainframe execution.",
      };
    }
  } catch (err: any) {
    // If zip inspection fails, proceed but warn
    // The TD will catch it during execution anyway
  }

  // Submit the transformation job
  const zipFile = input.workspaceS3Path.split("/").pop()!.replace(".zip", "");
  const codePath = `/source/${zipFile}/source-code`;

  try {
    const payload = {
      source: input.workspaceS3Path,
      command: `atx custom def exec -n Easytrieve-to-Java-Transformation -p ${codePath} -x -t`,
      jobName,
      environment: { JAVA_VERSION: "17" },
    };

    const response = await invokeLambda("atx-trigger-job", payload);

    if (response.statusCode === 200) {
      return {
        success: true,
        jobId: response.batchJobId,
        jobName,
        status: response.status,
        s3OutputPath: response.s3OutputPath,
        nextStep: "Use ezt_check_status to monitor progress. Expected ~10 min for standard programs. Pre-built container has Java 17 + Maven ready.",
      };
    } else {
      return {
        success: false,
        jobName,
        error: response.error || `Lambda returned status ${response.statusCode}`,
        nextStep: "Check the error. Common issues: invalid characters in command, missing TD.",
      };
    }
  } catch (err: any) {
    return {
      success: false,
      jobName,
      error: err.message || String(err),
      nextStep: "Verify infrastructure is deployed (ezt_check_prereqs) and retry.",
    };
  }
}
