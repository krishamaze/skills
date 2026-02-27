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

-- 7. Transactions where cash + balance doesn't match total
SELECT txn_id, txn_cash_amount, txn_balance_amount, txn_total_amount
FROM kb_transactions
WHERE ABS((txn_cash_amount + txn_balance_amount) - txn_total_amount) > 1
AND txn_type IN (1,2,21,23);

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
txn_total_amount      — gross before additional charges and discounts
txn_tax_amount        — total tax across all lines
txn_discount_amount   — transaction-level discount (not line-level)
txn_round_off_amount  — rounding applied to final total
ac1_amount / ac2_amount / ac3_amount — additional charges (freight, packing, etc.)
```

**Invoice net total = `txn_cash_amount + txn_balance_amount`**

Full gross reconstruction:
```
SUM(lineitem_total_amount)
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
`ac1_amount`, `ac2_amount`, `ac3_amount` — the charge values
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
SELECT * FROM kb_txn_links WHERE link_source_txn_id = <payment_txn_id>;
-- link_destination_txn_id = the invoice being settled
```
This link is controlled by a user toggle in settings. Its absence does NOT mean
the payment is unrelated to an invoice — it means the user didn't link it.

**`kb_linked_transactions` — document conversion trail:**
```sql
SELECT * FROM kb_linked_transactions WHERE source_txn_id = <estimate_txn_id>;
-- destination_txn_id = the invoice created from this estimate/order
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

`txn_date` is stored as a Unix timestamp (milliseconds) in some versions,
and as `YYYY-MM-DD` text in others. Verify the format:

```sql
SELECT txn_date FROM kb_transactions LIMIT 5;
```

If numeric and >1000000000000: divide by 1000 to get Unix seconds.

---

## Known Data Quality Issues (Seen in Real Backups)

1. Orphaned lineitems exist — validate before processing
2. `txn_balance_amount` can be negative on overpayments
3. Duplicate GSTIN across parties (user data entry error, not a Vyapar bug)
4. `txn_place_of_supply` blank on a large share of transactions
5. Additional charge labels (ac1_name etc.) are inconsistent free-text
6. Some parties have no phone, email, or address — only a name
7. Item HSN codes frequently blank for small/informal businesses
