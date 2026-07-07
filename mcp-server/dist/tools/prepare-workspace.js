"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareWorkspace = prepareWorkspace;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
const aws_helpers_1 = require("../utils/aws-helpers");
async function prepareWorkspace(input) {
    const tmpDir = (0, path_1.join)(process.env.TEMP || "/tmp", `ezt-workspace-${input.programName}`);
    const zipPath = (0, path_1.join)(process.env.TEMP || "/tmp", `${input.programName}.zip`);
    try {
        // Clean previous workspace
        if ((0, fs_1.existsSync)(tmpDir)) {
            (0, fs_1.rmSync)(tmpDir, { recursive: true, force: true });
        }
        // Create 4-folder structure
        const sourceDir = (0, path_1.join)(tmpDir, "source-code");
        const inputDir = (0, path_1.join)(tmpDir, "input-data");
        const outputDir = (0, path_1.join)(tmpDir, "output-data");
        const breDir = (0, path_1.join)(tmpDir, "bre-doc");
        (0, fs_1.mkdirSync)(sourceDir, { recursive: true });
        (0, fs_1.mkdirSync)(inputDir, { recursive: true });
        (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        (0, fs_1.mkdirSync)(breDir, { recursive: true });
        // Sync from S3
        (0, child_process_1.execSync)(`aws s3 sync "${input.sourcePath}" "${sourceDir}" --quiet`, { stdio: "pipe" });
        (0, child_process_1.execSync)(`aws s3 sync "${input.inputDataPath}" "${inputDir}" --quiet`, { stdio: "pipe" });
        (0, child_process_1.execSync)(`aws s3 sync "${input.outputDataPath}" "${outputDir}" --quiet`, { stdio: "pipe" });
        if (input.breDocPath) {
            (0, child_process_1.execSync)(`aws s3 sync "${input.breDocPath}" "${breDir}" --quiet`, { stdio: "pipe" });
        }
        // Initialize git in source-code (required by atx)
        try {
            (0, child_process_1.execSync)("git init && git add . && git commit -m initial --allow-empty", {
                cwd: sourceDir,
                stdio: "pipe",
            });
        }
        catch {
            // Git might already be initialized
        }
        // Count files
        const countFiles = (dir) => {
            try {
                const output = (0, child_process_1.execSync)(`find "${dir}" -type f | wc -l`, { stdio: "pipe" }).toString().trim();
                return parseInt(output) || 0;
            }
            catch {
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
        if ((0, fs_1.existsSync)(zipPath)) {
            (0, fs_1.rmSync)(zipPath);
        }
        (0, child_process_1.execSync)(`cd "${tmpDir}" && zip -r "${zipPath}" source-code/ bre-doc/ input-data/ output-data/`, {
            stdio: "pipe",
        });
        // Upload to managed S3 bucket
        const accountId = await (0, aws_helpers_1.getAccountId)();
        const bucket = (0, aws_helpers_1.getSourceBucket)(accountId);
        const s3Key = `repos/${input.programName}.zip`;
        (0, child_process_1.execSync)(`aws s3 cp "${zipPath}" "s3://${bucket}/${s3Key}" --quiet`, { stdio: "pipe" });
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
    }
    catch (err) {
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
//# sourceMappingURL=prepare-workspace.js.map