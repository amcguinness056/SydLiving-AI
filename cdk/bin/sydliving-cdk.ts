#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SydLivingStack } from '../lib/sydliving-stack';

const app = new cdk.App();

new SydLivingStack(app, 'SydLivingStack', {
  stackName: 'SydLiving-Production',
  description: 'SydLivingAI Production Stack: Serverless FastAPI on Lambda, DynamoDB, API Gateway, S3, and CloudFront',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
    region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'ap-southeast-2'
  }
});
