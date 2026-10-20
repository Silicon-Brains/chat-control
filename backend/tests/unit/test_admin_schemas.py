import pytest
from pydantic import ValidationError

from app.schemas.user import AdminUpdateUserRequest


def test_admin_user_updates_accept_role_and_verification_fields() -> None:
    assert AdminUpdateUserRequest.model_validate({"role": "admin"}).role == "admin"
    verification = AdminUpdateUserRequest.model_validate({"managementVerified": False})
    assert verification.management_verified is False


def test_admin_user_updates_reject_empty_or_mixed_status_fields() -> None:
    with pytest.raises(ValidationError):
        AdminUpdateUserRequest.model_validate({})
    with pytest.raises(ValidationError):
        AdminUpdateUserRequest.model_validate({"status": "active", "role": "admin"})
