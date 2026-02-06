#!/usr/bin/env python3
import aws_cdk as cdk
from easytrieve_transform_stack import EasytrieveTransformStack

app = cdk.App()

EasytrieveTransformStack(
    app, 
    "EasytrieveTransformStack",
    env=cdk.Environment(region="us-east-1"),
    description="EC2 Linux instance with AWS Transform Custom access via VPC Endpoint"
)

app.synth()
