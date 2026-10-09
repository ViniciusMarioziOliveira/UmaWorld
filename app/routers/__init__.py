from . import afk, auth, characters, gacha, hub, inventory, missions, profile, ranking, shop, ws

ALL = [auth.router, hub.router, gacha.router, characters.router, afk.router, inventory.router,
       missions.router, shop.router, profile.router, ranking.router, ws.router]
