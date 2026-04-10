# Vyapar Data Rules & Validation

Verified from live `.vyp` SQLite backups and APK DEX analysis.
These are facts about Vyapar's data — not instructions for any specific target system.

---

## Pre-Read Validation Queries

Run these against any `.vyp` before doing anything with the data.
Report results before proceeding — do not silently fix.

```sql
-- 1. Orphaned lineitems (lineitems without a parent transaction)
SELECT COUNT(*) FROM kb_lineitems
WHERE lineitem_txn_id NOT IN (SELECT txn_id FROM kb_transactions);

-- 2. Transactions referencing unknown parties
SELECT COUNT(*) FROM kb_transactions
WHERE txn_name_id NOT IN (SELECT name_id FROM kb_names)
AND txn_name_id IS NOT NULL;

-- 3. Lineitems referencing unknown products
SELECT COUNT(*) FROM kb_lineitems
WHERE item_id NOT IN (SELECT item_id FROM kb_items);

-- 4. Products with negative stock (Vyapar allows this)
SELECT item_name, item_stock_quantity FROM kb_items
WHERE item_stock_quantity < 0;

-- 5. Duplicate GSTIN across parties (data entry error)
SELECT name_gstin_number, COUNT(*) FROM kb_names
WHERE name_gstin_number != ''
GROUP BY name_gstin_number HAVING COUNT(*) > 1;

-- 6. Transactions with blank place_of_supply (GST ambiguity)
SELECT COUNT(*) FROM kb_transactions
WHERE txn_type IN (1,2,21,23,60,61)
AND (txn_place_of_supply IS NULL OR txn_place_of_supply = '');

-- 7. Sanity check: cash + balance should be positive on financial txns
SELECT txn_id, txn_cash_amount, txn_balance_amount
FROM kb_transactions
WHERE (txn_cash_amount + txn_balance_amount) <= 0
AND txn_type IN (1,2,21,23,60,61)
AND txn_status != 3;

-- 8. Date range of all transactions (for fiscal year coverage)
SELECT MIN(txn_date), MAX(txn_date) FROM kb_transactions;

-- 9. Active vs inactive products
SELECT item_is_active, COUNT(*) FROM kb_items GROUP BY item_is_active;

-- 10. Active vs inactive parties
SELECT name_is_active, COUNT(*) FROM kb_names GROUP BY name_is_active;
```

---

## Amount Fields — Exact Semantics

```
txn_cash_amount       — amount already collected/paid at time of entry
txn_balance_amount    — amount still outstanding
txn_tax_amount        — total tax across all lines
txn_discount_amount   — transaction-level discount (not line-level)
txn_round_off_amount  — rounding applied to final total
txn_ac1_amount / txn_ac2_amount / txn_ac3_amount — additional charges (freight, packing, etc.)
```

**Invoice net total = `txn_cash_amount + txn_balance_amount`**

Full gross reconstruction:
```
SUM(total_amount)
+ txn_ac1_amount + txn_ac2_amount + txn_ac3_amount
+ txn_tax_amount
- txn_discount_amount
+ txn_round_off_amount
= txn_cash_amount + txn_balance_amount
```

Flag any discrepancy > ₹1 for manual review.

---

## Tax Logic

**Tax inclusive flag:**
- `txn_tax_inclusive=1` → price INCLUDES tax (gross price)
- `txn_tax_inclusive=2` → price EXCLUDES tax (net price) ← default, most common

**GST type determination:**
```python
def gst_type(txn_place_of_supply, firm_state):
    if not txn_place_of_supply or txn_place_of_supply.strip() == firm_state:
        return 'intrastate'  # CGST + SGST (tax_rate_type 2 + 3)
    return 'interstate'     # IGST only (tax_rate_type 1)
```

- `txn_place_of_supply` is blank in a significant portion of transactions
- When blank: default to intrastate
- Never mix IGST with CGST+SGST on the same transaction line

**GST component lookup:**
```sql
SELECT * FROM kb_tax_code
WHERE tax_code_id = <lineitem_tax_id>;
-- tax_rate_type: 1=IGST, 2=CGST, 3=SGST, 4=GST Combined, 6=Cess
```

---

## Additional Charges

