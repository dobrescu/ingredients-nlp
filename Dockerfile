# Production Dockerfile for AWS Lambda
FROM public.ecr.aws/lambda/python:3.12

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/

# Set Python path
ENV PYTHONPATH="${LAMBDA_TASK_ROOT}"

# Lambda handler
CMD ["src.lambda_handler.handler"]
