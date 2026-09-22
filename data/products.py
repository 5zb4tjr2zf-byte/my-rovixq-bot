CATEGORIES = {
    "roses": {"title": "Троянди", "emoji": "🌹"},
    "bouquets": {"title": "Авторські букети", "emoji": "💐"},
    "seasonal": {"title": "Сезонні квіти", "emoji": "🌷"},
    "compositions": {"title": "Композиції", "emoji": "🌸"},
    "gifts": {"title": "Подарункові набори", "emoji": "🎁"},
}

PRODUCTS = {
    "roses": [
        {
            "id": "r1",
            "name": "Червона класика",
            "description": "15 червоних троянд у стильному оформленні.",
            "price": 1500,
            "photo": "flower1.jpg",
        },
        {
            "id": "r2",
            "name": "Біла елегантність",
            "description": "11 білих троянд у крафтовому папері.",
            "price": 1350,
            "photo": "flower2.jpg",
        },
    ],
    "bouquets": [
        {
            "id": "b1",
            "name": "Осінній настрій",
            "description": "Авторська композиція з піоноподібних троянд та евкаліпта.",
            "price": 1900,
            "photo": "flower3.jpg",
        },
        {
            "id": "b2",
            "name": "Ніжність",
            "description": "Пастельний букет з півоній та матіоли.",
            "price": 2100,
            "photo": "flower4.jpg",
        },
    ],
    "seasonal": [
        {
            "id": "s1",
            "name": "Літній луг",
            "description": "Польові квіти з ромашками та волошками.",
            "price": 950,
            "photo": "flower5.jpg",
        },
        {
            "id": "s2",
            "name": "Тюльпановий мікс",
            "description": "25 різнокольорових тюльпанів.",
            "price": 1100,
            "photo": "flower6.jpg",
        },
    ],
    "compositions": [
        {
            "id": "c1",
            "name": "Квіти у коробці",
            "description": "Стильна композиція в круглій коробці.",
            "price": 1750,
            "photo": "flower7.jpg",
        },
        {
            "id": "c2",
            "name": "Кошик достатку",
            "description": "Композиція у плетеному кошику з зеленню.",
            "price": 2300,
            "photo": "flower8.jpg",
        },
    ],
    "gifts": [
        {
            "id": "g1",
            "name": "Букет + шоколад",
            "description": "Букет на вибір у поєднанні з бельгійським шоколадом.",
            "price": 1800,
            "photo": "flower9.jpg",
        },
        {
            "id": "g2",
            "name": "Романтичний набір",
            "description": "Букет, листівка та свічка у подарунковій упаковці.",
            "price": 2050,
            "photo": "flower10.jpg",
        },
    ],
}


def get_product(product_id: str):
    for items in PRODUCTS.values():
        for product in items:
            if product["id"] == product_id:
                return product
    return None


def get_category_for_product(product_id: str):
    for key, items in PRODUCTS.items():
        if any(p["id"] == product_id for p in items):
            return key
    return None
