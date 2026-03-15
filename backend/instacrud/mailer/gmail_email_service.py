from instacrud.mailer.smtp_email_service import SmtpEmailService

class GmailEmailService(SmtpEmailService):
    """
    Gmail email service implementation.
    This is a wrapper around SmtpEmailService with preset Gmail settings.
    """

    def __init__(
        self,
        username: str,
        password: str,
        from_address: str,
        from_name: str,
    ):
        super().__init__(
            host="smtp.gmail.com",
            port=587,
            username=username,
            password=password,
            use_tls=True,
            use_ssl=False,
            from_address=from_address,
            from_name=from_name,
        )
