# Production Dockerfile for AWS Lambda
FROM public.ecr.aws/lambda/python:3.12

# Install production dependencies only (no cache, no build tools)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && rm requirements.txt

# Copy application code
COPY src/ ${LAMBDA_TASK_ROOT}/src/

# Set handler
CMD ["src.lambda_handler.handler"]
