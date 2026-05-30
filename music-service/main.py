import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from yandex_music import Client

app = FastAPI()


class SearchRequest(BaseModel):
    query: str
    limit: int = 12
    artist_limit: int = 3


class ArtistTracksRequest(BaseModel):
    artist_id: str
    limit: int = 12


def get_client():
    token = os.environ.get("YANDEX_MUSIC_TOKEN", "").strip()
    if not token:
        raise HTTPException(status_code=500, detail="YANDEX_MUSIC_TOKEN is missing")
    return Client(token).init()


def cover_url(cover_uri: str | None, size: int = 200) -> str | None:
    if not cover_uri:
        return None
    return f"https://{cover_uri}".replace("%%", f"{size}x{size}")


def artist_cover_url(artist, size: int = 200) -> str | None:
    cover = getattr(artist, "cover", None)
    uri = getattr(cover, "uri", None)
    if uri:
        return cover_url(uri, size)

    og_image = getattr(artist, "og_image", None)
    if og_image:
        return og_image if og_image.startswith("http") else f"https://{og_image.lstrip('/')}"

    return None


def serialize_track(track):
    artists = ", ".join(artist.name for artist in track.artists if artist.name) or "Unknown"
    year = None
    if track.albums and track.albums[0].year:
        year = int(track.albums[0].year)
    content_warning = getattr(track, "content_warning", None)
    explicit = bool(getattr(track, "explicit", False) or content_warning == "explicit")

    return {
        "trackId": str(track.id),
        "artist": artists,
        "title": track.title or "Unknown",
        "year": year,
        "yandexUrl": f"https://music.yandex.ru/track/{track.id}",
        "coverUrl": cover_url(track.cover_uri, 300),
        "explicit": explicit,
        "contentWarning": content_warning,
    }


def serialize_artist(artist):
    return {
        "artistId": str(artist.id),
        "name": artist.name or "Unknown",
        "coverUrl": artist_cover_url(artist, 300),
    }


@app.get("/health")
async def health():
    return {"ok": True}


@app.post("/search")
async def search_tracks(payload: SearchRequest):
    query = payload.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query is required")

    client = get_client()
    result = client.search(text=query, type_="all")
    if not result:
        return {"artists": [], "tracks": []}

    artists = []
    if result.artists and result.artists.results:
        artist_limit = max(1, payload.artist_limit)
        artists = [
            serialize_artist(artist)
            for artist in result.artists.results
            if getattr(artist, "id", None) is not None
        ][:artist_limit]

    tracks = []
    if result.tracks and result.tracks.results:
        track_limit = max(1, payload.limit)
        tracks = [serialize_track(track) for track in result.tracks.results[:track_limit]]

    return {"artists": artists, "tracks": tracks}


@app.post("/artist-tracks")
async def artist_tracks(payload: ArtistTracksRequest):
    artist_id = payload.artist_id.strip()
    if not artist_id:
        raise HTTPException(status_code=400, detail="artist_id is required")

    client = get_client()
    result = client.artists_tracks(artist_id, 0, max(1, payload.limit))
    if not result or not result.tracks:
        return {"items": []}

    return {
        "items": [serialize_track(track) for track in result.tracks[: max(1, payload.limit)]]
    }
