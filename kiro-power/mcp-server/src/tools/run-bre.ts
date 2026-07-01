import { invokeLambda } from "../utils/aws-helpers";

interface RunBreInput {
  workspaceS3Path: string;
  programName: string;
}

interface RunBreResult {
  success: boolean;
  jobId?: string;
  jobName: string;
  status?: string;
  s3OutputPath?: string;
  error?: string;
  nextStep: string;
}

export async function runBre(input: RunBreInput): Promise<RunBreResult> {
  const jobName = `BRE-${input.programName}`;

  // Extract the zip filename to determine the source path inside the container
  const zipFile = input.workspaceS3Path.split("/").pop()!.replace(".zip", "");
  const codePath = `/source/${zipFile}/source-code`;

  try {
    const payload = {
      source: input.workspaceS3Path,
      command: `atx custom def exec -n Easytrieve-Business-Rule-Extract -p ${codePath} -x -t`,
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
        nextStep: "Use ezt_check_status to monitor. Once SUCCEEDED, download the BRE from the output S3 path, review it with the user, then include it in the workspace for transformation.",
      };
    } else {
      return {
        success: false,
        jobName,
        error: response.error || `Lambda returned status ${response.statusCode}`,
        nextStep: "Check the error and retry. Common issues: invalid command characters, missing TD.",
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
