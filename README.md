# Easytrieve to Modern Languages Transformation with AWS Transform Custom

## Important Notice

**This infrastructure template is provided as a reference implementation.** Before deploying to production, conduct a comprehensive security review, penetration testing, IAM audit, and compliance validation. Consult with your security and cloud architecture teams to ensure alignment with your organization's policies and requirements.

## Summary

This repository provides Infrastructure as Code (IaC) to deploy a secure AWS environment for transforming Easytrieve code to modern languages using AWS Transform Custom. It creates a fully private EC2 instance with all necessary tools, permissions, and network configurations following AWS security best practices.

## What It Does

- Deploys an EC2 Linux instance (Amazon Linux 2023) in a **private subnet** with Git, Node.js, and ATX CLI pre-installed
- Configures IAM roles with least-privilege access to AWS Transform, Transform Custom, and S3
- Sets up VPC with **NAT Gateway** for secure outbound internet access (ATX CLI installation)
- Implements **4 VPC endpoints** for private AWS service connectivity (Transform Custom, SSM, S3)
- Enables SSM Session Manager for secure, keyless instance access
- Implements enterprise-grade security (EBS encryption, IMDSv2, no public IP, VPC endpoint policies)

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      VPC (10.0.0.0/16)                          │
│                                                                 │
│  ┌──────────────────────┐      ┌──────────────────────────┐     │
│  │  Public Subnet       │      │  Private Subnet          │     │
│  │  (10.0.1.0/24)       │      │  (10.0.2.0/24)           │     │
│  │                      │      │                          │     │
│  │  ┌────────────────┐  │      │  ┌────────────────────┐  │     │
│  │  │  NAT Gateway   │◄─┼──────┼──│  EC2 Instance      │  │     │
│  │  │  (Elastic IP)  │  │      │  │  (No Public IP)    │  │     │
│  │  └────────────────┘  │      │  │  - Git, Node, ATX  │  │     │
│  │         │            │      │  │  - IAM Role        │  │     │
│  │         │            │      │  └────────────────────┘  │     │
│  │  ┌──────▼──────────┐ │      │           │              │     │
│  │  │ Internet Gateway│ │      │  ┌────────▼──────────┐   │     │
│  │  └─────────────────┘ │      │  │  VPC Endpoints    │   │     │
│  └──────────────────────┘      │  │  - Transform      │   │     │
│                                │  │  - SSM (3)        │   │     │
│                                │  │  - S3             │   │     │
│                                │  └───────────────────┘   │     │
│                                └──────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    AWS Transform Custom
                    AWS S3
                    Internet (ATX CLI download)
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

**Via AWS Console (Recommended):**
1. Go to AWS Console → EC2 → Instances
2. Select your instance (Name: `TransformCustomEC2Instance`)
3. Click "Connect" button at the top
4. Choose "Session Manager" tab
5. Click "Connect" button

**Via AWS CLI:**
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
```

**3. Upload transformation documents to EC2:**

Upload the required transformation files from the `documents/` folder to your EC2 instance. Organize them in this structure:

```
~/transform-workspace/
├── transformation_definition.md
├── summaries.md
└── reference_documents/
    └── ca-easytrieve-report-generator-11-6.txt
