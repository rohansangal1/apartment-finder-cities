"""
POST /api/deal-score — a Deal Score for each listing, computed in Python.

What it does: for every listing, compare its rent to the *median* rent of
comparable listings (same neighborhood + bedroom count). It reports how far
below/above median the rent is, and the listing's percentile within its group.

Statistical honesty is the whole point. We refuse to make a claim on too few
comparables: if a (neighborhood, bedrooms) group has fewer than MIN_GROUP
listings, we fall back to a citywide group (bedrooms only); if that's still too
thin, we omit the listing entirely rather than call something a "great deal"
based on two data points.

Dependencies: stdlib only (statistics, json, http.server). We deliberately skip
pandas/numpy — no requirements.txt means nothing to install, so cold starts stay
fast and there's no dependency to break.
"""
import json
import os
import statistics
from http.server import BaseHTTPRequestHandler


# Minimum comparables required before we'll make any claim about a listing.
# Below this in the tight (neighborhood, bedrooms) group we widen to citywide;
# below it there too, we drop the listing. Chosen so a "median" means something.
MIN_GROUP = 5


def _bedroom_phrase(bedrooms: int) -> str:
    """Human label for a bedroom count: 0 -> 'studios', else 'NBRs'."""
    return "studios" if bedrooms == 0 else f"{bedrooms}BRs"


def _percentile_rank(sorted_rents, rent):
    """Percentile of `rent` within `sorted_rents` (ascending), 0-100.

    Fraction of listings priced at or below this rent. Lower percentile = cheaper
    relative to the group (a better deal), so the UI can treat low as good.
    """
    n = len(sorted_rents)
    at_or_below = sum(1 for r in sorted_rents if r <= rent)
    return round(100 * at_or_below / n)


def _label(pct_vs_median: int, bedrooms: int, scope_name: str) -> str:
    """e.g. '12% below median for 1BRs in Chelsea' / '3% above median for studios in San Francisco'."""
    beds = _bedroom_phrase(bedrooms)
    if pct_vs_median < 0:
        return f"{abs(pct_vs_median)}% below median for {beds} in {scope_name}"
    if pct_vs_median > 0:
        return f"{pct_vs_median}% above median for {beds} in {scope_name}"
    return f"at the median for {beds} in {scope_name}"


def compute_scores(listings):
    """Core logic, separated from HTTP plumbing so it's easy to test/reason about.

    Returns a dict: { listing_id: {pctVsMedian, percentile, label, scope, groupSize} }.
    Listings without enough comparables (even citywide) are simply omitted.
    """
    # Bucket rents two ways up front so each listing can pick the tightest group
    # that still meets MIN_GROUP.
    by_hood_beds = {}   # (neighborhood_lower, bedrooms) -> [rent, ...]
    by_city_beds = {}   # (city_lower, bedrooms)         -> [rent, ...]

    for l in listings:
        rent = l.get("rentMonthly")
        if not isinstance(rent, (int, float)):
            continue
        bedrooms = int(l.get("bedrooms") or 0)
        hood = (l.get("neighborhood") or "").strip()
        city = (l.get("city") or "").strip()
        by_hood_beds.setdefault((hood.lower(), bedrooms), []).append(rent)
        by_city_beds.setdefault((city.lower(), bedrooms), []).append(rent)

    scores = {}
    for l in listings:
        lid = l.get("id")
        rent = l.get("rentMonthly")
        if lid is None or not isinstance(rent, (int, float)):
            continue
        bedrooms = int(l.get("bedrooms") or 0)
        hood = (l.get("neighborhood") or "").strip()
        city = (l.get("city") or "").strip()

        # Prefer the tight neighborhood group; fall back to citywide; else omit.
        group = by_hood_beds.get((hood.lower(), bedrooms), [])
        scope = "neighborhood"
        scope_name = hood or city
        if len(group) < MIN_GROUP:
            group = by_city_beds.get((city.lower(), bedrooms), [])
            scope = "citywide"
            scope_name = city
        if len(group) < MIN_GROUP:
            continue  # Not enough comparables to make an honest claim.

        median = statistics.median(group)
        if median <= 0:
            continue
        pct_vs_median = round(100 * (rent - median) / median)
        percentile = _percentile_rank(sorted(group), rent)

        scores[lid] = {
            "pctVsMedian": pct_vs_median,
            "percentile": percentile,
            "label": _label(pct_vs_median, bedrooms, scope_name),
            "scope": scope,
            "groupSize": len(group),
        }

    return scores


# ── CORS: mirror the Node handler's allowlist logic (api/_lib/handler.ts) ──────
# CORS is enforced by the browser per-origin, so every endpoint the browser calls
# must answer OPTIONS preflights and set the same headers — regardless of runtime.
def _allowed_origin(request_origin):
    raw = (os.environ.get("ALLOWED_ORIGINS") or "").strip()
    if not raw:
        return "*"  # Unset -> permissive default (dev/preview convenience).
    allowlist = [o.strip() for o in raw.split(",") if o.strip()]
    if request_origin and request_origin in allowlist:
        return request_origin
    return None  # Not allowlisted -> send no ACAO header; browser blocks the read.


class handler(BaseHTTPRequestHandler):
    def _set_cors(self):
        origin = self.headers.get("Origin")
        allow = _allowed_origin(origin)
        if allow:
            self.send_header("Access-Control-Allow-Origin", allow)
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors()
        self.end_headers()

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length) if length else b"{}"
            payload = json.loads(body or b"{}")
            listings = payload.get("listings") or []
            scores = compute_scores(listings)
            self._respond(200, {"scores": scores})
        except Exception as e:  # noqa: BLE001 — never 500 the client over a bad score
            self._respond(400, {"error": str(e)})

    def _respond(self, status, data):
        self.send_response(status)
        self._set_cors()
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))
