from __future__ import annotations

import base64
from typing import Annotated, Any

from pydantic import AfterValidator, BaseModel, BeforeValidator, ConfigDict, PlainSerializer
from pydantic.alias_generators import to_camel

from app.core.encoding import b64decode_strict


class CamelModel(BaseModel):
    """camelCase on the wire, strict on input."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="forbid", from_attributes=True)


def _decode(value: Any) -> bytes:
    if isinstance(value, (bytes, bytearray, memoryview)):
        return bytes(value)
    if not isinstance(value, str):
        raise ValueError("expected base64 string")
    return b64decode_strict(value)


def b64_bytes(min_len: int, max_len: int) -> Any:
    """Base64 string on the wire, ``bytes`` in Python, with decoded-size bounds."""

    def _check(value: bytes) -> bytes:
        if not (min_len <= len(value) <= max_len):
            raise ValueError(f"decoded length must be between {min_len} and {max_len} bytes")
        return value

    return Annotated[
        bytes,
        BeforeValidator(_decode),
        AfterValidator(_check),
        PlainSerializer(lambda b: base64.b64encode(b).decode("ascii"), return_type=str, when_used="always"),
    ]
