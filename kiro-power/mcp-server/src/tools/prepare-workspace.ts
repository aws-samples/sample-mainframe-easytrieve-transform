import { execSync } from "child_process";
import { mkdirSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { getAccountId, getSourceBucket } from "../utils/aws-helpers";

interface PrepareInput {
  sourcePath: string;
  inputDataPath: string;
  outputDataPath: string;
  breDocPath?: string;
  programName: string;
}

interface PrepareResult {
  success: boolean;
  workspaceS3Path: string;
  workspaceLocalPath: string;
  sourceFileCount: number;
  inputFileCount: number;
  outputFileCount: number;
  breFileCount: number;
  error?: string;
}

export async function prepareWorkspace(input: PrepareInput): Promise<PrepareResult> {
  const tmpDir = join(process.env.TEMP || "/tmp", `ezt-workspace-${input.programName}`);
  const zipPath = join(process.env.TEMP || "/tmp", `${input.programName}.zip`);

  try {
    // Clean previous workspace
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }

    // Create 4-folder structure
    const sourceDir = join(tmpDir, "source-code");
    const inputDir = join(tmpDir, "input-data");
    const outputDir = join(tmpDir, "output-data");
    const breDir = join(tmpDir, "bre-doc");

    mkdirSync(sourceDir, { recursive: true });
    mkdirSync(inputDir, { recursive: true });
    mkdirSync(outputDir, { recursive: true });
    mkdirSync(breDir, { recursive: true });

    // Sync from S3
    execSync(`aws s3 sync "${input.sourcePath}" "${sourceDir}" --quiet`, { stdio: "pipe" });
    execSync(`aws s3 sync "${input.inputDataPath}" "${inputDir}" --quiet`, { stdio: "pipe" });
    execSync(`aws s3 sync "${input.outputDataPath}" "${outputDir}" --quiet`, { stdio: "pipe" });

    if (input.breDocPath) {
      execSync(`aws s3 sync "${input.breDocPath}" "${breDir}" --quiet`, { stdio: "pipe" });
    }

    // Initialize git in source-code (required by atx)
    try {
      execSync("git init && git add . && git commit -m initial --allow-empty", {
        cwd: sourceDir,
        stdio: "pipe",
      });
    } catch {
      // Git might already be initialized
    }

    // Count files
    const countFiles = (dir: string): number => {
      try {
        const output = execSync(`find "${dir}" -type f | wc -l`, { stdio: "pipe" }).toString().trim();
        return parseInt(output) || 0;
      } catch {
        return 0;
      }
    };

    const sourceFileCount = countFiles(sourceDir);
    const inputFileCount = countFiles(inputDir);
    const outputFileCount = countFiles(outputDir);
    const breFileCount = countFiles(breDir);

    // Validate: must have source and output at minimum
    if (sourceFileCount === 0) {
      return {
        success: false,
        workspaceS3Path: "",
        workspaceLocalPath: tmpDir,
        sourceFileCount: 0,
        inputFileCount,
        outputFileCount,
        breFileCount,
        error: "No source files found at the provided S3 path.",
      };
    }

    if (outputFileCount === 0) {
      return {
        success: false,
        workspaceS3Path: "",
        workspaceLocalPath: tmpDir,
        sourceFileCount,
        inputFileCount,
        outputFileCount: 0,
        breFileCount,
        error: "No baseline output files found. These are required for functional validation.",
      };
    }

    // Zip the workspace
    if (existsSync(zipPath)) {
      rmSync(zipPath);
    }
    execSync(`cd "${tmpDir}" && zip -r "${zipPath}" source-code/ bre-doc/ input-data/ output-data/`, {
      stdio: "pipe",
    });

    // Upload to managed S3 bucket
    const accountId = await getAccountId();
    const bucket = getSourceBucket(accountId);
    const s3Key = `repos/${input.programName}.zip`;

    execSync(`aws s3 cp "${zipPath}" "s3://${bucket}/${s3Key}" --quiet`, { stdio: "pipe" });

    const workspaceS3Path = `s3://${bucket}/${s3Key}`;

    return {
      success: true,
      workspaceS3Path,
      workspaceLocalPath: tmpDir,
      sourceFileCount,
      inputFileCount,
      outputFileCount,
      breFileCount,
    };
  } catch (err: any) {
    return {
      success: false,
      workspaceS3Path: "",
      workspaceLocalPath: tmpDir,
      sourceFileCount: 0,
      inputFileCount: 0,
      outputFileCount: 0,
      breFileCount: 0,
      error: err.message || String(err),
    };
  }
}