```

The first two files go in the workspace root, and the easytrieve reference documentation goes in a `reference_documents/` subdirectory.

**4. Create custom transformation definition:**

Use the ATX CLI to create a custom transformation definition by providing the paths to your uploaded files. ATX will generate a custom transformation definition JSON file that combines your base definition, summaries, and reference documentation.

**5. Review and publish transformation definition:**

Review the generated custom transformation definition to ensure it meets your requirements. Once satisfied, publish it to AWS Transform Custom with a descriptive name. This makes it available for use in transformation jobs.

**6. Run Easytrieve transformations:**

Upload your Easytrieve source code to S3, then use the ATX CLI to start a transformation job with your published custom transformation definition. Monitor the transformation progress and download the transformed code when complete. Refer to the [AWS Transform Custom Getting Started Guide](https://docs.aws.amazon.com/transform/latest/userguide/custom-get-started.html) for detailed ATX CLI commands and transformation workflow.

## Document Files Structure

The `documents/` folder contains required files for custom transformation:

```
documents/
├── transformation_definition.md          # Base transformation definition
├── summaries.md                          # Transformation summaries
└── ca-easytrieve-report-generator-11-6.txt  # Easytrieve reference documentation
```

**Purpose of each file:**
- **transformation_definition.md**: Defines how Easytrieve constructs map to target languages
- **summaries.md**: Contains transformation rules and patterns
- **ca-easytrieve-report-generator-11-6.txt**: CA Easytrieve Report Generator reference manual for context

## What's Included

| Component | Details |
|-----------|---------|
| **EC2 Instance** | t3.medium, Amazon Linux 2023, 20GB encrypted EBS, **private subnet** |
| **Pre-installed Tools** | Git, Node.js, NPM, ATX CLI, AWS CLI |
| **IAM Permissions** | Transform/Transform Custom (full), S3 (object operations only) |
| **Network** | Private subnet with NAT Gateway + 4 VPC endpoints |
| **Security** | No public IP, SSM Session Manager, IMDSv2, encrypted storage, VPC endpoint policies |
| **Region** | us-east-1 |

## Security Features (Production-Ready)

### Network Security
- **No Public IP**: Instance deployed in private subnet, completely isolated from internet
- **NAT Gateway**: Provides outbound-only internet access for software downloads
- **VPC Endpoints**: Private connectivity to AWS services (Transform Custom, SSM, S3)
- **Endpoint Policies**: Transform Custom endpoint restricted to same AWS account only
- **No Inbound Rules**: Security group blocks all inbound traffic

### Data Security
- **EBS Encryption**: All volumes encrypted at rest with AWS-managed keys
- **IMDSv2 Enforced**: Protection against SSRF attacks (HttpTokens: required)
- **Encrypted Transit**: All AWS service communication over HTTPS

### Access Control
- **SSM Session Manager Only**: No SSH keys, no open ports, IAM-based authentication
- **Least Privilege IAM**: S3 permissions limited to object operations (no bucket deletion/policy changes)
- **Max Session Duration**: IAM role sessions limited to 1 hour
- **CloudTrail Integration**: All SSM sessions logged for audit

### Compliance
- **Latest AMI**: Amazon Linux 2023 with automatic security updates
- **Resource Tagging**: Environment: Production, ManagedBy: CDK/CloudFormation
- **GP3 Volumes**: Modern, performant storage with encryption

## Additional Security Recommendations

Based on the threat model analysis (see THREATS.md), consider implementing these additional security controls:

- **MFA for SSM Access**: Require MFA for all IAM users/roles that can initiate SSM sessions to the EC2 instance
- **Software Integrity Verification**: Add checksum verification for Node.js and ATX CLI downloads in UserData, or use pre-baked AMIs with verified software
- **GuardDuty**: Enable GuardDuty for runtime threat detection on the EC2 instance
- **AWS Budgets**: Set up cost anomaly alerts to detect unexpected resource consumption

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

## Troubleshooting

**Stack deletion fails (subnet in use):**
```bash
# VPC endpoint network interfaces may not delete immediately
# Find and manually delete network interfaces:

# Get VPC ID
VPC_ID=$(aws cloudformation describe-stacks \
  --stack-name easytrieve-transform-stack \
  --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' \
  --output text)

# List network interfaces
aws ec2 describe-network-interfaces \
  --filters "Name=vpc-id,Values=$VPC_ID" \
  --query 'NetworkInterfaces[?Status==`available`].[NetworkInterfaceId,Description]' \
  --output table

# Delete each network interface
aws ec2 delete-network-interface --network-interface-id <ENI-ID>

# Retry stack deletion
cdk destroy
# or
aws cloudformation delete-stack --stack-name easytrieve-transform-stack
```

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
# Test Transform Custom endpoint (should resolve to private IP)
nslookup transform-custom.us-east-1.api.aws
# Should resolve to 10.0.2.x (private subnet)

# Test internet access via NAT Gateway
curl -I https://desktop-release.transform.us-east-1.api.aws
# Should return: HTTP 200 OK

# Verify no public IP
curl -s http://169.254.169.254/latest/meta-data/public-ipv4
# Should return: empty or error
```

## Support

For issues with:
- **Infrastructure deployment**: Check CloudFormation/CDK logs
- **AWS Transform Custom**: See [AWS Transform Custom Documentation](https://docs.aws.amazon.com/transform/latest/userguide/custom.html)
- **Easytrieve transformation**: Refer to AWS Transform Custom user guide

## License

This code is provided as-is for use with AWS Transform Custom services.
