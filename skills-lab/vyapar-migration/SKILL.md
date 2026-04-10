---
name: vyapar-migration
description: "Authoritative Vyapar schema knowledge. Use when the user mentions Vyapar, .vyb files, .vyp SQLite databases, reading Vyapar data, or any task that requires understanding Vyapar's internal structure. Triggers on: \"vyapar\", \"vyb file\", \"vyp file\", \"vyapar backup\", \"vyapar schema\", \"vyapar sqlite\", \"vyapar data\". This skill contains only verified facts about Vyapar's internals -- zero assumptions, zero hallucination. Use it regardless of the target system (Odoo, Tally, custom ERP, CSV export, or anything else)."
---

# Vyapar Schema Skill

> **Author:** NexaraTech | **Version:** 1.0.0 | **Vyapar:** 5.x Android | **License:** MIT
> **Tools:** Bash, Read, Write, Edit | **Dependencies:** Python 3.x + sqlite3 (stdlib), unzip or Python zipfile
> **Evidence:** Live .vyp SQLite backups + full jadx 1.5.5 DEX decompilation (classes8.dex)

This skill contains only verified facts about Vyapar's internal database.
It has no opinions about what to migrate to. The agent using this skill
decides what to do with the data — this skill ensures they start with
accurate source knowledge.

---

## File Format

- Vyapar backup extension: **`.vyb`** — a standard ZIP archive
- Inside the ZIP: a single **`.vyp`** file — a SQLite 3 database
- Extract: `unzip backup.vyb` → produces `<name>.vyp`
- Open: `sqlite3 <name>.vyp` or DB Browser for SQLite
- There is always exactly one `.vyp` per `.vyb`

---

## Architecture

- Single-company, single-user accounting + inventory app
- One SQLite file = one company's complete data
- No multi-tenancy, no foreign server, no hidden tables
- All financial data lives in `kb_transactions` + `kb_lineitems`
- All party data lives in `kb_names`
- All product data lives in `kb_items`

---

## Reference Files

Load on demand — not all at once:

| File | Load when |
|---|---|
| `references/schema.md` | Need column-level detail for any table |
| `references/enums.md` | Interpreting any INTEGER flag or status field |
| `references/data-rules.md` | Validating or transforming Vyapar data |

---

## Core Tables — Quick Reference

```
kb_firms              — company profile, GSTIN, address
kb_names              — all parties (customers + vendors)
kb_items              — products and services
kb_item_categories    — product categories
kb_item_units         — units of measure
kb_transactions       — every transaction header
kb_lineitems          — line items for each transaction
kb_tax_code           — GST and other tax definitions
kb_paymentTypes       — payment methods (Cash, Cheque, UPI, Bank)
kb_prefix             — invoice prefix registry; maps txn_prefix_id → prefix string per txn_type
txn_payment_mapping   — links payment methods to transactions
kb_txn_links          — links payments to invoices (optional, settings-driven)
kb_linked_transactions— links converted documents (e.g. estimate → invoice)
journal_entry         — manual journal entries
journal_entry_line_items — lines for manual journals
kb_serial_details     — serial/IMEI master registry (one row per tracked unit)
kb_serial_mapping     — links serials to lineitems (sale) or adjustments (stock-in)
kb_item_stock_tracking— stock lot/batch tracking (empty in live data — use kb_serial_details)
other_accounts        — chart of accounts (non-party accounts)
party_to_party_transfer — inter-party transfers (separate from kb_transactions)
```

---

## Transaction Types — Critical Mapping

Always read `references/enums.md` for the full table. Key types:

