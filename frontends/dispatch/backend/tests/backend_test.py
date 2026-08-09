"""Backend contract tests for Consmat Operator mock API (/api/v1)."""
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE:
    # fall back to reading frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE = line.split("=", 1)[1].strip()
BASE = BASE.rstrip("/")
API = f"{BASE}/api/v1"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": "operator@consmat.in", "password": "consmat123"},
                      timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data and data["user"]["role"] == "operator"
    return data["access_token"]


@pytest.fixture
def h(token):
    return {"Authorization": f"Bearer {token}"}


# auth
def test_login_invalid():
    r = requests.post(f"{API}/auth/login",
                      json={"email": "operator@consmat.in", "password": "wrong"}, timeout=15)
    assert r.status_code == 401


def test_login_ok(token):
    assert isinstance(token, str) and len(token) > 5


def test_queue_requires_auth():
    r = requests.get(f"{API}/operator/dispatch-queue", timeout=15)
    assert r.status_code == 401


# dispatch queue
def test_dispatch_queue(h):
    r = requests.get(f"{API}/operator/dispatch-queue", headers=h, timeout=15)
    assert r.status_code == 200
    data = r.json()
    tickets = data["tickets"]
    assert len(tickets) >= 4
    t = tickets[0]
    for k in ("order_id", "status", "customer", "vendors", "total", "vendor_count", "item_count"):
        assert k in t
    assert t["customer"].get("name")
    assert t["vendors"][0].get("subtotal") is not None
    assert t["vendors"][0].get("rating") is not None


# network stock
def test_network_stock(h):
    r = requests.get(f"{API}/operator/network-stock", headers=h, timeout=15)
    assert r.status_code == 200
    products = r.json()["products"]
    assert len(products) >= 5
    p = products[0]
    for k in ("product_id", "name", "vendors", "total_available", "unit"):
        assert k in p
    # ensure OUT-OF-STOCK vendor exists somewhere
    assert any(v["stock"] == 0 for p in products for v in p["vendors"])


# lifecycle: pick a pending ticket, dispatch it, then deliver
def test_dispatch_then_deliver(h):
    r = requests.get(f"{API}/operator/dispatch-queue", headers=h, timeout=15)
    tickets = r.json()["tickets"]
    pending = next((t for t in tickets if t["status"] == "pending"), None)
    assert pending, "no pending ticket to test"
    oid = pending["order_id"]

    d = requests.post(f"{API}/operator/dispatch/{oid}", headers=h, timeout=15)
    assert d.status_code == 200, d.text
    assert d.json()["status"] == "dispatched"

    dv = requests.post(f"{API}/operator/deliver/{oid}", headers=h, timeout=15)
    assert dv.status_code == 200
    assert dv.json()["status"] == "delivered"

    # verify persistence
    r2 = requests.get(f"{API}/operator/dispatch-queue", headers=h, timeout=15)
    match = [t for t in r2.json()["tickets"] if t["order_id"] == oid][0]
    assert match["status"] == "delivered"


def test_dispatch_not_found(h):
    r = requests.post(f"{API}/operator/dispatch/ORD-NOPE", headers=h, timeout=15)
    assert r.status_code == 404


