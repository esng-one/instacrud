"""
Email template rendering functions using Jinja2.
"""

from datetime import datetime
from pathlib import Path
from jinja2 import Environment, FileSystemLoader, select_autoescape


# ------------------------------------------------------------------
# Jinja2 environment
# ------------------------------------------------------------------

TEMPLATES_DIR = Path(__file__).parent / "templates"

jinja_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(['html', 'xml'])
)


# ------------------------------------------------------------------
# Shared global context & helpers
# ------------------------------------------------------------------

def _global_context() -> dict:
    return {
        "year": datetime.utcnow().year,
        "support_text": "If you did not request this email, you can safely ignore it.",
    }


def _render_with_context(
    html_template_name: str,
    text_template_name: str,
    context: dict,
) -> tuple[str, str]:
    """
    Render email body + footer for both HTML and text templates.
    """
    base_context = {
        **context,
        "global": _global_context(),
    }

    html_template = jinja_env.get_template(html_template_name)
    text_template = jinja_env.get_template(text_template_name)

    html_body = html_template.render(**base_context)
    text_body = text_template.render(**base_context)

    return html_body, text_body


# ------------------------------------------------------------------
# Invitation email
# ------------------------------------------------------------------

def render_invitation_email(
    org_name: str,
    inviter_name: str,
    role: str,
    invitation_link: str,
    expires_at: datetime,
) -> tuple[str, str]:
    """
    Render invitation email templates.

    Args:
        org_name: Organization name
        inviter_name: Name of person who sent the invitation
        role: Role being assigned
        invitation_link: Full URL to accept invitation
        expires_at: Expiration datetime

    Returns:
        Tuple of (html_body, text_body)
    """
    context = {
        "org_name": org_name,
        "inviter_name": inviter_name,
        "role": role,
        "invitation_link": invitation_link,
        "expires_at": expires_at.strftime("%B %d, %Y at %I:%M %p UTC"),
    }

    return _render_with_context(
        html_template_name="invitation.html",
        text_template_name="invitation.txt",
        context=context,
    )


# ------------------------------------------------------------------
# Password reset email
# ------------------------------------------------------------------

def render_password_reset_email(
    user_name: str,
    reset_link: str,
    expires_at: datetime,
) -> tuple[str, str]:
    """
    Render password reset email templates.

    Args:
        user_name: Name of the user
        reset_link: Full URL to reset password
        expires_at: Expiration datetime

    Returns:
        Tuple of (html_body, text_body)
    """
    context = {
        "user_name": user_name,
        "reset_link": reset_link,
        "expires_at": expires_at.strftime("%B %d, %Y at %I:%M %p UTC"),
    }

    return _render_with_context(
        html_template_name="password_reset.html",
        text_template_name="password_reset.txt",
        context=context,
    )