| txn_type | Label | Has lineitems | Financial |
|---|---|---|---|
| 1 | Sale Invoice | Yes | Yes |
| 2 | Purchase Invoice | Yes | Yes |
| 3 | Payment-In | No | Yes |
| 4 | Payment-Out | No | Yes |
| 5 | Opening Balance — Receivable | No | Yes |
| 6 | Opening Balance — Payable | No | Yes |
| 7 | Expense | No | Yes |
| 21 | Credit Note / Sale Return | Yes | Yes |
| 23 | Debit Note / Purchase Return | Yes | Yes |
| 24 | Sale Order | Yes | No (until converted) |
| 27 | Delivery Challan | Yes | No |
| 28 | Purchase Order | Yes | No |
| 30 | Estimate / Quotation | Yes | No |
| 65 | Proforma Invoice | Yes | No |
| 83 | Job Work Challan | Yes | No |
| 60 | Sale — Fixed Asset | Yes | Yes |
| 61 | Purchase — Fixed Asset | Yes | Yes |
| 50 | Cash-In | No | Yes |
| 51 | Cash-Out | No | Yes |
| 67 | Journal Entry — Paid | No | Yes |
| 68 | Journal Entry — Received | No | Yes |
| 90 | Other Income | No | Yes |

Non-financial types (24, 27, 28, 30, 65, 83) do not affect balances unless
`txn_status=4` (converted). Confirmed by SQL: `WHERE txn_type NOT IN (24,28,30,27,83,70)`.

---

## Amount Fields — Exact Meaning

```
txn_cash_amount       — amount already collected/paid
txn_balance_amount    — amount still outstanding
txn_ac1_amount / txn_ac2_amount / txn_ac3_amount — additional charges (freight, etc.)
txn_tax_amount        — total tax
txn_discount_amount   — transaction-level discount
```

**Invoice total = `txn_cash_amount + txn_balance_amount`**
⚠️ `txn_total_amount` does NOT exist — do not use it.

**Full gross cross-check:**
```
SUM(total_amount)
+ txn_ac1_amount + txn_ac2_amount + txn_ac3_amount
+ txn_tax_amount
- txn_discount_amount
+ txn_round_off_amount
= txn_cash_amount + txn_balance_amount
```

---

## Tax Logic

- `txn_tax_inclusive=1` → price INCLUDES tax
- `txn_tax_inclusive=2` → price EXCLUDES tax (most common)
- GST components stored as separate rows in `kb_lineitems` joined to `kb_tax_code`
- `txn_place_of_supply` determines inter-state (IGST) vs intra-state (CGST+SGST)
- If `txn_place_of_supply` is empty → default to intra-state

---

## Party Rules

- `name_type=1` = Customer, `name_type=2` = Vendor
- A single `name_id` can appear in both types — same entity, dual role
- Unique key for deduplication: `name_id` (internal) or `full_name` + `phone_number`
- GSTIN stored in `name_gstin_number` — may be blank for unregistered parties
- `name_is_active` = 1 (active), 0 (archived) — **ALWAYS filter `WHERE name_is_active = 1`** unless you need archived parties
- `kb_names.amount` = cached outstanding balance snapshot — **unreliable, do not use**; derive balance from `SUM(txn_cash_amount + txn_balance_amount)` on transactions instead

---

## Payment Linking

- `txn_payment_mapping.payment_id` → `kb_paymentTypes.paymentType_id`
  This is the payment **METHOD** (Cash=1, Cheque=2) — NOT a linked payment transaction
- `kb_txn_links` — optionally links payment transactions to invoices
  This link is user-controlled via a settings toggle — NOT guaranteed to exist
- `kb_linked_transactions` — links converted documents (estimate → invoice, order → invoice)

---

## Stock

- `kb_items.item_stock_quantity` = current snapshot quantity
- For historical opening quantity: use `kb_item_stock_tracking.ist_opening_quantity`
- Negative stock is possible — Vyapar allows sales without stock enforcement

---

## Data Quality — Known Issues

Read `references/data-rules.md` for the full SQL validation suite. Key issues:

- Lineitems can exist without a matching transaction (orphaned rows)
- Parties can exist without GSTIN or phone (minimal required fields)
- `kb_lineitems.lineitem_serial_number` — column exists but is **always empty** in live data. For serial/IMEI tracking use `kb_serial_details` + `kb_serial_mapping` (see `references/schema.md`)
- Duplicate GSTIN across parties is possible (data entry error)
- `txn_place_of_supply` is frequently blank

---

## Full-Text Search (FTS) Engine

**Source:** Verified by jadx 1.5.5 full decompilation of Vyapar APK classes8.dex.
Exact class mapping:

