import * as cdk from '@aws-cdk/core';
import s3 = require('@aws-cdk/aws-s3');
import dynamodb = require('@aws-cdk/aws-dynamodb');
import iam = require('@aws-cdk/aws-iam')
import lambda = require('@aws-cdk/aws-lambda');
import s3deploy = require('@aws-cdk/aws-s3-deployment')
import { PolicyStatement } from '@aws-cdk/aws-iam';
import custom = require('@aws-cdk/custom-resources')
import { CustomResource, Duration } from '@aws-cdk/core';
import apigateway = require('@aws-cdk/aws-apigateway'); 
import * as appsync from '@aws-cdk/aws-appsync';

export class SMANotification extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    
    const outgoingWav = new s3.Bucket(this, 'outgoingWav', {
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true // NOT recommended for production code
    });
    
    const outboundWavBucketPolicy = new PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        's3:GetObject',
        's3:PutObject',
        's3:PutObjectAcl'
      ],
      resources: [
        outgoingWav.bucketArn,
        `${outgoingWav.bucketArn}/*`
      ],
      sid: 'SIPMediaApplicationRead',
    })

    outboundWavBucketPolicy.addServicePrincipal('voiceconnector.chime.amazonaws.com')
    outgoingWav.addToResourcePolicy(outboundWavBucketPolicy)

    new s3deploy.BucketDeployment(this, 'WavDeploy', {
      sources: [s3deploy.Source.asset('./wav_files')],
      destinationBucket: outgoingWav,
      contentType: 'audio/wav'
    });

    const requesterInfo = new dynamodb.Table(this, 'requesterInfo', {
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,            
    });
    
    requesterInfo.addGlobalSecondaryIndex ({
      indexName: "transactionId-index",
      partitionKey: {
        name: 'transactionId',
        type: dynamodb.AttributeType.STRING
      }})

    const smaLambdaRole = new iam.Role(this, 'smaLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    smaLambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"));

    
    const chimeCreateRole = new iam.Role(this, 'createChimeLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['chimePolicy']: new iam.PolicyDocument( { statements: [new iam.PolicyStatement({
          resources: ['*'],
          actions: ['chime:*',
                    'lambda:GetPolicy',
                    'lambda:AddPermission']})]})
      },
      managedPolicies: [ iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole") ]
    })

    const createSMALambda = new lambda.Function(this, 'createSMALambda', {
      code: lambda.Code.fromAsset("src/createChimeResources" ),
      handler: 'createChimeResources.on_event',
      runtime: lambda.Runtime.PYTHON_3_8,
      role: chimeCreateRole,
      timeout: Duration.seconds(60)
    });

    const chimeProvider = new custom.Provider(this, 'chimeProvider', {
      onEventHandler: createSMALambda
    })

    const graphql = new appsync.GraphqlApi(this, 'Api', {
      name: 'scheduler-api',
      schema: appsync.Schema.fromAsset('src/graphQL/schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            name: 'graphQLAPI'
          }
          }
        },
      },
    );

    const smaOutboundLambda = new lambda.Function(this, 'smaOutboundLambda', {
      code: lambda.Code.fromAsset("src/smaOutbound", {exclude: ['yarn.lock']}),
      handler: 'smaOutbound.handler',
      runtime: lambda.Runtime.NODEJS_14_X,
      environment: {
        SCHEDULE_TABLE_NAME: requesterInfo.tableName,
        OUTGOING_WAV_BUCKET: outgoingWav.bucketName,
        API_URL: graphql.graphqlUrl,
        API_KEY: graphql.apiKey!
      },
      role: chimeCreateRole
    });
    requesterInfo.grantReadWriteData(smaOutboundLambda)

    const outboundSMA = new CustomResource(this, 'outboundSMA', { 
      serviceToken: chimeProvider.serviceToken,
      properties: { 'lambdaArn': smaOutboundLambda.functionArn,
                    'state': 'IL',
                    'region': this.region,
                    'smaName': this.stackName + '-outbound',
                    'phoneNumberRequired': true}
    })
    outboundSMA.node.addDependency(smaOutboundLambda)
    const outboundSmaID = outboundSMA.getAttString('smaID')

    const phoneNumber = outboundSMA.getAttString('phoneNumber')
    
    new cdk.CfnOutput(this, 'phoneNumber', { value: phoneNumber });

    const outboundCallRole = new iam.Role(this, 'outboundCallRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['chimePolicy']: new iam.PolicyDocument( { statements: [new iam.PolicyStatement({
          resources: ['*'],
          actions: ['chime:*',
                    'polly:*']})]})
      },
      managedPolicies: [ iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole") ]
    })

    const pythonLayer = new lambda.LayerVersion(this, 'pythonLayer', {
      code: new lambda.AssetCode('src/python_layer'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_8],
      license: 'Apache-2.0',
      description: 'python-layer',
    });      

    const outboundCall = new lambda.Function(this, 'outboundCall', {
      code: lambda.Code.fromAsset("src/outboundCall", {exclude: ['requirements.txt']}),
      handler: 'outboundCall.lambda_handler',
      runtime: lambda.Runtime.PYTHON_3_8,
      role: outboundCallRole,
      layers: [pythonLayer],
      timeout: cdk.Duration.seconds(60),
      environment: {
        OUTGOING_WAV_BUCKET: outgoingWav.bucketName,
        SMA_ID: outboundSmaID,
        FROM_NUMBER: phoneNumber,
        REQUESTER_TABLE_NAME: requesterInfo.tableName,
        API_URL: graphql.graphqlUrl,
        API_KEY: graphql.apiKey!
      }
    });

    outgoingWav.grantReadWrite(outboundCall)
    requesterInfo.grantFullAccess(outboundCall)

    const api = new apigateway.RestApi(this, 'outboundTrigger', {
      endpointConfiguration: {
        types: [ apigateway.EndpointType.REGIONAL ]
      },
    });

    const outbound = api.root.addResource('outboundCall');
    const outboundIntegration = new apigateway.LambdaIntegration(outboundCall)
    outbound.addMethod('POST', outboundIntegration, {
      methodResponses: [{ statusCode: '200' }]
    });
    outbound.addCorsPreflight({
      allowOrigins: [ 'http://localhost:3000' ],
      allowMethods: [ 'POST', 'OPTIONS' ]
    })

    new cdk.CfnOutput(this, 'outboundCallAPI', { value: api.url });



    new cdk.CfnOutput(this, 'graphQLURL', { 
      value: graphql.graphqlUrl,
      exportName: "graphQLURL"
    });

    new cdk.CfnOutput(this, 'graphQLKey', { 
      value: graphql.apiKey!,
      exportName: "graphQLKey"
    });   

    const graphqlLambda = new lambda.Function(this, 'graphQLHandler', {
      runtime: lambda.Runtime.NODEJS_14_X,
      handler: 'graphqlResolver.handler',
      code: lambda.Code.fromAsset("src/graphqlResolver"),
      memorySize: 1024,
      environment: {
        NOTES_TABLE: requesterInfo.tableName
      },
      timeout: Duration.seconds(15)
    });
    

    const graphQLData = graphql.addLambdaDataSource('lambdaDatasource', graphqlLambda);
    requesterInfo.grantFullAccess(graphqlLambda)

    graphQLData.createResolver({
      typeName: "Query",
      fieldName: "getNoteById"
    });

    graphQLData.createResolver({
      typeName: "Query",
      fieldName: "listNotes"
    });

    graphQLData.createResolver({
      typeName: "Query",
      fieldName: "getNotebyTransactionId"
    });    

    graphQLData.createResolver({
      typeName: "Mutation",
      fieldName: "createNote"
    });

    graphQLData.createResolver({
      typeName: "Mutation",
      fieldName: "deleteNote"
    });

    graphQLData.createResolver({
      typeName: "Mutation",
      fieldName: "updateNote"
    });

  graphql.grantMutation(outboundCall)


  }
}
