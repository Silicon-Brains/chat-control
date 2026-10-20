import pytest
from pydantic import ValidationError

from app.schemas.conversation import UpdateGroupRequest


def test_group_update_accepts_name_and_icon_and_trims_name() -> None:
    update = UpdateGroupRequest.model_validate({"name": "  Team  ", "groupIcon": "🎯"})
    assert update.name == "Team"
    assert update.group_icon == "🎯"


def test_group_update_requires_a_nonempty_name_and_an_update_field() -> None:
    with pytest.raises(ValidationError):
        UpdateGroupRequest.model_validate({"name": "   "})
    with pytest.raises(ValidationError):
        UpdateGroupRequest.model_validate({"name": None})
    with pytest.raises(ValidationError):
        UpdateGroupRequest.model_validate({})
