# Easytrieve to Modern Languages Transformation with AWS Transform Custom

## Summary

This repository provides Infrastructure as Code (IaC) to quickly set up an AWS environment for transforming Easytrieve code to modern languages using AWS Transform Custom. It deploys a ready-to-use EC2 instance with all necessary tools, permissions, and network configurations to start transforming your legacy Easytrieve applications immediately.

## What It Does

- Deploys an EC2 Linux instance (Amazon Linux 2023) with Git, Node.js, and ATX CLI pre-installed
- Configures IAM roles with full access to AWS Transform, Transform Custom, and S3
- Sets up VPC with private endpoints for secure AWS service access
- Enables SSM Session Manager for secure, keyless instance access
- Implements security best practices (EBS encryption, IMDSv2, least-privilege networking)

## Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         VPC (10.0.0.0/16)                   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Public Subnet (10.0.1.0/24)             │   │
│  │                                                      │   │
│  │  ┌────────────────────────────────────────────┐      │   │
│  │  │   EC2 Instance (Amazon Linux 2023)         │      │   │
│  │  │   - Git, Node.js, ATX CLI                  │      │   │
│  │  │   - IAM Role (Transform + S3 access)       │      │   │
│  │  │   - SSM Session Manager enabled            │      │   │
│  │  └────────────────────────────────────────────┘      │   │
│  │                      │                               │   │
│  │                      │ HTTPS (443)                   │   │
│  │                      ▼                               │   │
│  │  ┌────────────────────────────────────────────┐      │   │
│  │  │   VPC Endpoints (Private DNS enabled)      │      │   │
│  │  │   - Transform Custom Interface Endpoint    │      │   │
│  │  │   - S3 Gateway Endpoint                    │      │   │
│  │  └────────────────────────────────────────────┘      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Internet Gateway (for package downloads & SSM)             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
                    AWS Transform Custom
                    AWS S3
```

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured with credentials
- For CDK deployment:
  - Node.js 20+ installed
  - Python 3.8+ installed
  - AWS CDK CLI installed (`npm install -g aws-cdk`)

## Deployment Options

### Option 1: CloudFormation (Quickest)

```bash
aws cloudformation create-stack \
  --stack-name easytrieve-transform-stack \
  --template-body file://easytrieve-transform-stack.yaml \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

**Monitor deployment:**
```bash
aws cloudformation describe-stacks \
  --stack-name easytrieve-transform-stack \
  --region us-east-1 \
  --query 'Stacks[0].StackStatus'
```

### Option 2: AWS CDK

**1. Install dependencies:**
```bash
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**2. Bootstrap CDK (first time only):**
```bash
cdk bootstrap aws://ACCOUNT-ID/us-east-1
```

**3. Deploy:**
```bash
cdk deploy
```

## Getting Started with Easytrieve Transformation

Once deployed, connect to your instance and start transforming:

**1. Connect to the instance:**
```bash
# Get instance ID from stack outputs
aws cloudformation describe-stacks \
  --stack-name easytrieve-transform-stack \
  --query 'Stacks[0].Outputs[?OutputKey==`InstanceId`].OutputValue' \
  --output text

# Connect via SSM
aws ssm start-session --target <instance-id> --region us-east-1
```

**2. Verify installations:**
```bash
git --version
node --version
atx --version
aws sts get-caller-identity
```

**3. Follow AWS Transform Custom guide:**

Visit the [AWS Transform Custom Getting Started Guide](https://docs.aws.amazon.com/transform/latest/userguide/custom-get-started.html) to:
- Upload your Easytrieve source code to S3
- Configure transformation settings
- Run transformations using ATX CLI
- Review and download transformed code

**Example transformation workflow:**
```bash
# Upload Easytrieve code to S3
aws s3 cp my-easytrieve-code.ezt s3://my-bucket/source/

# Run transformation (example)
atx transform --source s3://my-bucket/source/ --target-language java

# Download results
aws s3 cp s3://my-bucket/output/ ./transformed-code/ --recursive
```

## What's Included

| Component | Details |
|-----------|---------|
| **EC2 Instance** | t3.medium, Amazon Linux 2023, 20GB encrypted EBS |
| **Pre-installed Tools** | Git, Node.js, NPM, ATX CLI, AWS CLI |
| **IAM Permissions** | Full access to Transform, Transform Custom, and S3 |
| **Network** | VPC with private endpoints for Transform Custom and S3 |
| **Security** | SSM Session Manager, IMDSv2, encrypted storage |
| **Region** | us-east-1 |

## Cleanup

**CloudFormation:**
```bash
aws cloudformation delete-stack \
  --stack-name easytrieve-transform-stack \
  --region us-east-1
```

**CDK:**
```bash
cdk destroy
```

## Cost Estimate

Approximate monthly costs (us-east-1):
- EC2 t3.medium: ~$30/month
- VPC Interface Endpoint: ~$7/month
- S3 storage: Variable
- **Total: ~$37/month** (excluding data transfer and S3 storage)

## Troubleshooting

**ATX CLI not found:**
```bash
# Check installation location
find /root -name "atx" -type f
# Add to PATH if needed
export PATH="$PATH:/root/.local/bin"
```

**Permission denied errors:**
```bash
# Verify IAM role
aws sts get-caller-identity
# Should show the EC2 instance role
```

**VPC endpoint connectivity:**
```bash
# Test Transform Custom endpoint
curl -I https://transform-custom.us-east-1.api.aws
# Should resolve to private IP (10.x.x.x)
```

## Support

For issues with:
- **Infrastructure deployment**: Check CloudFormation/CDK logs
- **AWS Transform Custom**: See [AWS Transform Documentation](https://docs.aws.amazon.com/transform/latest/userguide/)
- **Easytrieve transformation**: Refer to AWS Transform Custom user guide

## License

This code is provided as-is for use with AWS Transform Custom services.
