"""File email carrier: dumps stay inside the output folder whatever the recipient looks like."""

import pytest

from instacrud.mailer.file_email_service import FileEmailService, safe_filename


def test_safe_filename_keeps_only_plain_characters():
    assert safe_filename("../../Evil/..\\x:y*z") == "______evil____x_y_z"


@pytest.mark.asyncio
@pytest.mark.parametrize("to", ["user@test.com", "../../escape@test.com", "..\\..\\escape@x.com", "a/b\\c@d.e"])
async def test_dump_stays_in_out_dir(tmp_path, to):
    out = tmp_path / "mail"
    service = FileEmailService(str(out), "noreply@test.com", "Test")

    assert await service.send_email(to, "Hi", "<p>hi</p>", "hi")

    written = [p for p in tmp_path.rglob("*") if p.is_file()]
    assert len(written) == 3  # html, txt, json
    assert all(p.parent == out.resolve() for p in written)
