import os
import logging
import requests
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class StorageService:
    @staticmethod
    def is_supabase_enabled() -> bool:
        return bool(settings.SUPABASE_URL and settings.SUPABASE_KEY)

    @staticmethod
    def upload_file(contents: bytes, filename: str, content_type: str = "image/png") -> Optional[str]:
        """
        Uploads file to Supabase Storage bucket if configured.
        Returns the public URL if successful, otherwise None.
        """
        if not StorageService.is_supabase_enabled():
            return None

        base_url = settings.SUPABASE_URL.rstrip("/")
        bucket = settings.SUPABASE_STORAGE_BUCKET
        api_url = f"{base_url}/storage/v1/object/{bucket}/{filename}"

        headers = {
            "Authorization": f"Bearer {settings.SUPABASE_KEY}",
            "apiKey": settings.SUPABASE_KEY,
            "Content-Type": content_type,
            "x-upsert": "true"
        }

        try:
            response = requests.post(api_url, headers=headers, data=contents, timeout=10)
            if response.status_code in [200, 201]:
                public_url = f"{base_url}/storage/v1/object/public/{bucket}/{filename}"
                logger.info(f"Successfully uploaded {filename} to Supabase Storage: {public_url}")
                return public_url
            else:
                logger.warning(
                    f"Supabase Storage upload failed with status {response.status_code}: {response.text}"
                )
                return None
        except Exception as e:
            logger.error(f"Error uploading to Supabase Storage: {e}")
            return None

    @staticmethod
    def get_public_url(filename: str) -> Optional[str]:
        if not StorageService.is_supabase_enabled():
            return None
        base_url = settings.SUPABASE_URL.rstrip("/")
        bucket = settings.SUPABASE_STORAGE_BUCKET
        return f"{base_url}/storage/v1/object/public/{bucket}/{filename}"
