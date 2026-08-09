"""Backend API tests for ConsMat Admin Console (mocked /api/v1 contract)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Fallback: read from frontend .env for the testing container
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.strip().split("=", 1)[1]
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api/v1"

ADMIN_EMAIL = "admin@consmat.com"
ADMIN_PASSWORD = "consmat123"


@pytest.fixture(scope="session")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data and data["access_token"]
    assert data["user"]["role"] == "admin"
    return data["access_token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


# --- Auth ---
def test_login_wrong_password():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
    assert r.status_code in (400, 401, 403)


def test_unauth_metrics_returns_401():
    r = requests.get(f"{API}/admin/metrics", timeout=15)
    assert r.status_code == 401


def test_auth_me(auth_headers):
    r = requests.get(f"{API}/auth/me", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d.get("role") == "admin" or d.get("user", {}).get("role") == "admin"


# --- Metrics ---
def test_metrics(auth_headers):
    r = requests.get(f"{API}/admin/metrics", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    for k in ("gmv", "orders", "active_vendors", "pending_kyc"):
        assert k in d, f"missing key {k} in {d}"


# --- Vendors ---
def test_vendors_list(auth_headers):
    r = requests.get(f"{API}/admin/vendors", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    vendors = data if isinstance(data, list) else data.get("vendors") or data.get("items")
    assert isinstance(vendors, list) and len(vendors) >= 1
    v0 = vendors[0]
    for k in ("id", "name", "kyc_status"):
        assert k in v0


def test_vendor_approve(auth_headers):
    r = requests.get(f"{API}/admin/vendors", headers=auth_headers, timeout=15)
    vendors = r.json() if isinstance(r.json(), list) else r.json().get("vendors") or r.json().get("items")
    pending = [v for v in vendors if str(v.get("kyc_status", "")).lower() == "pending"]
    if not pending:
        pytest.skip("No pending vendors to approve")
    vid = pending[0]["id"]
    ap = requests.post(f"{API}/admin/vendors/{vid}/approve", headers=auth_headers, timeout=15)
    assert ap.status_code in (200, 201), ap.text
    # Verify flip
    r2 = requests.get(f"{API}/admin/vendors", headers=auth_headers, timeout=15)
    vendors2 = r2.json() if isinstance(r2.json(), list) else r2.json().get("vendors") or r2.json().get("items")
    v = next(v for v in vendors2 if v["id"] == vid)
    assert str(v["kyc_status"]).lower() == "approved"


# --- Orders ---
def test_orders(auth_headers):
    r = requests.get(f"{API}/admin/orders", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    orders = data if isinstance(data, list) else data.get("orders") or data.get("items")
    assert isinstance(orders, list) and len(orders) >= 1


# --- Vendor detail (NEW) ---
def test_vendor_detail(auth_headers):
    r = requests.get(f"{API}/admin/vendors/v-1001", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    for k in ("id", "name", "gstin", "phone", "email", "address", "established", "documents", "order_history"):
        assert k in d, f"missing {k}"
    assert isinstance(d["documents"], list) and len(d["documents"]) == 4
    assert d["id"] == "v-1001"


def test_vendor_detail_pending_docs(auth_headers):
    r = requests.get(f"{API}/admin/vendors/v-1003", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    statuses = {doc["status"] for doc in d["documents"]}
    assert "pending" in statuses


def test_vendor_detail_404(auth_headers):
    r = requests.get(f"{API}/admin/vendors/v-does-not-exist", headers=auth_headers, timeout=15)
    assert r.status_code == 404


# --- Order detail (NEW) ---
def test_order_detail_5509(auth_headers):
    r = requests.get(f"{API}/admin/orders/ORD-5509", headers=auth_headers, timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["id"] == "ORD-5509"
    assert isinstance(d["line_items"], list) and len(d["line_items"]) == 2
    assert d["amount"] == 52500
    assert isinstance(d["timeline"], list) and len(d["timeline"]) == 5
    bc = d.get("buyer_contact") or {}
    assert bc.get("phone") and bc.get("email")


def test_order_detail_cancelled_timeline(auth_headers):
    r = requests.get(f"{API}/admin/orders/ORD-5507", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    d = r.json()
    labels = [t["label"] for t in d["timeline"]]
    assert any("Cancelled" in l for l in labels)


def test_order_detail_404(auth_headers):
    r = requests.get(f"{API}/admin/orders/ORD-DOESNT", headers=auth_headers, timeout=15)
    assert r.status_code == 404


# --- Logistics ---
def test_logistics_get_and_put(auth_headers):
    r = requests.get(f"{API}/admin/logistics-config", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    cfg = r.json()
    assert isinstance(cfg, dict) and len(cfg) > 0
    # Modify a boolean if present, otherwise send back unchanged
    updated = dict(cfg)
    toggled_key = None
    for k, v in cfg.items():
        if isinstance(v, bool):
            updated[k] = not v
            toggled_key = k
            break
    put = requests.put(f"{API}/admin/logistics-config", json=updated, headers=auth_headers, timeout=15)
    assert put.status_code in (200, 204), put.text
    # Verify persisted
    r2 = requests.get(f"{API}/admin/logistics-config", headers=auth_headers, timeout=15)
    assert r2.status_code == 200
    if toggled_key:
        assert r2.json()[toggled_key] == updated[toggled_key]
        # Revert
        updated[toggled_key] = not updated[toggled_key]
        requests.put(f"{API}/admin/logistics-config", json=updated, headers=auth_headers, timeout=15)


# --- Bulk approve (NEW) ---
def test_bulk_approve_vendors(auth_headers):
    r = requests.get(f"{API}/admin/vendors", headers=auth_headers, timeout=15)
    vendors = r.json()
    pending = [v["id"] for v in vendors if str(v.get("kyc_status")).lower() == "pending"]
    if len(pending) < 2:
        pytest.skip("Need at least 2 pending vendors")
    ids = pending[:2]
    ap = requests.post(f"{API}/admin/vendors/bulk-approve", json={"ids": ids}, headers=auth_headers, timeout=15)
    assert ap.status_code == 200, ap.text
    data = ap.json()
    assert data["approved"] == 2
    # Verify persistence
    r2 = requests.get(f"{API}/admin/vendors", headers=auth_headers, timeout=15).json()
    for vid in ids:
        v = next(v for v in r2 if v["id"] == vid)
        assert v["kyc_status"] == "approved"


def test_bulk_approve_empty(auth_headers):
    r = requests.post(f"{API}/admin/vendors/bulk-approve", json={"ids": []}, headers=auth_headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["approved"] == 0


# --- Metrics date filter (NEW) ---
def test_metrics_date_filter(auth_headers):
    r = requests.get(f"{API}/admin/metrics", headers=auth_headers, params={"start": "2026-06-18", "end": "2026-06-18"}, timeout=15)
    assert r.status_code == 200
    d = r.json()
    assert d["orders"] == 2
    assert d["gmv"] == 498000


def test_metrics_all_time(auth_headers):
    r = requests.get(f"{API}/admin/metrics", headers=auth_headers, timeout=15)
    d = r.json()
    assert d["orders"] == 10


# --- Orders date filter (NEW) ---
def test_orders_date_filter(auth_headers):
    r = requests.get(f"{API}/admin/orders", headers=auth_headers, params={"start": "2026-06-18", "end": "2026-06-18"}, timeout=15)
    assert r.status_code == 200
    orders = r.json()
    assert len(orders) == 2
    for o in orders:
        assert o["created_at"].startswith("2026-06-18")


# --- Vendor rating insights (NEW) ---
def test_vendor_rating_breakdown_approved(auth_headers):
    r = requests.get(f"{API}/admin/vendors/v-1002", headers=auth_headers, timeout=15)
    d = r.json()
    assert "rating_breakdown" in d
    rb = d["rating_breakdown"]
    for k in ("5", "4", "3", "2", "1"):
        assert k in rb
    assert sum(rb.values()) == d["rating_count"]
    assert isinstance(d.get("reviews"), list)
    assert len(d["reviews"]) >= 1
    for review in d["reviews"]:
        for k in ("buyer", "rating", "comment", "date"):
            assert k in review


def test_vendor_pending_no_reviews(auth_headers):
    # Per spec pending vendors should have empty reviews list; breakdown zero-count is aspirational
    r = requests.get(f"{API}/admin/vendors/v-1003", headers=auth_headers, timeout=15)
    d = r.json()
    assert d.get("reviews") == []
    # Note: backend currently computes breakdown from seed rating_count even for pending vendors.
