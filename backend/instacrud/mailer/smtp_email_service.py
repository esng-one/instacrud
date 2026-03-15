import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import anyio
from loguru import logger

from instacrud.mailer.email_service import EmailService, mask_email


class SmtpEmailService(EmailService):
    """SMTP email service implementation"""

    def __init__(
        self,
        host: str,
        port: int,
        from_address: str,
        from_name: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
        use_tls: bool = True,
        use_ssl: bool = False,
    ):
        self.host = host
        self.port = port
        self.from_address = from_address
        self.from_name = from_name
        self.username = username
        self.password = password
        self.use_tls = use_tls
        self.use_ssl = use_ssl

    async def send_email(
        self,
        to: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        """
        Send email via SMTP (runs in a thread to verify blocking I/O)
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
        """Synchronous SMTP sending logic"""
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_address}>"
            msg["To"] = to

            # Attach parts (text first, then HTML as per standard)
            if text_body:
                part1 = MIMEText(text_body, "plain")
                msg.attach(part1)
            
            part2 = MIMEText(html_body, "html")
            msg.attach(part2)

            # Connect to SMTP server
            if self.use_ssl:
                server = smtplib.SMTP_SSL(self.host, self.port)
            else:
                server = smtplib.SMTP(self.host, self.port)
                if self.use_tls:
                    server.starttls()

            if self.username and self.password:
                server.login(self.username, self.password)

            server.send_message(msg)
            server.quit()

            logger.info("Email sent successfully to via SMTP to {}", mask_email(to))
            return True

        except Exception as e:
            logger.error(
                "Failed to send email to {} via SMTP: {}",
                mask_email(to),
                e,
            )
            return False