| Obfuscated | Original |
|---|---|
| `x31.o` | `vyapar.shared.legacy.transaction.dbManagers.TxnDbManager` |
| `ou0.t1` | `vyapar.shared.data.local.masterDb.managers.FtsDbManager` |
| `xu0.b3` | `TransactionModel` |
| `a41.g` | Transaction form/holder (mutable, passed to TxnDbManager) |
| `v31.e1` | `TransactionPaymentMappingModel` |
| `eu0.o` | FTS table DDL |

### Tables

```
kb_fts_vtable          — SQLite FTS3 virtual table (search interface)
kb_fts_vtable_content  — physical backing store (columns: docid, c0fts_name_id, c1fts_txn_id, c2fts_text)
kb_fts_vtable_segdir   — FTS index segments directory
kb_fts_vtable_segments — FTS index segment data
```

**DDL:**
```sql
CREATE VIRTUAL TABLE kb_fts_vtable USING fts3 (fts_name_id, fts_txn_id, fts_text)
```

**Important:** When querying the virtual table use logical column names (`fts_txn_id`).
When querying the physical backing table use storage column names (`c0fts_name_id`, `c1fts_txn_id`, `c2fts_text`).

### fts_text Blob Format — Exact Field Order

Verified from `TxnDbManager.updateFTSTxnRecord()` (`x31.o.e()`, line 438–481):

```
{partyName} {displayName} {description} {cashAmount} {balanceAmount} {totalAmount} {prefix}{refNo} {refNo} {payRef1} {payRef2}... {ewayBillNumber}
```

| Position | Content | Source | Separator |
|---|---|---|---|
| 1 | Party full name | Looked up from `kb_names` via `txn_name_id` | space after |
| 2 | Display name | `txn_display_name` | space after |
| 3 | Description | `txn_description` | space after |
| 4 | Cash amount | `txn_cash_amount` | space after |
| 5 | Balance amount | `txn_balance_amount` | space after |
| 6 | Total amount | `txn_cash_amount + txn_balance_amount` (computed) | space after |
| 7 | Full invoice number | `txn_invoice_prefix` + `txn_ref_number_char` concatenated | **NO space** between prefix and number |
| 8 | Bare ref number | `txn_ref_number_char` (repeated alone) | space after |
| 9..N | Payment references | Each `payment_reference` from `txn_payment_mapping` where not null/empty | space-separated |
| N+1 | G field | `a41.g.G` — never assigned in classes8.dex, always empty string in practice | space before |
| last | e-Way bill number | `txn_eway_bill_number` | space before |

**Why invoice number appears twice (positions 7 and 8):**
Intentional — allows FTS MATCH to work whether the user searches `2526FT1026` (full) or `1026` (bare number only).

**Example blob:**
```
Acme Corp Acme Corp  1500.0 500.0 2000.0 2526FT1026 1026 UTR123456  EWB001234
```

### Upsert Logic

```python
# Vyapar upserts FTS records — UPDATE if docid exists, INSERT if not
cursor = db.rawQuery("SELECT docid FROM kb_fts_vtable WHERE fts_txn_id=?", [txn_id])
if cursor has row:
    db.update("kb_fts_vtable", {fts_name_id, fts_txn_id, fts_text}, "docid=?", [docid])
else:
    db.insert("kb_fts_vtable", {fts_name_id, fts_txn_id, fts_text})
```

### a41.g Field Mapping (obfuscated → DB column)

From `v31/h.java:o()` — the transaction holder class used by TxnDbManager:

| Field | DB column |
|---|---|
| `a41.g.c` | `txn_id` |
| `a41.g.d` | `txn_name_id` |
| `a41.g.e` | `txn_date` |
| `a41.g.f` | `txn_time` |
| `a41.g.g` | `txn_cash_amount` |
| `a41.g.h` | `txn_balance_amount` |
| `a41.g.i` | `txn_type` |
| `a41.g.j` | `txn_due_date` |
| `a41.g.k` | `txn_description` |
| `a41.g.p` | `txn_ref_number_char` |
| `a41.g.q` | payment mappings list (`List<v31.e1>`) |
| `a41.g.v` | `txn_firm_id` |
| `a41.g.y` | `txn_invoice_prefix` |
| `a41.g.D` | `txn_display_name` |
| `a41.g.G` | unassigned in classes8.dex — always null/empty |
| `a41.g.V` | `txn_eway_bill_number` |

