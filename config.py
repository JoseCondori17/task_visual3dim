from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="SPOTIFY_", env_file=".env", extra="ignore")

    # --- Archivos ---
    data_dir: Path = BASE_DIR / "data"
    tracks_file: str = "data.csv"
    artist_genres_file: str = "data_w_genres.csv"
    genres_file: str = "data_by_genres.csv"
    year_file: str = "data_by_year.csv"

    # --- Atributos de audio ---
    # Acotados en [0, 1] por Spotify
    unit_features: list[str] = [
        "danceability", "energy", "valence", "acousticness",
        "instrumentalness", "speechiness", "liveness",
    ]
    # Con escala propia: se normalizan en el preprocesamiento
    scaled_features: list[str] = ["loudness", "tempo"]

    # --- Filtros de limpieza ---
    max_speechiness: float = 0.66      # > 0.66 = contenido hablado
    min_tempo: float = 1.0             # tempo 0 = pista sin pulso detectable
    max_duration_ms: int = 900_000     # > 15 min = grabaciones completas/atípicas
    
    macro_genres: dict[str, list[str]] = {
        "classical": ["classical", "orchestra", "baroque", "opera", "choral", "early music", "chamber", "compositional"],
        "jazz": ["jazz", "swing", "bebop", "big band", "bossa nova"],
        "hip hop": ["hip hop", "rap", "trap", "drill"],
        "electronic": ["edm", "house", "techno", "electro", "trance", "dubstep", "drum and bass", "big room"],
        "latin": ["latin", "reggaeton", "salsa", "bachata", "cumbia", "tango", "bolero", "mexican",
                  "ranchera", "banda", "mariachi", "norteno", "cubano", "trova"],
        "country/folk": ["country", "folk", "bluegrass", "americana", "singer-songwriter"],
        "r&b/soul": ["r&b", "soul", "funk", "motown", "disco", "quiet storm"],
        "rock": ["rock", "metal", "punk", "grunge", "emo", "hardcore"],
        "pop": ["pop", "adult standards", "easy listening", "lounge", "vocal"],
    }

    clip_quantiles: tuple[float, float] = (0.01, 0.99)

    sample_per_genre: int = 300
    random_state: int = 42

    # --- Estado inicial de las vistas (ver DISENO.md) ---
    default_focus_genres: list[str] = ["classical", "rock", "hip hop"]
    radviz_anchors: list[str] = ["energy", "valence", "danceability", "acousticness"]

    @property
    def features(self) -> list[str]:
        return self.unit_features + self.scaled_features

    def path(self, name: str) -> Path:
        return self.data_dir / name


settings = Settings()
