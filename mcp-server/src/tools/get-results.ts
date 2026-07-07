import { invokeLambda, getAccountId, getOutputBucket, listS3Objects } from "../utils/aws-helpers";

interface GetResultsInput {
  jobId: string;
}

interface GetResultsResult {
  success: boolean;
  jobId: string;
  jobName?: string;
  status: string;
  validationPassed?: boolean;
  s3OutputPath?: string;
  artifacts: string[];
  downloadCommands: string[];
  dashboardUrl: string;
  error?: string;
}

export async function getResults(input: GetResultsInput): Promise<GetResultsResult> {
  const region = process.env.AWS_REGION || "us-east-1";
  const dashboardUrl = `https://${region}.console.aws.amazon.com/cloudwatch/home#dashboards/dashboard/ATX-Transform-CLI-Dashboard`;

  try {
    // Get job status to confirm completion and get output path
    const statusResponse = await invokeLambda("atx-get-job-status", { jobId: input.jobId });

    if (statusResponse.status !== "SUCCEEDED") {
      return {
        success: false,
        jobId: input.jobId,
        jobName: statusResponse.jobName,
        status: statusResponse.status,
        artifacts: [],
        downloadCommands: [],
        dashboardUrl,
        error: `Job is not complete. Current status: ${statusResponse.status}. Use ezt_check_status to monitor.`,
      };
    }

    const s3OutputPath = statusResponse.s3OutputPath;
    const accountId = await getAccountId();
    const outputBucket = getOutputBucket(accountId);

    // List objects in the output path
    const prefix = s3OutputPath.replace(`s3://${outputBucket}/`, "");
    const objects = await listS3Objects(outputBucket, prefix);

    // Determine validation result from exit code
    const validationPassed = statusResponse.container?.exitCode === 0;

    // Build download commands
    const downloadCommands = objects.map(
      (key) => `aws s3 cp s3://${outputBucket}/${key} ./${key.split("/").pop()}`
    );

    return {
      success: true,
      jobId: input.jobId,
      jobName: statusResponse.jobName,
      status: "SUCCEEDED",
      validationPassed,
      s3OutputPath,
      artifacts: objects.map((key) => key.split("/").pop()!),
      downloadCommands,
      dashboardUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      jobId: input.jobId,
      status: "ERROR",
      artifacts: [],
      downloadCommands: [],
      dashboardUrl,
      error: err.message || String(err),
    };
  }
}
