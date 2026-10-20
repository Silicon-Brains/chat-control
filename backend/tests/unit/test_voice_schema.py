import base64
import uuid

import pytest
from pydantic import ValidationError

from app.schemas.message import WsMessageSend


def test_voice_sized_ciphertext_is_accepted() -> None:
    event = WsMessageSend.model_validate(
        {
            "t": "message.send",
            "id": str(uuid.uuid4()),
            "conversationId": str(uuid.uuid4()),
            "ciphertext": base64.b64encode(b"x" * 32_000).decode(),
            "nonce": base64.b64encode(b"n" * 12).decode(),
            "keyVersion": 1,
        }
    )
    assert len(event.ciphertext) == 32_000


def test_ciphertext_above_storage_limit_is_rejected() -> None:
    with pytest.raises(ValidationError):
        WsMessageSend.model_validate(
            {
                "t": "message.send",
                "id": str(uuid.uuid4()),
                "conversationId": str(uuid.uuid4()),
                "ciphertext": base64.b64encode(b"x" * 262_145).decode(),
                "nonce": base64.b64encode(b"n" * 12).decode(),
                "keyVersion": 1,
            }
        )