### Search Behaviour

| Query type | Works? | Notes |
|---|---|---|
| Full IMEI / serial | ✅ | Exact token match |
| Customer name prefix (`Udaya*`) | ✅ | FTS3 prefix wildcard |
| Phone number | ✅ | Stored in blob via party name lookup |
| Full invoice number (`2526FT1026`) | ✅ | Position 7 |
| Bare invoice number (`1026`) | ✅ | Position 8 (repeated) |
| Amount | ✅ | Stored as float string |
| Agent code | ✅ | Present in `txn_description` |
| Case insensitive | ✅ | FTS3 default tokenizer lowercases |
| Mid-string fragment (`712434`) | ❌ | FTS3 only matches from token start |
| Last N digits of IMEI | ❌ | No result — search from first digit |

**Critical:** `kb_names` has no FTS index of its own. Party search only works via the transaction blob — a party with zero transactions cannot be found via FTS.

### Direct DB Edit Warning

**If you edit the DB directly via Python/SQLite (bypassing the Vyapar app), the FTS index is NOT automatically updated.** The FTS trigger only fires through Vyapar's save routine. Direct edits to these tables require a manual FTS repair:
- `kb_transactions` — any field in positions 1–8 above
- `kb_lineitems` / `kb_items` — item name, HSN code, and item code ARE in the blob (appended after the transaction-level fields via a separate item-level FTS update path through `FtsDbManager.updateFTSTxnRecord` + `TransactionModel.ftsSearchTags`)
- `kb_serial_details` / `kb_serial_mapping` — serial numbers ARE in the blob, written by the same item-level FTS update path — direct edits bypass this and leave the blob stale
- `kb_names` — party name changes break position 1

### FTS Repair Utility (Python)

Use this after any direct Python edits to keep Vyapar search working:

```python
import sqlite3

def repair_fts(db_path: str, txn_ids: list[int]):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    for txn_id in txn_ids:
        # Fetch transaction fields
        cur.execute("""
            SELECT t.txn_name_id, t.txn_display_name, t.txn_description,
                   t.txn_cash_amount, t.txn_balance_amount,
                   t.txn_invoice_prefix, t.txn_ref_number_char,
                   t.txn_eway_bill_number,
                   n.full_name
            FROM kb_transactions t
            LEFT JOIN kb_names n ON n.name_id = t.txn_name_id
            WHERE t.txn_id = ?
        """, [txn_id])
        row = cur.fetchone()
        if not row:
            continue

        (name_id, display_name, description, cash, balance,
         prefix, ref, eway, party_name) = row

        # Fetch payment references
        cur.execute("""
            SELECT tpm.payment_reference
            FROM txn_payment_mapping tpm
            WHERE tpm.txn_id = ? AND tpm.payment_reference IS NOT NULL
              AND tpm.payment_reference != ''
        """, [txn_id])
        pay_refs = " ".join(r[0] for r in cur.fetchall())

        # Build transaction-level blob — field order from APK x31.o.e
        total = (cash or 0) + (balance or 0)
        full_inv = (prefix or "") + (ref or "")
        parts = [
            party_name or "",
            display_name or "",
            description or "",
            str(cash or 0),
            str(balance or 0),
            str(total),
            full_inv,
            ref or "",
            pay_refs,
            "",           # unused field (txn.G)
            eway or "",
        ]
        fts_text = " ".join(parts)

        # Append item-level data (item_name, hsn, item_code, cess, serial)
        # Observed format: each lineitem's data appended space-separated after txn fields
        cur.execute("""
            SELECT ki.item_name, ki.item_hsn_sac_code, ki.item_code,
                   ki.item_additional_cess_per_unit, li.lineitem_id
            FROM kb_lineitems li
            JOIN kb_items ki ON ki.item_id = li.item_id
            WHERE li.lineitem_txn_id = ?
        """, [txn_id])
        for item_name, hsn, item_code, cess, li_id in cur.fetchall():
            # Look up serial number for this lineitem
            cur.execute("""
                SELECT sd.serial_number FROM kb_serial_details sd
                JOIN kb_serial_mapping sm ON sm.serial_mapping_serial_id = sd.serial_id
                WHERE sm.serial_mapping_lineitem_id = ?
            """, [li_id])
            serial_row = cur.fetchone()
            serial = serial_row[0] if serial_row else ""
            item_parts = [
                item_name or "",
                hsn or "",
                item_code or "",
                str(cess or 0.0),
                serial,
            ]
            fts_text += " " + " ".join(item_parts)

        # Upsert into FTS
        cur.execute("SELECT docid FROM kb_fts_vtable WHERE fts_txn_id=?", [txn_id])
        existing = cur.fetchone()
        if existing:
            cur.execute(
                "UPDATE kb_fts_vtable SET fts_name_id=?, fts_txn_id=?, fts_text=? WHERE docid=?",
                [name_id, txn_id, fts_text, existing[0]]
            )
        else:
            cur.execute(
                "INSERT INTO kb_fts_vtable (fts_name_id, fts_txn_id, fts_text) VALUES (?,?,?)",
                [name_id, txn_id, fts_text]
            )

    conn.commit()
    conn.close()
    print(f"FTS repaired for {len(txn_ids)} transactions.")

# Usage:
# repair_fts("finetune.vyp", [71, 1594])          # fix specific txns
# repair_fts("finetune.vyp", list(range(1, 1733))) # full rebuild
```

