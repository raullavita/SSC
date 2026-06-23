"""Central logging setup."""
import logging

from core.config import LOG_LEVEL
from core.logging_policy import attach_sensitive_log_filter

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("ssc")
attach_sensitive_log_filter(logger)
logger.info("Logging initialized (SSC log hygiene active)")