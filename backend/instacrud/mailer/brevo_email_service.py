import anyio
from loguru import logger
from typing import Optional

import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException

from instacrud.mailer.email_service import EmailService, mask_email


class BrevoEmailService(EmailService):
    """Brevo (Sendinblue) email service implementation"""

    def __init__(self, api_key: str, from_address: str, from_name: str):
        self.from_address = from_address
        self.from_name = from_name

        # Configure Brevo API
        configuration = sib_api_v3_sdk.Configuration()
        configuration.api_key["api-key"] = api_key

        self.api_client = sib_api_v3_sdk.ApiClient(configuration)
        self.api_instance = sib_api_v3_sdk.TransactionalEmailsApi(self.api_client)

    async def send_email(
        self,
        to: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        """
        Brevo SDK is synchronous → run it in a thread
        """
        return await anyio.to_thread.run_sync(
            self._send_sync,
            to,
            subject,
            html_body,
            text_body,
        )

    def _send_sync(
        self,
        to: str,
        subject: str,
        html_body: str,
        text_body: Optional[str],
    ) -> bool:
        """Send email via Brevo API"""
        try:
            email = sib_api_v3_sdk.SendSmtpEmail(
                to=[{"email": to}],
                subject=subject,
                html_content=html_body,
                text_content=text_body,
                sender={
                    "email": self.from_address,
                    "name": self.from_name,
                },
            )

            # Send email
            result = self.api_instance.send_transac_email(email)
            logger.info(
                "Email sent successfully to {} (Message ID: {})",
                mask_email(to),
                result.message_id,
            )
            return True
        except ApiException as e:
            logger.error(
                "Failed to send email to {} via Brevo: {}",
                mask_email(to),
                e,
            )
            return False
        except Exception as e:
            logger.error(
                "Unexpected error sending email to {} via Brevo: {}",
                mask_email(to),
                e,
            )
            return False
