import { invokeLambda } from "../utils/aws-helpers";

interface ResumeJobInput {
  workspaceS3Path: string;
  conversationId: string;
  programName: string;
}

interface ResumeJobResult {
  success: boolean;
  jobId?: string;
  jobName: string;
  status?: string;
  s3OutputPath?: string;
  error?: string;
  nextStep: string;
}

export async function resumeJob(input: ResumeJobInput): Promise<ResumeJobResult> {
  const jobName = `${input.programName}-resume`;

  try {
    const payload = {
      source: input.workspaceS3Path,
      command: `atx --conversation-id ${input.conversationId}`,
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
        nextStep: "Resumed from interrupted session. Use ezt_check_status to monitor. The conversation continues where it left off — no work is repeated.",
      };
    } else {
      return {
        success: false,
        jobName,
        error: response.error || `Lambda returned status ${response.statusCode}`,
        nextStep: "Resume failed. Verify the conversationId is correct (30-day expiry). If expired, a new job must be submitted.",
      };
    }
  } catch (err: any) {
    return {
      success: false,
      jobName,
      error: err.message || String(err),
      nextStep: "Check AWS credentials and retry.",
    };
  }
}
