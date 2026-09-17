import os
import sys
import logging

# Ensure backend directory is in sys.path for Lambda runtime
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from mangum import Mangum
from main import app

logger = logging.getLogger("sydliving.lambda")
logger.setLevel(logging.INFO)

# Mangum ASGI adapter for AWS Lambda & API Gateway HTTP API / REST API
# lifespan="off" is recommended for serverless Lambda execution environments
mangum_handler = Mangum(app, lifespan="off")

def handler(event, context):
    """
    AWS Lambda entrypoint.
    Handles API Gateway HTTP API (payload v2.0), REST API (payload v1.0),
    and CloudWatch / EventBridge ping/warmup events.
    """
    # Quick health check / warmup bypass
    if isinstance(event, dict):
        if event.get("source") in ("aws.events", "serverless-plugin-warmup") or event.get("ping") is True:
            logger.info("Warmup ping event received - returning 200 OK")
            return {
                "statusCode": 200,
                "headers": {"Content-Type": "text/plain"},
                "body": "pong"
            }

    return mangum_handler(event, context)