`ac1_name`, `ac2_name`, `ac3_name` — free-text labels (e.g., "Freight", "Packing")
`txn_ac1_amount`, `txn_ac2_amount`, `txn_ac3_amount` — the charge values
`ac1_tax_id`, `ac2_tax_id`, `ac3_tax_id` — optional tax on each charge

These are invoice-level, not line-level. Any non-zero charge must be handled
separately from `kb_lineitems` — they are NOT included in lineitem rows.

---

## Non-Financial Transaction Types

These types do NOT affect account balances unless converted (`txn_status=4`):

```
24 — Sale Order
27 — Delivery Challan
28 — Purchase Order
30 — Estimate / Quotation
65 — Proforma Invoice
83 — Job Work Challan
```

Confirmed from APK SQL: `WHERE txn_type NOT IN (24,28,30,27,83,70)` used in
all balance and financial report queries.

When `txn_status=4`: document was converted. The resulting financial document
is tracked in `kb_linked_transactions` (source_id → destination_id).

---

## Cancelled Transactions

`txn_status=3` = Cancelled.

These records still exist in the database with all their fields intact.
`txn_current_balance` is zeroed. They must be explicitly excluded from
any financial calculation or they will double-count.

```sql
-- Exclude cancelled
WHERE txn_status != 3
```

---

## Opening Balances (txn_type=5 and txn_type=6)

Not real cash movements — represent pre-Vyapar outstanding amounts.

- `txn_type=5` (`TXN_TYPE_ROPENBALANCE`) — customer owes us (receivable)
- `txn_type=6` (`TXN_TYPE_POPENBALANCE`) — we owe vendor (payable)
- `txn_payment_status='undefined'` on these rows (confirmed from APK SQL)
- These do NOT have `kb_lineitems` rows
- `txn_name_id` points to the party in `kb_names`

---

## Payment Linking

**`txn_payment_mapping` — payment METHOD, not payment document:**
```sql
SELECT * FROM txn_payment_mapping WHERE txn_id = <id>;
-- payment_id → kb_paymentTypes.paymentType_id (Cash=1, Cheque=2)
-- NOT a link to another transaction
```
Multiple rows for the same `txn_id` = split payment (e.g. part Cash, part UPI).

**`kb_txn_links` — optional invoice ↔ payment link:**
```sql
SELECT * FROM kb_txn_links WHERE txn_links_txn_1_id = <payment_txn_id>;
-- txn_links_txn_2_id = the invoice being settled
-- txn_links_amount = amount applied from txn_1 to settle txn_2
```
This link is controlled by a user toggle in settings. Its absence does NOT mean
the payment is unrelated to an invoice — it means the user didn't link it.

**`kb_linked_transactions` — document conversion trail:**
```sql
SELECT * FROM kb_linked_transactions WHERE txn_source_id = <estimate_txn_id>;
-- txn_destination_id = the invoice created from this estimate/order
```

---

## Party Deduplication

- Primary key: `name_id` (internal integer) — always unique
- A party can have `name_type=1` AND `name_type=2` simultaneously (customer + vendor)
- Deduplication by name alone is unreliable — use `name_id`
- `name_gstin_number` may be blank for unregistered parties — not required

---

## Product / Item Rules

- `item_is_active=0` = soft-deleted — exclude from any live data processing
- `item_stock_quantity` = current snapshot, not opening stock
- Opening stock = `kb_item_stock_tracking.ist_opening_quantity` per item
- Negative `item_stock_quantity` is possible — Vyapar does not enforce stock floors
- `item_hsn_sac_code` may be blank for exempt/informal items

---

## System / Default Records

Filter these out before processing:

```sql
-- Active parties only
WHERE name_is_active = 1

-- Active products only
WHERE item_is_active = 1

-- Exclude internal/system transaction types
WHERE txn_type NOT IN (-405)

-- Exclude voided/system entries
WHERE txn_status != 3
```

---

## Fiscal Year

Vyapar's data may span multiple April–March fiscal years.
Always check the full date range before processing:

```sql
SELECT MIN(txn_date), MAX(txn_date) FROM kb_transactions;
```

