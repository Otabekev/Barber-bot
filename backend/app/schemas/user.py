from pydantic import BaseModel


class UserOut(BaseModel):
    id: int
    telegram_id: int
    full_name: str
    language: str
    is_admin: bool

    model_config = {"from_attributes": True}
