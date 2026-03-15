from typing import Optional

from instacrud.config import settings
from instacrud.mailer.email_service import EmailService, NoOpEmailService
from instacrud.mailer.brevo_email_service import BrevoEmailService
from instacrud.mailer.file_email_service import FileEmailService
from instacrud.mailer.smtp_email_service import SmtpEmailService
from instacrud.mailer.gmail_email_service import GmailEmailService

_email_service: Optional[EmailService] = None


def get_email_service() -> EmailService:
    """Get or create the global email service instance"""
    global _email_service
    if _email_service is not None:
        return _email_service

    if not settings.EMAIL_ENABLED:
        _email_service = NoOpEmailService()
        return _email_service

    carrier = settings.EMAIL_CARRIER.lower()

    if carrier == "file":
        _email_service = FileEmailService(
            out_dir=settings.EMAIL_DUMP_PATH,
            from_address=settings.EMAIL_FROM_ADDRESS,
            from_name=settings.EMAIL_FROM_NAME,
        )
        return _email_service

    if carrier == "brevo":
        if not settings.BREVO_API_KEY:
            raise RuntimeError(
                "EMAIL_CARRIER=brevo but BREVO_API_KEY is not set"
            )

        _email_service = BrevoEmailService(
            api_key=settings.BREVO_API_KEY,
            from_address=settings.EMAIL_FROM_ADDRESS,
            from_name=settings.EMAIL_FROM_NAME,
        )
        return _email_service

    if carrier == "smtp":
        _email_service = SmtpEmailService(
            host=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            use_tls=settings.SMTP_TLS,
            use_ssl=settings.SMTP_SSL,
            from_address=settings.EMAIL_FROM_ADDRESS,
            from_name=settings.EMAIL_FROM_NAME,
        )
        return _email_service

    if carrier == "gmail":
        if not settings.GMAIL_USERNAME or not settings.GMAIL_PASSWORD:
            raise RuntimeError(
                "EMAIL_CARRIER=gmail but GMAIL_USERNAME or GMAIL_PASSWORD is not set"
            )
        
        _email_service = GmailEmailService(
            username=settings.GMAIL_USERNAME,
            password=settings.GMAIL_PASSWORD,
            from_address=settings.EMAIL_FROM_ADDRESS,
            from_name=settings.EMAIL_FROM_NAME,
        )
        return _email_service

    raise RuntimeError(f"Unknown EMAIL_CARRIER: {settings.EMAIL_CARRIER}")


def override_email_service(service: EmailService):
    """
    Test helper to inject a fake email service.
    """
    global _email_service
    _email_service = service
