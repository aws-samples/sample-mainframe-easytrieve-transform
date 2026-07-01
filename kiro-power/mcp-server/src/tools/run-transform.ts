import { execSync } from "child_process";
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
  const tmpCheck = join(process.env.TEMP || "/tmp", `bre-check-${Date.now()}`);

  // HARD GATE: Download zip and verify bre-doc/ AND output-data/ are non-empty
  let breFileCount = 0;
  let outputFileCount = 0;

  try {
    execSync(`rmdir /s /q "${tmpCheck}" 2>nul & mkdir "${tmpCheck}"`, { stdio: "pipe", shell: "cmd.exe" });
    execSync(`aws s3 cp "${input.workspaceS3Path}" "${tmpCheck}/workspace.zip" --quiet`, { stdio: "pipe" });

    // Count files in bre-doc/ (excluding the directory entry itself)
    try {
      const breOutput = execSync(
        `powershell -Command "(Invoke-Expression 'tar -tf ${tmpCheck}/workspace.zip' | Select-String 'bre-doc/' | Where-Object { $_ -notmatch 'bre-doc/$' }).Count"`,
        { stdio: "pipe" }
      ).toString().trim();
      breFileCount = parseInt(breOutput) || 0;
    } catch {
      // Fallback for Linux/macOS
      try {
        const breOutput = execSync(
          `unzip -l "${tmpCheck}/workspace.zip" | grep "bre-doc/" | grep -v " bre-doc/$" | wc -l`,
          { stdio: "pipe" }
        ).toString().trim();
        breFileCount = parseInt(breOutput) || 0;
      } catch {
        breFileCount = 0;
      }
    }

    // Count files in output-data/ (excluding the directory entry itself)
    try {
      const outputOutput = execSync(
        `powershell -Command "(Invoke-Expression 'tar -tf ${tmpCheck}/workspace.zip' | Select-String 'output-data/' | Where-Object { $_ -notmatch 'output-data/$' }).Count"`,
        { stdio: "pipe" }
      ).toString().trim();
      outputFileCount = parseInt(outputOutput) || 0;
    } catch {
      try {
        const outputOutput = execSync(
          `unzip -l "${tmpCheck}/workspace.zip" | grep "output-data/" | grep -v " output-data/$" | wc -l`,
          { stdio: "pipe" }
        ).toString().trim();
        outputFileCount = parseInt(outputOutput) || 0;
      } catch {
        outputFileCount = 0;
      }
    }

    // Cleanup
    try { execSync(`rmdir /s /q "${tmpCheck}" 2>nul`, { stdio: "pipe", shell: "cmd.exe" }); } catch {}
    try { execSync(`rm -rf "${tmpCheck}"`, { stdio: "pipe" }); } catch {}
  } catch (err: any) {
    // If we can't even download/inspect the zip, BLOCK — don't silently proceed
    try { execSync(`rmdir /s /q "${tmpCheck}" 2>nul`, { stdio: "pipe", shell: "cmd.exe" }); } catch {}
    try { execSync(`rm -rf "${tmpCheck}"`, { stdio: "pipe" }); } catch {}
    return {
      success: false,
      jobName,
      blocked: true,
      error: `BLOCKED: Could not verify workspace contents. Error: ${err.message || err}`,
      nextStep: "Verify the S3 path is correct and you have access to the managed bucket.",
    };
  }

  // GATE 1: BRE must exist
  if (breFileCount === 0) {
    return {
      success: false,
      jobName,
      blocked: true,
      error: "BLOCKED: bre-doc/ folder is empty in the workspace. The Business Rule Extract must be generated and reviewed before transformation can proceed.",
      nextStep: "Run ezt_run_bre first to generate the BRE. After the user reviews and approves the BRE, re-prepare the workspace with the BRE included (pass breDocPath to ezt_prepare_workspace), then retry this tool.",
    };
  }

  // GATE 2: Baseline output must exist
  if (outputFileCount === 0) {
    return {
      success: false,
      jobName,
      blocked: true,
      error: "BLOCKED: output-data/ folder is empty. Baseline mainframe output files are required for functional validation.",
      nextStep: "Ask the user to provide baseline output files from their mainframe execution.",
    };
  }

  // Gates passed — submit the transformation job
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
