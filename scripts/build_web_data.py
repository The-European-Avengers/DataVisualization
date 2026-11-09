#!/usr/bin/env python3
"""Build the static data bundle consumed by the dashboard in web/.

Reads the processed panel and the TopoJSON boundaries, writes everything the
front-end needs into web/public/data/ (plus a copy of the report PDF).

The script is idempotent: run it after any change to data/processed/ and commit
the result, so the site builds in CI without a Python environment.

    python3 scripts/build_web_data.py
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path

import pandas as pd

REPO = Path(__file__).resolve().parent.parent
PROCESSED = REPO / "data" / "processed"
WEB_PUBLIC = REPO / "web" / "public"
OUT = WEB_PUBLIC / "data"

# Danish name -> English label shown in the UI (README: "Names in english").
ENGLISH_NAMES = {
    "Byen København": "City of Copenhagen",
    "Københavns omegn": "Copenhagen Suburbs",
    "Nordsjælland": "North Zealand",
    "Østsjælland": "East Zealand",
    "Vest- og Sydsjælland": "West and South Zealand",
    "Bornholm": "Bornholm",
    "Fyn": "Funen",
    "Sydjylland": "South Jutland",
    "Østjylland": "East Jutland",
    "Vestjylland": "West Jutland",
    "Nordjylland": "North Jutland",
}

# Side of the Great Belt. Matches BORNHOLM_SIDE = "east" in the notebook.
EAST = {
    "Byen København",
    "Københavns omegn",
    "Nordsjælland",
    "Østsjælland",
    "Vest- og Sydsjælland",
    "Bornholm",
}

MEASURES = [
    "n_sales",
    "avg_price_dkk",
    "n_families",
    "avg_disposable_income_dkk",
    "avg_pretax_income_dkk",
    "ratio_disposable",
    "ratio_pretax",
]


# --------------------------------------------------------------------------
# TopoJSON -> GeoJSON (polygons only), same approach as the prototype notebook
# --------------------------------------------------------------------------
def topojson_to_geojson(topo: dict, obj_name: str) -> dict:
    arcs_enc = topo["arcs"]
    tx = topo.get("transform")

    decoded = []
    for arc in arcs_enc:
        pts, x, y = [], 0, 0
        for dx, dy in arc:
            x += dx
            y += dy
            if tx:
                pts.append(
                    [
                        x * tx["scale"][0] + tx["translate"][0],
                        y * tx["scale"][1] + tx["translate"][1],
                    ]
                )
            else:
                pts.append([x, y])
        decoded.append(pts)

    def ring(indexes):
        out: list[list[float]] = []
        for i in indexes:
            pts = decoded[~i][::-1] if i < 0 else decoded[i]
            out.extend(pts if not out else pts[1:])
        return out

    def polygon(coords):
        return [ring(r) for r in coords]

    features = []
    for geom in topo["objects"][obj_name]["geometries"]:
        if geom["type"] == "Polygon":
            coords = polygon(geom["arcs"])
        elif geom["type"] == "MultiPolygon":
            coords = [polygon(p) for p in geom["arcs"]]
        else:
            raise ValueError(f"unsupported geometry: {geom['type']}")
        features.append(
            {
                "type": "Feature",
                "properties": geom.get("properties", {}),
                "geometry": {"type": geom["type"], "coordinates": coords},
            }
        )
    return {"type": "FeatureCollection", "features": features}


def ring_area_centroid(ring: list[list[float]]) -> tuple[float, float, float]:
    """Planar signed area and centroid of one ring (fine at Denmark's scale)."""
    a = cx = cy = 0.0
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        cross = x0 * y1 - x1 * y0
        a += cross
        cx += (x0 + x1) * cross
        cy += (y0 + y1) * cross
    a *= 0.5
    if a == 0:
        xs = [p[0] for p in ring]
        ys = [p[1] for p in ring]
        return 0.0, sum(xs) / len(xs), sum(ys) / len(ys)
    return a, cx / (6 * a), cy / (6 * a)


def largest_ring_centroid(feature: dict) -> list[float]:
    """Centroid of the biggest ring, so a spike never lands in the sea."""
    geom = feature["geometry"]
    rings = (
        [geom["coordinates"][0]]
        if geom["type"] == "Polygon"
        else [poly[0] for poly in geom["coordinates"]]
    )
    best = max(((abs(ring_area_centroid(r)[0]), r) for r in rings), key=lambda t: t[0])[1]
    _, lon, lat = ring_area_centroid(best)
    return [round(lon, 5), round(lat, 5)]


# --------------------------------------------------------------------------
def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(PROCESSED / "affordability_annual.csv")
    assert df.notna().all().all(), "panel has missing values"

    years = sorted(df["year"].unique().tolist())
    property_types = sorted(df["property_type"].unique().tolist())
    family_types = ["all_families", "couples", "singles"]
    assert set(family_types) == set(df["family_type"].unique())

    topo = json.loads((PROCESSED / "landsdele.topo.json").read_text())
    geo = topojson_to_geojson(topo, "landsdele")
    centroids = {
        f["properties"]["nuts3"]: largest_ring_centroid(f) for f in geo["features"]
    }

    provinces = (
        df[["nuts3", "landsdel"]]
        .drop_duplicates()
        .sort_values("nuts3")
        .to_dict("records")
    )
    for p in provinces:
        p["name"] = ENGLISH_NAMES[p["landsdel"]]
        p["da"] = p.pop("landsdel")
        p["side"] = "east" if p["name"] in {ENGLISH_NAMES[d] for d in EAST} else "west"
        p["centroid"] = centroids[p["nuts3"]]

    nuts_order = [p["nuts3"] for p in provinces]

    # Columnar panel: dimensions as indexes into the lists above, measures raw.
    panel = {
        "dims": {
            "year": years,
            "nuts3": nuts_order,
            "property_type": property_types,
            "family_type": family_types,
        },
        "columns": {
            "year": [years.index(v) for v in df["year"]],
            "nuts3": [nuts_order.index(v) for v in df["nuts3"]],
            "property_type": [property_types.index(v) for v in df["property_type"]],
            "family_type": [family_types.index(v) for v in df["family_type"]],
        },
    }
    for m in MEASURES:
        col = df[m]
        panel["columns"][m] = (
            col.astype(int).tolist()
            if m in {"n_sales", "n_families"}
            else [round(float(v), 4) for v in col]
        )
    panel["rows"] = len(df)

    meta = {
        "years": years,
        "provinces": provinces,
        "property_types": property_types,
        "family_types": family_types,
        "bornholm_side": "east",
        "source": "Statistics Denmark (EJEN77, INDKF111) and DAGI boundaries",
        "population": None,  # see PLAN.md 3.2
    }

    (OUT / "panel.json").write_text(json.dumps(panel, separators=(",", ":")))
    (OUT / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1))
    shutil.copyfile(PROCESSED / "landsdele.topo.json", OUT / "landsdele.topo.json")

    pdf = REPO / "report" / "main.pdf"
    if pdf.exists():
        (WEB_PUBLIC / "report").mkdir(parents=True, exist_ok=True)
        shutil.copyfile(pdf, WEB_PUBLIC / "report" / "main.pdf")

    for f in ["panel.json", "meta.json", "landsdele.topo.json"]:
        print(f"  {f:24} {(OUT / f).stat().st_size / 1024:7.1f} KB")
    print(f"  {panel['rows']} rows, {len(provinces)} provinces, {years[0]}-{years[-1]}")


if __name__ == "__main__":
    main()
