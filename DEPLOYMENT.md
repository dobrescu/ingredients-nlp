# Deployment Guide

Complete guide for deploying the Ingredients NLP service to AWS Lambda.

## Prerequisites

- AWS Account
- AWS CLI configured
- Docker installed
- Terraform or AWS SAM (optional, for IaC)

## Architecture

```
Internet
    ↓
API Gateway (HTTP API v2)
    ↓
AWS Lambda (Container)
    ↓
[ECR: ingredients-nlp:latest]
```

## Deployment Steps

### 1. Build Docker Image

```bash
# Build production image
docker build -t ingredients-nlp:latest .

# Test locally
docker run -p 9000:8080 ingredients-nlp:latest

# Test the local container
curl -X POST http://localhost:9000/2015-03-31/functions/function/invocations \
  -d '{"requestContext":{"http":{"method":"GET","path":"/health"}}}'
```

### 2. Create ECR Repository

```bash
# Set variables
export AWS_ACCOUNT_ID=your-account-id
export AWS_REGION=us-east-1
export REPOSITORY_NAME=ingredients-nlp

# Create repository
aws ecr create-repository \
    --repository-name ${REPOSITORY_NAME} \
    --region ${AWS_REGION}
```

### 3. Push to ECR

```bash
# Login to ECR
aws ecr get-login-password --region ${AWS_REGION} | \
    docker login --username AWS --password-stdin \
    ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com

# Tag image
docker tag ingredients-nlp:latest \
    ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPOSITORY_NAME}:latest

# Push image
docker push ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPOSITORY_NAME}:latest
```

Or use the helper script:
```bash
export AWS_ACCOUNT_ID=your-account-id
make push-ecr
```

### 4. Create IAM Role

Create an execution role for Lambda:

```bash
# Create trust policy
cat > trust-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create role
aws iam create-role \
    --role-name ingredients-nlp-lambda-role \
    --assume-role-policy-document file://trust-policy.json

# Attach basic execution policy
aws iam attach-role-policy \
    --role-name ingredients-nlp-lambda-role \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

### 5. Create Lambda Function

```bash
# Get role ARN
ROLE_ARN=$(aws iam get-role --role-name ingredients-nlp-lambda-role --query 'Role.Arn' --output text)

# Create Lambda function
aws lambda create-function \
    --function-name ingredients-nlp \
    --package-type Image \
    --code ImageUri=${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPOSITORY_NAME}:latest \
    --role ${ROLE_ARN} \
    --timeout 30 \
    --memory-size 512 \
    --environment Variables="{LOG_LEVEL=INFO,ENABLE_DETAILED_LOGGING=false}"
```

### 6. Create API Gateway

```bash
# Create HTTP API
API_ID=$(aws apigatewayv2 create-api \
    --name ingredients-nlp-api \
    --protocol-type HTTP \
    --target arn:aws:lambda:${AWS_REGION}:${AWS_ACCOUNT_ID}:function:ingredients-nlp \
    --query 'ApiId' \
    --output text)

