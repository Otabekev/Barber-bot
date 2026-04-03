"""Shared constants for the bot — mirrors frontend/src/districts.js."""

DISTRICTS: dict[str, list[str]] = {
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
}
