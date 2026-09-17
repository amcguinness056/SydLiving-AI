import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as stepfunctions from 'aws-cdk-lib/aws-stepfunctions';
import * as path from 'path';
import * as fs from 'fs';

export class SydLivingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // =========================================================================
    // 1. DynamoDB: Single-Table Architecture (`SydLiving-Core`)
    // =========================================================================
    // Uses On-Demand capacity (PAY_PER_REQUEST) and composite PK/SK schema with
    // Global Secondary Index GSI1.
    const coreTable = new dynamodb.Table(this, 'SydLivingCoreTable', {
      tableName: 'SydLiving-Core',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY // Safe for development; retain for production
    });

    coreTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL
    });

    // =========================================================================
    // 2. Step Functions: Property Search Pipeline Orchestrator
    // =========================================================================
    const aslPath = path.join(__dirname, '../../backend/statemachine/property_orchestrator.asl.json');
    let aslContent = '{}';
    if (fs.existsSync(aslPath)) {
      aslContent = fs.readFileSync(aslPath, 'utf8');
    }

    const searchOrchestrator = new stepfunctions.StateMachine(this, 'PropertySearchOrchestrator', {
      stateMachineName: 'SydLiving-PropertyOrchestrator',
      definitionBody: stepfunctions.DefinitionBody.fromString(aslContent),
      timeout: cdk.Duration.minutes(5)
    });

    // =========================================================================
    // 3. AWS Lambda: FastAPI Application Wrapped via Mangum
    // =========================================================================
    const backendLambda = new lambda.Function(this, 'BackendLambdaHandler', {
      functionName: 'SydLiving-Backend-Api',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'lambda_handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        exclude: [
          'venv',
          '.pytest_cache',
          '__pycache__',
          'tests',
          '*.db',
          '*.pyc'
        ]
      }),
      memorySize: 512,
      timeout: cdk.Duration.seconds(30),
      environment: {
        USE_DYNAMODB: 'true',
        DYNAMODB_TABLE_NAME: coreTable.tableName,
        PROPERTY_ORCHESTRATOR_SFN_ARN: searchOrchestrator.stateMachineArn,
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
        TFNSW_API_KEY: process.env.TFNSW_API_KEY || '',
        DOMAIN_API_KEY: process.env.DOMAIN_API_KEY || ''
      }
    });

    // Least-Privilege IAM Grants
    coreTable.grantReadWriteData(backendLambda);
    searchOrchestrator.grantStartExecution(backendLambda);
    searchOrchestrator.grantRead(backendLambda);

    // Explicit IAM policy for AWS Textract (Lease PDF Optical Character Recognition)
    backendLambda.addToRolePolicy(new iam.PolicyStatement({
      sid: 'TextractDocumentAnalysis',
      actions: [
        'textract:DetectDocumentText',
        'textract:AnalyzeDocument'
      ],
      resources: ['*']
    }));

    // Explicit IAM policy for AWS Comprehend (NLP Entity and Clause Recognition)
    backendLambda.addToRolePolicy(new iam.PolicyStatement({
      sid: 'ComprehendEntityAnalysis',
      actions: [
        'comprehend:DetectEntities',
        'comprehend:DetectKeyPhrases'
      ],
      resources: ['*']
    }));

    // =========================================================================
    // 4. Amazon API Gateway: HTTP API Proxy
    // =========================================================================
    const httpApi = new apigatewayv2.HttpApi(this, 'SydLivingHttpApi', {
      apiName: 'SydLiving-HttpApi',
      description: 'Serverless HTTP API gateway proxying to FastAPI Mangum Lambda',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.OPTIONS
        ],
        allowHeaders: ['*']
      }
    });

    const lambdaIntegration = new HttpLambdaIntegration('LambdaBackendIntegration', backendLambda);

    httpApi.addRoutes({
      path: '/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: lambdaIntegration
    });

    httpApi.addRoutes({
      path: '/',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: lambdaIntegration
    });

    // =========================================================================
    // 5. Amazon S3 + CloudFront: Frontend Static Hosting & Global Edge CDN
    // =========================================================================
    const websiteBucket = new s3.Bucket(this, 'FrontendWebsiteBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      comment: 'SydLivingAI React 19 Frontend SPA CDN',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0)
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.seconds(0)
        }
      ]
    });

    // =========================================================================
    // 6. Stack CloudFormation Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: httpApi.apiEndpoint,
      description: 'API Gateway HTTP API Endpoint URL'
    });

    new cdk.CfnOutput(this, 'CloudFrontUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront CDN Domain for React Frontend'
    });

    new cdk.CfnOutput(this, 'FrontendBucketName', {
      value: websiteBucket.bucketName,
      description: 'S3 Bucket name hosting static frontend build assets'
    });

    new cdk.CfnOutput(this, 'DynamoDBTableName', {
      value: coreTable.tableName,
      description: 'Single-Table DynamoDB Table Name'
    });

    new cdk.CfnOutput(this, 'StateMachineArn', {
      value: searchOrchestrator.stateMachineArn,
      description: 'Step Functions Property Search Orchestrator ARN'
    });
  }
}