---

## Transaction Write — Complete Table Impact (Live-Verified)

> **Source:** Diff of live `.vyp` before/after a single Sale Invoice created in Vyapar 5.x Android.
> Every table touched by Vyapar when saving a `txn_type=1` Sale Invoice.

### Tables written on every Sale Invoice save

| Table | Operation | Notes |
|---|---|---|
| `kb_transactions` | INSERT | One row — the invoice header |
| `kb_lineitems` | INSERT | One row per line item |
| `kb_serial_details` | INSERT (if new IMEI) | One row per IMEI not already in table |
| `kb_serial_mapping` | INSERT | One row per serial — links serial_id → lineitem_id |
| `txn_payment_mapping` | INSERT | **Required** — one row per transaction even if amount=0 |
| `kb_items` | UPDATE | `item_stock_quantity -= qty`, `item_date_modified = now` |
| `kb_names` | UPDATE | `amount += invoice_total`, `name_last_txn_date = txn_date`, `date_modified = now` |
| `kb_fts_vtable_content` | INSERT/UPDATE | FTS blob — see FTS section |
| `audit_trails` | INSERT | ~3 rows per transaction — do not write manually |

---

### `txn_payment_mapping` — Required INSERT

Every transaction needs at least one row here regardless of payment status.

```sql
INSERT INTO txn_payment_mapping
  (payment_id, txn_id, amount, payment_reference)
VALUES
  (1, <txn_id>, 0.0, '');
-- payment_id: 1=Cash, 2=Cheque (from kb_paymentTypes)
-- amount: 0.0 if credit/unpaid, actual amount if collected at time of sale
```

⚠️ Missing this row causes Vyapar to silently malfunction on the transaction.

---

### `txn_time` — Seconds Since Midnight

```python
from datetime import datetime
now = datetime.now()
txn_time = now.hour * 3600 + now.minute * 60 + now.second
# Example: 15:48:12 → 56892
```

---

### `kb_serial_details` — `serial_current_quantity` Behaviour

| Scenario | Value |
|---|---|
| Stock received (adjustment) | `1.0` |
| Sold (lineitem) | `0.0` (if prior stock existed) or `-1.0` (if sold without stock-in) |

In FINETUNE's workflow (phones sold directly without prior stock adjustment), value lands at `-1.0`.

---

### `audit_trails` — Do Not Write

Vyapar auto-populates ~3 rows per transaction. Do not INSERT manually — leave to the app or ignore entirely when migrating via direct DB write.
