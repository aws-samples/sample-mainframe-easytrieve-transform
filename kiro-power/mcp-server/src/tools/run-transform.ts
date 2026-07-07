import { execSync } from "child_process";
import { join } from "path";
import { existsSync, mkdirSync, rmSync, readFileSync } from "fs";
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

/**
 * Count entries matching a prefix in a zip file by reading the central directory.
 * Cross-platform — uses Node.js Buffer to parse the zip file listing.
 * This avoids platform-specific `unzip -l` or `tar -tf` commands.
 */
function countZipEntriesWithPrefix(zipPath: string, prefix: string): number {
  try {
    const buf = readFileSync(zipPath);
    let count = 0;

    // Find End of Central Directory record (last 22+ bytes of file)
    let eocdOffset = -1;
    for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65557; i--) {
      if (buf.readUInt32LE(i) === 0x06054b50) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset === -1) return 0;

    const centralDirOffset = buf.readUInt32LE(eocdOffset + 16);
    const totalEntries = buf.readUInt16LE(eocdOffset + 10);

    let offset = centralDirOffset;
    for (let i = 0; i < totalEntries && offset < buf.length; i++) {
      if (buf.readUInt32LE(offset) !== 0x02014b50) break;

      const fileNameLen = buf.readUInt16LE(offset + 28);
      const extraLen = buf.readUInt16LE(offset + 30);
      const commentLen = buf.readUInt16LE(offset + 32);

      const fileName = buf.slice(offset + 46, offset + 46 + fileNameLen).toString("utf-8");

      // Count files (not directories) that start with the prefix
      if (fileName.startsWith(prefix) && !fileName.endsWith("/")) {
        count++;
      }

      offset += 46 + fileNameLen + extraLen + commentLen;
    }

    return count;
  } catch {
    return 0;
  }
}

export async function runTransform(input: RunTransformInput): Promise<RunTransformResult> {
  const jobName = `EZT-${input.programName}`;
  const tmpCheck = join(process.env.TEMP || process.env.TMPDIR || "/tmp", `bre-check-${Date.now()}`);

  // HARD GATE: Download zip and verify bre-doc/ AND output-data/ are non-empty
  let breFileCount = 0;
  let outputFileCount = 0;

  try {
    // Create temp dir (cross-platform)
    if (existsSync(tmpCheck)) {
      rmSync(tmpCheck, { recursive: true, force: true });
    }
    mkdirSync(tmpCheck, { recursive: true });

    // Download the workspace zip
    const zipFile = join(tmpCheck, "workspace.zip");
    execSync(`aws s3 cp "${input.workspaceS3Path}" "${zipFile}" --quiet`, { stdio: "pipe" });

    // Count files in bre-doc/ and output-data/ using cross-platform zip reading
    breFileCount = countZipEntriesWithPrefix(zipFile, "bre-doc/");
    outputFileCount = countZipEntriesWithPrefix(zipFile, "output-data/");

    // Cleanup
    rmSync(tmpCheck, { recursive: true, force: true });
  } catch (err: any) {
    // Cleanup on error
    try { rmSync(tmpCheck, { recursive: true, force: true }); } catch {}

    // If we can't even download/inspect the zip, BLOCK — don't silently proceed
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
  const zipFileName = input.workspaceS3Path.split("/").pop()!.replace(".zip", "");
  const codePath = `/source/${zipFileName}/source-code`;

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