# reorder (iteration 3)
def test_reorder_product_level(h):
    # get baseline for P-CEM-53
    r0 = requests.get(f"{API}/operator/network-stock", headers=h, timeout=15)
    p0 = next(p for p in r0.json()["products"] if p["product_id"] == "P-CEM-53")
    baseline = p0["total_available"]

    r = requests.post(f"{API}/operator/reorder", headers=h,
                      json={"product_id": "P-CEM-53"}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["ok"] is True
    assert data["reorder_id"].startswith("RO-")
    assert data["product_id"] == "P-CEM-53"
    assert isinstance(data["qty"], int) and data["qty"] > 0
    assert data["product"]["total_available"] == baseline + data["qty"]

    # verify persistence via GET
    r2 = requests.get(f"{API}/operator/network-stock", headers=h, timeout=15)
    p2 = next(p for p in r2.json()["products"] if p["product_id"] == "P-CEM-53")
    assert p2["total_available"] == baseline + data["qty"]


def test_reorder_specific_vendor_restocks_out_of_stock(h):
    # Fly Ash Bricks vendor V-03 is seeded at 0
    r = requests.post(f"{API}/operator/reorder", headers=h,
                      json={"product_id": "P-BRK-FLY", "vendor_id": "V-03"}, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["vendor_name"].lower().startswith("coromandel")
    assert data["qty"] > 0

    # verify V-03 stock is no longer 0
    r2 = requests.get(f"{API}/operator/network-stock", headers=h, timeout=15)
    prod = next(p for p in r2.json()["products"] if p["product_id"] == "P-BRK-FLY")
    v03 = next(v for v in prod["vendors"] if v["vendor_id"] == "V-03")
    assert v03["stock"] > 0


def test_reorder_requires_auth():
    r = requests.post(f"{API}/operator/reorder",
                      json={"product_id": "P-CEM-53"}, timeout=15)
    assert r.status_code == 401


def test_reorder_unknown_product(h):
    r = requests.post(f"{API}/operator/reorder", headers=h,
                     json={"product_id": "P-NOPE"}, timeout=15)
    assert r.status_code == 404


def test_dispatched_ticket_has_eta_at(h):
    r = requests.get(f"{API}/operator/dispatch-queue", headers=h, timeout=15)
    tickets = r.json()["tickets"]
    disp = [t for t in tickets if t["status"] == "dispatched"]
    assert disp, "expected at least one dispatched ticket in seed"
    for t in disp:
        assert t.get("eta_at"), f"dispatched ticket {t['order_id']} missing eta_at"
        assert isinstance(t.get("eta_minutes"), int)


def test_dispatch_sets_eta_at(h):
    r = requests.get(f"{API}/operator/dispatch-queue", headers=h, timeout=15)
    pending = next((t for t in r.json()["tickets"] if t["status"] == "pending"), None)
    if not pending:
        pytest.skip("no pending ticket to dispatch")
    d = requests.post(f"{API}/operator/dispatch/{pending['order_id']}", headers=h, timeout=15)
    assert d.status_code == 200
    t = d.json()["ticket"]
    assert t["status"] == "dispatched"
    assert t.get("eta_at"), "eta_at should be set after dispatch"


# ---------------- iteration 4: delivery proof ----------------
def test_deliver_with_photo_proof_persists(h):
    # dispatch a pending first so we don't consume seed dispatched tickets used by other tests
    r = requests.get(f"{API}/operator/dispatch-queue", headers=h, timeout=15)
    pending = next((t for t in r.json()["tickets"] if t["status"] == "pending"), None)
    if not pending:
        pytest.skip("no pending ticket")
    requests.post(f"{API}/operator/dispatch/{pending['order_id']}", headers=h, timeout=15)
    oid = pending["order_id"]
    proof_data = "data:image/jpeg;base64,AAAA"
    dv = requests.post(f"{API}/operator/deliver/{oid}", headers=h,
                       json={"proof": proof_data, "proof_type": "photo", "note": "left at gate"},
                       timeout=15)
    assert dv.status_code == 200, dv.text
    body = dv.json()
    assert body["status"] == "delivered"
    t = body["ticket"]
    assert t.get("proof") == proof_data
    assert t.get("proof_type") == "photo"
    assert t.get("note") == "left at gate"

    r2 = requests.get(f"{API}/operator/dispatch-queue", headers=h, timeout=15)
    m = next(t for t in r2.json()["tickets"] if t["order_id"] == oid)
    assert m["status"] == "delivered"
    assert m["proof"] == proof_data
    assert m["note"] == "left at gate"


def test_deliver_without_proof_still_works(h):
    r = requests.get(f"{API}/operator/dispatch-queue", headers=h, timeout=15)
    disp = next((t for t in r.json()["tickets"] if t["status"] == "dispatched"), None)
    if not disp:
        pytest.skip("no dispatched ticket")
    dv = requests.post(f"{API}/operator/deliver/{disp['order_id']}", headers=h, json={}, timeout=15)
    assert dv.status_code == 200
    assert dv.json()["status"] == "delivered"


# ---------------- iteration 4: overdue seed ----------------
def test_seed_ord_24788_is_overdue(h):
    r = requests.get(f"{API}/operator/dispatch-queue", headers=h, timeout=15)
    from datetime import datetime
    t = next((x for x in r.json()["tickets"] if x["order_id"] == "ORD-24788"), None)
    assert t, "ORD-24788 must be present in seed"
    assert t["status"] == "dispatched"
    assert t.get("eta_at")
    eta = datetime.fromisoformat(t["eta_at"].replace("Z", "+00:00"))
    from datetime import timezone
    assert eta < datetime.now(timezone.utc), "ORD-24788 eta must already be past"


def test_seed_ord_24805_not_overdue(h):
    r = requests.get(f"{API}/operator/dispatch-queue", headers=h, timeout=15)
    from datetime import datetime, timezone
    t = next((x for x in r.json()["tickets"] if x["order_id"] == "ORD-24805"), None)
    if not t:
        pytest.skip("ORD-24805 not present (already delivered by prior test run)")
    if t["status"] != "dispatched":
        pytest.skip("ORD-24805 no longer dispatched")
    eta = datetime.fromisoformat(t["eta_at"].replace("Z", "+00:00"))
    assert eta > datetime.now(timezone.utc), "ORD-24805 eta should still be in the future"


# ---------------- iteration 4: reorder with vendor_id + qty ----------------
def test_reorder_with_vendor_and_qty_exact(h):
    # baseline
    r0 = requests.get(f"{API}/operator/network-stock", headers=h, timeout=15)
    prod0 = next(p for p in r0.json()["products"] if p["product_id"] == "P-TMT-550")
    v0 = next(v for v in prod0["vendors"] if v["vendor_id"] == "V-02")
    baseline = v0["stock"]

    r = requests.post(f"{API}/operator/reorder", headers=h,
                      json={"product_id": "P-TMT-550", "vendor_id": "V-02", "qty": 7},
                      timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["qty"] == 7
    assert data["vendor_name"].lower().startswith("sri balaji")

    r2 = requests.get(f"{API}/operator/network-stock", headers=h, timeout=15)
    prod2 = next(p for p in r2.json()["products"] if p["product_id"] == "P-TMT-550")
    v2 = next(v for v in prod2["vendors"] if v["vendor_id"] == "V-02")
    assert v2["stock"] == baseline + 7


# ---------------- iteration 4: shared views CRUD ----------------
def test_shared_views_list_has_seed(h):
    r = requests.get(f"{API}/operator/views", headers=h, timeout=15)
    assert r.status_code == 200
    views = r.json()["views"]
    seed = next((v for v in views if v["id"] == "sv-seed-1"), None)
    assert seed is not None
    assert seed["name"] == "High priority"
    assert seed["created_by"] == "Team"


def test_shared_views_create_and_delete(h):
    payload = {"name": "TEST_view", "filter": "dispatched", "search": "cement", "sort": "priority"}
    c = requests.post(f"{API}/operator/views", headers=h, json=payload, timeout=15)
    assert c.status_code == 200, c.text
    v = c.json()["view"]
    assert v["id"].startswith("sv-")
    assert v["name"] == "TEST_view"
    assert v["filter"] == "dispatched"
    assert v["search"] == "cement"

    # ensure it appears in list
    lst = requests.get(f"{API}/operator/views", headers=h, timeout=15).json()["views"]
    assert any(x["id"] == v["id"] for x in lst)

    d = requests.delete(f"{API}/operator/views/{v['id']}", headers=h, timeout=15)
    assert d.status_code == 200
    lst2 = requests.get(f"{API}/operator/views", headers=h, timeout=15).json()["views"]
    assert not any(x["id"] == v["id"] for x in lst2)


def test_shared_view_delete_404(h):
    r = requests.delete(f"{API}/operator/views/sv-nope-xxx", headers=h, timeout=15)
    assert r.status_code == 404


def test_shared_views_requires_auth():
    r = requests.get(f"{API}/operator/views", timeout=15)
    assert r.status_code == 401
