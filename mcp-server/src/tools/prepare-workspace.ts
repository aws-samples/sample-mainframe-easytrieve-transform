import { execSync } from "child_process";
import { mkdirSync, existsSync, rmSync, readdirSync, createWriteStream } from "fs";
import { join } from "path";
import archiver from "archiver";
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

/**
 * Recursively count files in a directory (cross-platform).
 * Replaces: execSync(`find "${dir}" -type f | wc -l`)
 */
function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  function walk(d: string) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const fullPath = join(d, entry.name);
      if (entry.isFile()) {
        count++;
      } else if (entry.isDirectory()) {
        walk(fullPath);
      }
    }
  }
  walk(dir);
  return count;
}

/**
 * Create a zip archive with forward-slash paths (cross-platform).
 * Replaces: execSync(`cd "${tmpDir}" && zip -r "${zipPath}" ...`)
 * Uses the archiver library which always writes forward-slash entry paths
 * regardless of the host OS.
 */
function zipWorkspace(tmpDir: string, zipPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 6 } });

    output.on("close", () => resolve());
    archive.on("error", (err) => reject(err));
    archive.pipe(output);

    for (const folder of ["source-code", "bre-doc", "input-data", "output-data"]) {
      const dirPath = join(tmpDir, folder);
      if (existsSync(dirPath)) {
        archive.directory(dirPath, folder);
      }
    }

    archive.finalize();
  });
}

export async function prepareWorkspace(input: PrepareInput): Promise<PrepareResult> {
  const tmpDir = join(process.env.TEMP || process.env.TMPDIR || "/tmp", `ezt-workspace-${input.programName}`);
  const zipPath = join(process.env.TEMP || process.env.TMPDIR || "/tmp", `${input.programName}.zip`);

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

    // Sync from S3 (aws CLI works cross-platform)
    execSync(`aws s3 sync "${input.sourcePath}" "${sourceDir}" --quiet`, { stdio: "pipe" });
    execSync(`aws s3 sync "${input.inputDataPath}" "${inputDir}" --quiet`, { stdio: "pipe" });
    execSync(`aws s3 sync "${input.outputDataPath}" "${outputDir}" --quiet`, { stdio: "pipe" });

    if (input.breDocPath) {
      execSync(`aws s3 sync "${input.breDocPath}" "${breDir}" --quiet`, { stdio: "pipe" });
    }

    // Initialize git in source-code (required by atx)
    // Use separate commands for Windows compatibility (no && chaining in cmd)
    try {
      execSync("git init", { cwd: sourceDir, stdio: "pipe" });
      execSync("git add .", { cwd: sourceDir, stdio: "pipe" });
      execSync('git commit -m "initial" --allow-empty', { cwd: sourceDir, stdio: "pipe" });
    } catch {
      // Git might already be initialized — safe to ignore
    }

    // Count files (cross-platform using Node.js fs)
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

    // Zip the workspace (cross-platform using archiver — always forward-slash paths)
    if (existsSync(zipPath)) {
      rmSync(zipPath);
    }
    await zipWorkspace(tmpDir, zipPath);

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