**Vyapar 5.x (modern):** `txn_date` is stored as a datetime string (`YYYY-MM-DD HH:MM:SS`).
Older versions may use Unix timestamps (milliseconds). Always verify:

```sql
SELECT txn_date FROM kb_transactions LIMIT 5;
```

If the value looks like `2025-04-01 00:00:00` → datetime string (5.x, most common).
If numeric and >1000000000000 → Unix milliseconds (legacy), divide by 1000 to get seconds.

---

## Serial Tracking Reliability

### `serial_item_id` is NOT a reliable source of truth for "what item was this IMEI sold as"

`kb_serial_details.serial_item_id` is written at the time of sale and is **never updated** by Vyapar when an item is renamed or when serial records are inherited by a reused item slot. It will point to the wrong item in two confirmed real-world scenarios:

**Scenario 1 — Item rename/reuse workflow:**
Vyapar blocks deletion of any item that has rows in `kb_serial_details`, even if those serials have no active transactions. Users work around this by renaming the stale item (e.g., to `dlt`) and later reusing that slot for a new item. When this happens, `serial_item_id` continues to reference the old item name through all renames — it is never corrected by the app.

**Scenario 2 — Data entry error:**
The wrong item was selected in Vyapar UI at time of sale. `serial_item_id` reflects the mistake; `kb_lineitems.item_id` may reflect a manual correction made afterward.

**Correct approach — always use the mapping chain:**
```sql
-- Authoritative: what item was this IMEI actually sold as?
SELECT ki.item_name
FROM kb_serial_details sd
JOIN kb_serial_mapping sm ON sm.serial_mapping_serial_id = sd.serial_id
JOIN kb_lineitems li ON li.lineitem_id = sm.serial_mapping_lineitem_id
JOIN kb_items ki ON ki.item_id = li.item_id
WHERE sd.serial_number = '<IMEI>';
```

**Audit query — find all mismatches in the DB:**
```sql
SELECT sd.serial_number,
       ki_sd.item_name AS serial_details_item,
       ki_li.item_name AS lineitem_item
FROM kb_serial_details sd
JOIN kb_items ki_sd ON ki_sd.item_id = sd.serial_item_id
LEFT JOIN kb_serial_mapping sm ON sm.serial_mapping_serial_id = sd.serial_id
LEFT JOIN kb_lineitems li ON li.lineitem_id = sm.serial_mapping_lineitem_id
LEFT JOIN kb_items ki_li ON ki_li.item_id = li.item_id
WHERE ki_li.item_id IS NOT NULL
  AND sd.serial_item_id != li.item_id;
```

### Vyapar deletion guard — shallow check (app bug)

Vyapar's item deletion guard checks for the existence of any row in `kb_serial_details` where `serial_item_id` matches the item being deleted. It does **not** join through `kb_serial_mapping → kb_lineitems` to verify the sale actually belongs to that item. This means:

- An item with zero actual transactions can still be undeletable if stale `serial_item_id` references exist
- The fix is to update `serial_item_id` on the orphaned rows to point to the correct item (determined via the mapping chain above), after which Vyapar will allow deletion

### Orphaned serials — no mapping at all

Serials in `kb_serial_details` with no corresponding row in `kb_serial_mapping` are either:
- Stock received but not yet sold (legitimate)
- Sales where the mapping row was never written (Vyapar bug)

```sql
-- Find all unmapped serials
SELECT sd.serial_number, ki.item_name
FROM kb_serial_details sd
JOIN kb_items ki ON ki.item_id = sd.serial_item_id
LEFT JOIN kb_serial_mapping sm ON sm.serial_mapping_serial_id = sd.serial_id
WHERE sm.serial_mapping_serial_id IS NULL;
```

Cross-reference against `kb_lineitems` to distinguish the two cases before acting.

---

## Known Data Quality Issues (Seen in Real Backups)

1. Orphaned lineitems exist — validate before processing
2. `txn_balance_amount` can be negative on overpayments
3. Duplicate GSTIN across parties (user data entry error, not a Vyapar bug)
4. `txn_place_of_supply` blank on a large share of transactions
5. Additional charge labels (ac1_name etc.) are inconsistent free-text
6. Some parties have no phone, email, or address — only a name
7. Item HSN codes frequently blank for small/informal businesses
