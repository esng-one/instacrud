from abc import ABC, abstractmethod
from typing import Optional


def mask_email(email: str) -> str:
    """Mask email address for logging (show only first 3 chars + domain)"""
    if "@" not in email:
        return email[:3] + "***"
    name, domain = email.split("@", 1)
    if len(name) <= 3:
        return f"{name[0]}***@{domain}"
    return f"{name[:3]}***@{domain}"


class EmailService(ABC):
    """Abstract email service interface"""
    @abstractmethod
    async def send_email(
        self,
        to: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        """
        Send an email.

        Args:
            to: Recipient email address
            subject: Email subject
            html_body: HTML email body
            text_body: Plain text email body (optional fallback)

        Returns:
            True if email was sent successfully, False otherwise
        """
        raise NotImplementedError


class NoOpEmailService(EmailService):
    """
    Email service that intentionally does nothing.
    Used when EMAIL_ENABLED=false.
    """

    async def send_email(
        self,
        to: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        return False
