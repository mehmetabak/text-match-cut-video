from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Istanbul",
    enable_utc=True,
    # Worker limit optimization for 512MB RAM environments
    worker_concurrency=1,
    worker_prefetch_multiplier=1,
)

# Auto-discover tasks in the tasks module
celery_app.autodiscover_tasks(["app.workers"])
