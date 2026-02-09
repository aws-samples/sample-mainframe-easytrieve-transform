from aws_cdk import Stack, Duration, aws_ec2 as ec2, aws_iam as iam, CfnOutput, Tags, RemovalPolicy
import aws_cdk as cdk
from constructs import Construct

class EasytrieveTransformStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        vpc = ec2.Vpc(
            self, "TransformCustomVPC",
            max_azs=1,
            ip_addresses=ec2.IpAddresses.cidr("10.0.0.0/16"),
            subnet_configuration=[
                ec2.SubnetConfiguration(
                    name="Public",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24
                ),
                ec2.SubnetConfiguration(
                    name="Private",
                    subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidr_mask=24
                )
            ],
            nat_gateways=1
        )

        ec2_sg = ec2.SecurityGroup(
            self, "EC2SecurityGroup",
            vpc=vpc,
            description="Security group for EC2 instance",
            allow_all_outbound=True
        )

        vpce_sg = ec2.SecurityGroup(
            self, "VPCEndpointSecurityGroup",
            vpc=vpc,
            description="Security group for VPC Endpoints",
            allow_all_outbound=False
        )
        vpce_sg.add_ingress_rule(ec2_sg, ec2.Port.tcp(443), "HTTPS from EC2")

        s3_endpoint = vpc.add_gateway_endpoint(
            "S3VPCEndpoint",
            service=ec2.GatewayVpcEndpointAwsService.S3
        )
        
        cfn_s3_endpoint = s3_endpoint.node.default_child
        cfn_s3_endpoint.add_property_override("PolicyDocument", {
            "Statement": [{
                "Effect": "Allow",
                "Principal": "*",
                "Action": [
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:DeleteObject",
                    "s3:ListBucket",
                    "s3:GetBucketLocation",
                    "s3:GetObjectVersion",
                    "s3:ListBucketVersions"
                ],
                "Resource": "*"
            }]
        })

        transform_endpoint = ec2.InterfaceVpcEndpoint(
            self, "TransformCustomVPCEndpoint",
            vpc=vpc,
            service=ec2.InterfaceVpcEndpointService(
                "com.amazonaws.us-east-1.transform-custom", 443
            ),
            private_dns_enabled=True,
            security_groups=[vpce_sg],
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS)
        )
        
        cfn_transform_endpoint = transform_endpoint.node.default_child
        cfn_transform_endpoint.add_property_override("PolicyDocument", {
            "Statement": [{
                "Effect": "Allow",
                "Principal": "*",
                "Action": "transform-custom:*",
                "Resource": "*",
                "Condition": {
                    "StringEquals": {
                        "aws:PrincipalAccount": cdk.Aws.ACCOUNT_ID
                    }
                }
            }]
        })

        ssm_endpoint = ec2.InterfaceVpcEndpoint(
            self, "SSMVPCEndpoint",
            vpc=vpc,
            service=ec2.InterfaceVpcEndpointAwsService.SSM,
            private_dns_enabled=True,
            security_groups=[vpce_sg],
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS)
        )

        ssm_messages_endpoint = ec2.InterfaceVpcEndpoint(
            self, "SSMMessagesVPCEndpoint",
            vpc=vpc,
            service=ec2.InterfaceVpcEndpointAwsService.SSM_MESSAGES,
            private_dns_enabled=True,
            security_groups=[vpce_sg],
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS)
        )

        ec2_messages_endpoint = ec2.InterfaceVpcEndpoint(
            self, "EC2MessagesVPCEndpoint",
            vpc=vpc,
            service=ec2.InterfaceVpcEndpointAwsService.EC2_MESSAGES,
            private_dns_enabled=True,
            security_groups=[vpce_sg],
            subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS)
        )

        role = iam.Role(
            self, "EC2Role",
            assumed_by=iam.ServicePrincipal("ec2.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("AmazonSSMManagedInstanceCore")
            ],
            max_session_duration=cdk.Duration.hours(1)
        )
        role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["transform:*", "transform-custom:*"],
                resources=["*"]
            )
        )
        role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:DeleteObject",
                    "s3:ListBucket",
                    "s3:GetBucketLocation",
                    "s3:GetObjectVersion",
                    "s3:ListBucketVersions"
                ],
                resources=["*"]
            )
        )

        user_data = ec2.UserData.for_linux()
        user_data.add_commands(
            "set -e",
            "exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1",
            "dnf update -y",
            "dnf install -y git nodejs npm",
            "curl -fsSL https://desktop-release.transform.us-east-1.api.aws/install.sh | bash",
            "[ -f \"$HOME/.local/bin/atx\" ] && ln -sf \"$HOME/.local/bin/atx\" /usr/local/bin/atx",
            "mkdir -p /root/.aws",
            "cat > /root/.aws/config << 'EOF'",
            "[default]",
            "region = us-east-1",
            "output = json",
            "EOF",
            "echo 'Installation complete: Git '$(git --version)', Node '$(node --version)"
        )

        instance = ec2.Instance(
            self, "TransformCustomEC2Instance",
            vpc=vpc,
            instance_type=ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MEDIUM),
            machine_image=ec2.MachineImage.latest_amazon_linux2023(),
            role=role,
            security_group=ec2_sg,
            user_data=user_data,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            block_devices=[
                ec2.BlockDevice(
                    device_name="/dev/xvda",
                    volume=ec2.BlockDeviceVolume.ebs(
                        volume_size=20,
                        encrypted=True,
                        delete_on_termination=True,
                        volume_type=ec2.EbsDeviceVolumeType.GP3
                    )
                )
            ],
            require_imdsv2=True
        )
        Tags.of(instance).add("Name", "TransformCustomEC2Instance")
        Tags.of(instance).add("Environment", "Production")
        Tags.of(instance).add("ManagedBy", "CDK")

        CfnOutput(self, "InstanceId", value=instance.instance_id, export_name=f"{self.stack_name}-InstanceId")
        CfnOutput(self, "InstancePrivateIP", value=instance.instance_private_ip, export_name=f"{self.stack_name}-PrivateIP")
        CfnOutput(self, "VPCId", value=vpc.vpc_id, export_name=f"{self.stack_name}-VPCId")
        CfnOutput(self, "TransformCustomVPCEndpointId", value=transform_endpoint.vpc_endpoint_id, export_name=f"{self.stack_name}-TransformCustomVPCE")
        CfnOutput(self, "S3VPCEndpointId", value=s3_endpoint.vpc_endpoint_id, export_name=f"{self.stack_name}-S3VPCE")
        CfnOutput(self, "SSMVPCEndpointId", value=ssm_endpoint.vpc_endpoint_id, export_name=f"{self.stack_name}-SSMVPCE")
        CfnOutput(self, "ConnectCommand", value=f"aws ssm start-session --target {instance.instance_id} --region us-east-1")
