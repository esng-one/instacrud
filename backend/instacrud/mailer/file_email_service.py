import json
import re
from pathlib import Path
from datetime import datetime
from typing import Optional

from instacrud.mailer.email_service import EmailService


def safe_filename(value: str) -> str:
    """Make a string safe for use as a filename on all OSes."""
    value = value.lower()
    value = re.sub(r'[<>:"/\\|?*]', "_", value)
    return value


class FileEmailService(EmailService):
    def __init__(
        self,
        out_dir: str,
        from_address: str,
        from_name: str,
    ):
        self.from_address = from_address
        self.from_name = from_name
        self.out_dir = Path(out_dir)
        self.out_dir.mkdir(parents=True, exist_ok=True)

    async def send_email(
        self,
        to: str,
        subject: str,
        html_body: str,
        text_body: Optional[str] = None,
    ) -> bool:
        ts = datetime.utcnow().strftime("%Y%m%dT%H%M%S.%fZ")
        safe_to = safe_filename(to).replace("@", "_at_").replace(".", "_")
        base = f"{ts}-{safe_to}"

        try:
            # ----------------------------------------------------------
            # HTML (with optional header comment for readability)
            # ----------------------------------------------------------
            html_path = self.out_dir / f"{base}.html"
            html_with_header = (
                "<!--\n"
                f"From: {self.from_name} <{self.from_address}>\n"
                f"To: {to}\n"
                f"Subject: {subject}\n"
                f"Timestamp: {ts}\n"
                "-->\n\n"
                f"{html_body}"
            )
            html_path.write_text(html_with_header, encoding="utf-8")

            # ----------------------------------------------------------
            # Text (optional)
            # ----------------------------------------------------------
            if text_body:
                txt_path = self.out_dir / f"{base}.txt"
                txt_path.write_text(text_body, encoding="utf-8")

            # ----------------------------------------------------------
            # Metadata (canonical source of truth)
            # ----------------------------------------------------------
            meta = {
                "from": {
                    "email": self.from_address,
                    "name": self.from_name,
                },
                "to": to,
                "subject": subject,
                "timestamp": ts,
            }
            meta_path = self.out_dir / f"{base}.json"
            meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

            print(f"Dummy email written to {html_path}")
            return True

        except Exception as e:
            print(f"Failed to write dummy email: {e}")
            return False
