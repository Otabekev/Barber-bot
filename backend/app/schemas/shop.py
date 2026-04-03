from pydantic import BaseModel, field_validator, model_validator
from typing import Optional

UZBEKISTAN_REGIONS = [
    "Toshkent shahri",
    "Toshkent viloyati",
    "Samarqand",
    "Buxoro",
    "Farg'ona",
    "Andijon",
    "Namangan",
    "Qashqadaryo",
    "Surxondaryo",
    "Xorazm",
    "Navoiy",
    "Jizzax",
    "Sirdaryo",
    "Qoraqalpog'iston",
]


UZBEKISTAN_DISTRICTS: dict[str, list[str]] = {
    "Toshkent shahri": [
        "Bektemir", "Chilonzor", "Mirzo Ulug'bek", "Mirobod",
        "Sergeli", "Shayxontohur", "Uchtepa", "Olmazor",
        "Yakkasaray", "Yunusobod", "Yashnobod",
    ],
    "Toshkent viloyati": [
        "Angren", "Bekobod", "Bo'stonliq", "Bo'ka", "Chinoz",
        "Ohangaron", "Oqqo'rg'on", "Parkent", "Piskent", "Qibray",
        "Toshkent tumani", "O'rtachirchiq", "Yangiyul", "Zangiota",
        "Keles", "Nurafshon",
    ],
    "Samarqand": [
        "Bulung'ur", "Ishtixon", "Jomboy", "Kattaqo'rg'on", "Narpay",
        "Nurobod", "Oqdaryo", "Paxtachi", "Payariq", "Pastdarg'om",
        "Qo'shrabot", "Samarqand tumani", "Toyloq", "Urgut",
    ],
    "Buxoro": [
        "Buxoro tumani", "G'ijduvon", "Jondor", "Kogon", "Qorako'l",
        "Qorovulbozor", "Olot", "Peshku", "Romitan", "Shofirkon", "Vobkent",
    ],
    "Farg'ona": [
        "Oltiariq", "Bag'dod", "Beshariq", "Buvayda", "Dang'ara",
        "Farg'ona tumani", "Furqat", "Qo'qon", "Quva", "Rishton",
        "So'x", "Toshloq", "Uchko'prik", "O'zbekiston tumani", "Yozyovon",
    ],
    "Andijon": [
        "Andijon tumani", "Asaka", "Baliqchi", "Bo'z", "Buloqboshi",
        "Izbaskan", "Jalaquduq", "Xo'jaobod", "Marhamat", "Oltinko'l",
        "Paxtaobod", "Qo'rg'ontepa", "Shahrixon", "Ulug'nor",
    ],
    "Namangan": [
        "Chortoq", "Chust", "Kosonsoy", "Mingbuloq", "Namangan tumani",
        "Norin", "Pop", "To'raqo'rg'on", "Uchqo'rg'on", "Yangiqo'rg'on",
        "Davlatobod", "Tojiobod", "Ulug'nor tumani",
    ],
    "Qashqadaryo": [
        "Chiroqchi", "Dehqonobod", "G'uzor", "Kasbi", "Kitob",
        "Koson", "Mirishkor", "Muborak", "Nishon", "Qamashi",
        "Qarshi tumani", "Shahrisabz", "Yakkabog'",
    ],
    "Surxondaryo": [
        "Angor", "Bandixon", "Boysun", "Denov", "Jarqo'rg'on",
        "Kumkurg'on", "Muzrabot", "Oltinsoy", "Qiziriq", "Sariosiyo",
        "Sherobod", "Sho'rchi", "Termiz tumani", "Uzun",
    ],
    "Xorazm": [
        "Bog'ot", "Gurlan", "Xazorasp", "Xiva tumani", "Xonqa",
        "Qo'shko'pir", "Urganch tumani", "Shovot", "Tuproqqal'a",
        "Yangiariq", "Yangibozor",
    ],
    "Navoiy": [
        "Karmana", "Konimex", "Navbahor", "Navoiy tumani",
        "Nurota", "Qiziltepa", "Tomdi", "Uchquduq", "Xatirchi", "Zarafshon",
    ],
    "Jizzax": [
        "Arnasoy", "Baxmal", "Do'stlik", "Forish", "G'allaorol",
        "Jizzax tumani", "Mirzacho'l", "Paxtakor", "Sharof Rashidov",
        "Yangiobod", "Zafarobod", "Zomin", "Zarbdor",
    ],
    "Sirdaryo": [
        "Baxt", "Boyovut", "Guliston tumani", "Havast", "Mirzaobod",
        "Oqoltin", "Sardoba", "Sayxunobod", "Shirin", "Sirdaryo tumani", "Yangiyer",
    ],
    "Qoraqalpog'iston": [
        "Amudaryo", "Beruniy", "Chimboy", "Ellikkala", "Kegeyli",
        "Mo'ynoq", "Nukus tumani", "Qanliko'l", "Qo'ng'irot",
        "Qorao'zak", "Shumanay", "Taxtako'pir", "To'rtko'l", "Xo'jayli",
    ],
}


class ShopCreate(BaseModel):
    name: str
    region: str = "Toshkent shahri"
    city: str
    address: str
    phone: str
    slot_duration: int = 30
    description: Optional[str] = None
    district: Optional[str] = None
    beard_duration: Optional[int] = None

    @field_validator("slot_duration")
    @classmethod
    def validate_slot_duration(cls, v: int) -> int:
        if v not in (15, 20, 30, 45, 60):
            raise ValueError("slot_duration must be one of 15, 20, 30, 45, 60")
        return v

    @field_validator("beard_duration")
    @classmethod
    def validate_beard_duration(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v not in (5, 10, 15):
            raise ValueError("beard_duration must be one of 5, 10, 15 or null")
        return v

    @field_validator("region")
    @classmethod
    def validate_region(cls, v: str) -> str:
        if v not in UZBEKISTAN_REGIONS:
            raise ValueError(f"region must be one of {UZBEKISTAN_REGIONS}")
        return v


class ShopUpdate(BaseModel):
    name: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    slot_duration: Optional[int] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None
    district: Optional[str] = None
    beard_duration: Optional[int] = None

    @field_validator("slot_duration")
    @classmethod
    def validate_slot_duration(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v not in (15, 20, 30, 45, 60):
            raise ValueError("slot_duration must be one of 15, 20, 30, 45, 60")
        return v

    @field_validator("beard_duration")
    @classmethod
    def validate_beard_duration(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v not in (5, 10, 15):
            raise ValueError("beard_duration must be one of 5, 10, 15 or null")
        return v

    @field_validator("region")
    @classmethod
    def validate_region(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in UZBEKISTAN_REGIONS:
            raise ValueError(f"region must be one of {UZBEKISTAN_REGIONS}")
        return v


class ShopOut(BaseModel):
    id: int
    owner_id: int
    name: str
    region: str
    city: str
    address: str
    phone: str
    slot_duration: int
    is_approved: bool
    is_active: bool
    is_rejected: bool = False
    description: Optional[str] = None
    has_photo: bool = False
    district: Optional[str] = None
    beard_duration: Optional[int] = None
    avg_rating: Optional[float] = None
    review_count: Optional[int] = None

    model_config = {"from_attributes": True}