# Grant API Gateway permission to invoke Lambda
aws lambda add-permission \
    --function-name ingredients-nlp \
    --statement-id apigateway-invoke \
    --action lambda:InvokeFunction \
    --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:${AWS_REGION}:${AWS_ACCOUNT_ID}:${API_ID}/*/*"

# Get API endpoint
API_ENDPOINT=$(aws apigatewayv2 get-api --api-id ${API_ID} --query 'ApiEndpoint' --output text)
echo "API Endpoint: ${API_ENDPOINT}"
```

### 7. Test Deployment

```bash
# Health check
curl ${API_ENDPOINT}/health

# Parse ingredients
curl -X POST ${API_ENDPOINT}/parse \
    -H "Content-Type: application/json" \
    -d '{
        "ingredients": [
            "2 cups flour",
            "1 teaspoon salt"
        ]
    }'
```

## Configuration

### Lambda Configuration

Recommended settings:
- **Memory**: 512 MB (increase for high load)
- **Timeout**: 30 seconds
- **Concurrency**: Reserve 10 for consistent performance
- **Cold start optimization**: Keep function warm with CloudWatch Events

### Environment Variables

```bash
aws lambda update-function-configuration \
    --function-name ingredients-nlp \
    --environment Variables="{
        LOG_LEVEL=INFO,
        ENABLE_DETAILED_LOGGING=true
    }"
```

### API Gateway Settings

- **Throttling**: 1000 requests/second per account
- **CORS**: Enabled in Lambda response headers
- **Custom domain**: Configure via Route 53 + ACM certificate

## Monitoring

### CloudWatch Logs

```bash
# View recent logs
aws logs tail /aws/lambda/ingredients-nlp --follow

# Search for errors
aws logs filter-log-events \
    --log-group-name /aws/lambda/ingredients-nlp \
    --filter-pattern "ERROR"
```

### CloudWatch Metrics

Key metrics to monitor:
- `Invocations` - Total requests
- `Duration` - Execution time
- `Errors` - Failed invocations
- `Throttles` - Rate-limited requests
- `ConcurrentExecutions` - Concurrent invocations

### Create CloudWatch Dashboard

```bash
# Create dashboard with key metrics
aws cloudwatch put-dashboard \
    --dashboard-name ingredients-nlp \
    --dashboard-body file://dashboard.json
```

## Updates

### Update Lambda Function

```bash
# Build and push new image
make push-ecr

# Update Lambda
aws lambda update-function-code \
    --function-name ingredients-nlp \
    --image-uri ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPOSITORY_NAME}:latest

# Wait for update to complete
aws lambda wait function-updated \
    --function-name ingredients-nlp

# Test
curl ${API_ENDPOINT}/health
```

## Rollback

### Rollback to Previous Version

```bash
# List versions
aws lambda list-versions-by-function \
    --function-name ingredients-nlp

# Update to specific version
aws lambda update-function-code \
    --function-name ingredients-nlp \
    --image-uri ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${REPOSITORY_NAME}:v1.0.0
```

## Cost Optimization

### Pricing (us-east-1)
- **Lambda**: $0.0000166667 per GB-second
- **API Gateway**: $1.00 per million requests
- **CloudWatch Logs**: $0.50 per GB ingested

### Optimization Tips
1. Right-size memory (512MB recommended)
2. Use CloudWatch Logs Insights sparingly
3. Set log retention (7-30 days)
4. Use Lambda@Edge for global distribution
5. Cache responses at API Gateway

## Troubleshooting

### Cold Starts

Symptoms: First request takes 2-3 seconds

Solutions:
- Use provisioned concurrency
- Implement warming schedule
- Optimize container size

### Timeout Errors

Symptoms: Requests timeout after 30 seconds

Solutions:
- Increase Lambda timeout
- Optimize parsing logic
- Reduce batch size

### Memory Errors

Symptoms: Function crashes with "out of memory"

Solutions:
- Increase memory allocation
- Profile memory usage
- Optimize data structures

### Permission Errors

Symptoms: "AccessDenied" errors

Solutions:
- Check IAM role permissions
- Verify API Gateway integration
- Review CloudWatch Logs permissions

## Infrastructure as Code

### Terraform Example

```hcl
resource "aws_lambda_function" "ingredients_nlp" {
  function_name = "ingredients-nlp"
  package_type  = "Image"
  image_uri     = "${var.ecr_repository_url}:latest"
  role          = aws_iam_role.lambda_role.arn
  timeout       = 30
  memory_size   = 512

  environment {
    variables = {
      LOG_LEVEL              = "INFO"
      ENABLE_DETAILED_LOGGING = "false"
    }
  }
}

resource "aws_apigatewayv2_api" "ingredients_nlp" {
  name          = "ingredients-nlp-api"
  protocol_type = "HTTP"
  target        = aws_lambda_function.ingredients_nlp.arn
}
```

### AWS SAM Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Resources:
  IngredientsNLPFunction:
    Type: AWS::Serverless::Function
    Properties:
      PackageType: Image
      ImageUri: !Sub "${AWS::AccountId}.dkr.ecr.${AWS::Region}.amazonaws.com/ingredients-nlp:latest"
      Timeout: 30
      MemorySize: 512
      Environment:
        Variables:
          LOG_LEVEL: INFO
      Events:
        ApiEvent:
          Type: HttpApi
          Properties:
            Path: /{proxy+}
            Method: ANY
```

## Security

### Best Practices

1. **Use IAM roles** - No hardcoded credentials
2. **Enable encryption** - Encrypt environment variables
3. **VPC configuration** - Deploy in private subnet (if needed)
4. **API authentication** - Add JWT authorizer
5. **Rate limiting** - Configure throttling

### Enable Encryption

```bash
# Encrypt environment variables
aws lambda update-function-configuration \
    --function-name ingredients-nlp \
    --kms-key-arn arn:aws:kms:${AWS_REGION}:${AWS_ACCOUNT_ID}:key/your-key-id
```

## Resources

- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [API Gateway HTTP APIs](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html)
- [Lambda Container Images](https://docs.aws.amazon.com/lambda/latest/dg/images-create.html)
- [CloudWatch Monitoring](https://docs.aws.amazon.com/lambda/latest/dg/monitoring-cloudwatchlogs.html)
