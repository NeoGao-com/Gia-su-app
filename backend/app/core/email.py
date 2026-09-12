import logging
import aiosmtplib
from email.message import EmailMessage
from app.core.config import settings

logger = logging.getLogger(__name__)

async def send_reset_password_email(email: str, token: str):
    msg = EmailMessage()
    msg["Subject"] = "Đặt lại mật khẩu - Quiz App"
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = email

    reset_url = f"http://localhost:5173/reset-password?token={token}"
    msg.set_content(
        f"Xin chào,\n\nBạn đã yêu cầu đặt lại mật khẩu. Vui lòng truy cập liên kết dưới đây để đặt mật khẩu mới:\n{reset_url}\n\nLiên kết có hiệu lực trong {settings.RESET_TOKEN_EXPIRE_MINUTES} phút.\nNếu bạn không yêu cầu điều này, vui lòng bỏ qua email này."
    )

    try:
        if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
            logger.info(f"[DEV MODE] Reset Password Token for {email}: {token}")
            return

        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            use_tls=True if settings.SMTP_PORT == 465 else False,
            start_tls=True if settings.SMTP_PORT == 587 else False
        )
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        logger.info(f"[FALLBACK] Reset Password Token for {email}: {token}")
