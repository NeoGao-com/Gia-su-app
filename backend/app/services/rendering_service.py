import subprocess
import uuid
import os
import sys
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class CodeRenderer:
    FORBIDDEN_KEYWORDS = ['import os', 'import sys', 'subprocess', 'eval(', 'exec(', 'open(', 'socket', 'shutil', 'requests', 'urllib']

    @classmethod
    async def render_python_matplotlib(cls, code: str) -> str:
        # Check forbidden keywords for basic security
        for kw in cls.FORBIDDEN_KEYWORDS:
            if kw in code:
                raise Exception(f"Mã chứa từ khóa bị cấm: {kw}")

        filename = f"{uuid.uuid4()}.png"
        filepath = os.path.join(settings.UPLOAD_DIR, filename)
        # Ensure path uses forward slashes in python code execution to avoid backslash escaping issues
        normalized_filepath = filepath.replace("\\", "/")

        full_code = f"""
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

{code}

plt.savefig('{normalized_filepath}', bbox_inches='tight', dpi=150)
plt.close()
"""
        # Execute python in subprocess with timeout
        python_exe = sys.executable
        try:
            res = subprocess.run(
                [python_exe, "-c", full_code],
                timeout=5,
                capture_output=True,
                text=True
            )
            if res.returncode != 0:
                raise Exception(f"Lỗi biên dịch code: {res.stderr}")

            return f"/api/uploads/{filename}"
        except subprocess.TimeoutExpired:
            raise Exception("Thời gian thực thi vượt quá giới hạn (Timeout 5s)")
        except Exception as e:
            raise Exception(str(e))
