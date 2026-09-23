
## 1. ¿Qué dice la data?

| Archivo | Uso | Hallazgo relevante |
|---|---|---|
| `data.csv` | **Fuente principal** (170.653 tracks, 1921–2020, sin nulos ni ids duplicados) | Trae `artists` como lista serializada, sin género |
| `data_w_genres.csv` | **Cruce de género**: 1er artista del track → lista de géneros | 89 % de los tracks (152.406) encuentra géneros; 9.857 artistas tienen `[]` |
| `data_by_genres.csv`, `data_by_artist.csv`, `data_by_year.csv` | No se usan en las vistas | Son promedios: esconden la dispersión que queremos ver |

Diferencias medias que el perfilado ya anticipaba (motivan las preguntas):

| macro-género | energy | valence | danceability | acousticness | instrumentalness |
|---|---|---|---|---|---|
| classical | 0.18 | 0.27 | 0.34 | 0.93 | 0.56 |
| jazz | 0.33 | 0.51 | 0.52 | 0.76 | 0.33 |
| rock | 0.66 | 0.54 | 0.50 | 0.24 | 0.10 |
| hip hop | 0.66 | 0.53 | 0.72 | 0.17 | 0.02 |

Por década: loudness sube de −16,7 dB (1920s) a −6,6 dB (2020) y acousticness cae de 0,87 a 0,22.

---

## 2. Preprocesamiento: ¿qué se calcula y por qué? (`preprocessing.py`)

Todo con **polars** en modo *lazy* (`scan_csv` → `collect`): el plan de consulta se optimiza antes de
leer, y el pipeline completo sobre 170 k filas tarda ~0,6 s.

### 2.1 Lectura de listas serializadas

`artists` y `genres` vienen como texto `"['Tyler, The Creator', 'Frank Ocean']"`. **No** se puede partir
por `", "` porque hay artistas con coma en el nombre. Se extraen los ítems entre comillas con una
expresión regular (`'[^']*'|"[^"]*"`) y se les quitan las comillas.


### 2.2 Filtros de limpieza

| Filtro | Tracks afectados | Motivo |
|---|---|---|
| `speechiness > 0.66` | 4.966 | Según Spotify, > 0.66 es contenido hablado (audiolibros, poesía), no música |
| `tempo < 1` | 143 | tempo 0 = sin pulso detectable, error de extracción |
| `duration_ms > 900.000` | 668 | > 15 min: conciertos u obras completas, atípicos |
| sin macro-género | ≈ 32 k (contados antes de los otros filtros) | Sin género no se puede responder "¿coincide con el género?" |

Resultado: **138.216 tracks limpios**.

## Tasks

### P1 · ¿Cómo se agrupan los tracks según energy, valence, danceability y acousticness, y esos grupos coinciden con el macro-género?

- **Por qué RadViz:** ubica cada track según qué atributos *dominan* su perfil. Un track muy acústico cae
  junto al ancla `acousticness`, y uno bailable y alegre entre `danceability` y `valence`. Eso es
  exactamente "agrupar por carácter".


### P2 · ¿Qué combinación ponderada de atributos separa mejor a los géneros elegidos?

- **Por qué Star Coordinates:** es una proyección **lineal** en la que la magnitud sí importa (en RadViz
  no). Cada eje es un vector: **largo = peso** y **ángulo = dirección**. Cambiar pesos es cambiar la
  combinación lineal, que es literalmente lo que pregunta P2.

### P3 · ¿Cómo cambió el perfil sonoro entre 1921 y 2020, qué atributos cambian juntos y qué géneros rompen la tendencia?

- **Por qué coordenadas paralelas:** es la única de las tres que muestra **todos los atributos con sus
  valores reales** (año, dB, BPM) a la vez. Las correlaciones se leen entre ejes vecinos: líneas
  paralelas indican correlación positiva y líneas cruzadas, negativa.