# Vyapar Enum & Integer Flag Decoder

Verified from `.vyp` database analysis, UI screenshots, and **APK decompilation (Vyapar 5.apk)**.
APK source: `strings classes*.dex` — extracted `TXN_TYPE_` constants, SQL message templates, and T-series internal identifiers.

---

## txn_type — Transaction Type

### Verification tiers
- **APK-confirmed**: integer matches SQL message template OR `TXN_TYPE_` constant name — highest confidence
- **Context-inferred**: integer appears in SQL alongside confirmed types with consistent grouping — reliable but verify before migrating
- **Unknown**: seen in SQL, no confirmed name — do not migrate until identified

---

### Core Financial Transactions (APK-confirmed)

| txn_type | UI Label | TXN_TYPE_ constant | Evidence |
|---|---|---|---|
| 1 | Sale Invoice | `TXN_TYPE_SALE` | SQL message: "Thanks for your purchase with us!!" |
| 2 | Purchase Invoice | `TXN_TYPE_PURCHASE` | SQL message: "We have made a purchase with you." |
| 3 | Payment-In | — | SQL message: "Thanks for making a payment to us!!" |
| 4 | Payment-Out | — | SQL message: "We have made a payment to you." |
| 21 | Cr. Note / Sale Return | `TXN_TYPE_SALE_RETURN` | SQL message: "We have made a credit note to you." |
| 23 | Dr. Note / Purchase Return | `TXN_TYPE_PURCHASE_RETURN` | SQL message: "We have created a debit note to you." |

### Order / Non-Financial Documents (APK-confirmed)

| txn_type | UI Label | TXN_TYPE_ constant | Evidence |
|---|---|---|---|
| 24 | Sale Order | `TXN_TYPE_SALE_ORDER` | SQL message: "Thanks for placing order with us." |
| 28 | Purchase Order | `TXN_TYPE_PURCHASE_ORDER` | Grouped with 24 in draft logic (`not in (24,28)`) |
| 27 | Delivery Challan | `TXN_TYPE_DELIVERY_CHALLAN` | Excluded same as 24,28,30,83 in non-financial queries |
| 30 | Estimate / Quotation | `TXN_TYPE_ESTIMATE` | txn_status=4 = converted to invoice |
| 65 | Proforma Invoice | `TXN_TYPE_PROFORMA_INVOICE` | `where txn_type != 65` exclusion in financial reports |
| 83 | Job Work Challan | `TXN_TYPE_JOB_WORK_CHALLAN` | Excluded in same group as 24,27,28,30 |

### Opening Balances (APK-confirmed via TXN_TYPE_ constants)

| txn_type | UI Label | TXN_TYPE_ constant | Evidence |
|---|---|---|---|
| 5 | Opening Balance — Receivable | `TXN_TYPE_ROPENBALANCE` | Grouped with 6; `(5, 6)` pair in balance queries |
| 6 | Opening Balance — Payable | `TXN_TYPE_POPENBALANCE` | T5_PARTY_OPENING_BALANCE_TXN internal name |

### Expense & Other Income (APK-confirmed)

| txn_type | UI Label | TXN_TYPE_ constant | Evidence |
|---|---|---|---|
| 7 | Expense | `TXN_TYPE_EXPENSE` | `set txn_current_balance = 0 where txn_type = 7`; uses txn_category_id |
| 90 | Other Income | `TXN_TYPE_OTHER_INCOME` | Grouped `(90, 67, 68)` in financial queries |

### Fixed Asset Transactions (context-inferred)

| txn_type | UI Label | TXN_TYPE_ constant | Evidence |
|---|---|---|---|
| 60 | Sale — Fixed Asset | `TXN_TYPE_SALE_FA` | Always alongside type 1 in GST queries: `(1, 60, 21)` |
| 61 | Purchase — Fixed Asset | `TXN_TYPE_PURCHASE_FA` | Always alongside type 2: `(2,1,61,60,23,21)` |

### Inventory Adjustments (context-inferred via T-series)

| txn_type | UI Label | Internal | Evidence |
|---|---|---|---|
| 70 | Stock Adjustment | `T8_ITEM_STOCK_ADJUSTMENT_TXN` | `txn_type in (70, 71)` pair |
| 71 | Manufacturing | `T13_MANUFACTURING_TXN` | `(mfg_txn_id is null or txn_type = 71)` |

### Cash & Journal (context-inferred)

| txn_type | UI Label | TXN_TYPE_ constant | Evidence |
|---|---|---|---|
| 50 | Cash-In | `TXN_TYPE_CASHIN` | In comprehensive list `(1,21,60,2,61,23,7,3,50,51,29,4,71)` |
| 51 | Cash-Out | `TXN_TYPE_CASHOUT` | Paired with 50 in same query |
| 67 | Journal Entry — Paid | `TXN_TYPE_JOURNAL_ENTRY_PAID` | Grouped `(90, 67, 68)` |
| 68 | Journal Entry — Received | `TXN_TYPE_JOURNAL_ENTRY_RECEIVED` | Grouped `(90, 67, 68)` |

### Unknown / Unconfirmed

| txn_type | Evidence | Status |
|---|---|---|
| 29 | In comprehensive list `(1,21,60,2,61,23,7,3,50,51,29,4,71)`; `where txn_type=29` | Unknown — do NOT migrate until identified |
| -405 | `where txn_type = -405` | Internal/system flag — skip |

---

## CRITICAL DISTINCTIONS

**Payment-In (3) vs Payment-Out (4):**
- txn_type=3 = money received FROM customer. UI: "Customer Name" + "Received" field.
- txn_type=4 = money paid TO vendor. UI: "Party Name" + "Paid" field + optional "Link" button.
- Both use `txn_payment_mapping` for payment method; both optionally link to invoices via `kb_txn_links`.

**Opening Balance (5) vs (6):**
- txn_type=5 = `TXN_TYPE_ROPENBALANCE` — Receivable (customer owes us).
- txn_type=6 = `TXN_TYPE_POPENBALANCE` — Payable (we owe vendor).
- Neither is a standard payment. Do NOT treat as a cash receipt or payment transaction.

**Sale Order (24) vs Estimate (30):**
- txn_type=24 = Sale Order — financial commitment; has `txn_current_balance`.
- txn_type=30 = Estimate — non-financial draft; txn_status=4 = converted to invoice.
- Non-financial group (no balance tracking): `NOT IN (24, 28, 30, 27, 83, 70)`.

**Fixed Asset Sales/Purchases (60, 61):**
- Separate from standard invoices (1, 2) in GST reporting.
- Migrate same as regular invoices but tag with appropriate asset account.

**txn_payment_mapping.payment_id:**
Points to `kb_paymentTypes.paymentType_id` (Cash=1, Cheque=2) — NOT a linked payment transaction.
Records HOW the transaction was paid (method), not WHICH payment document settles it.

---

## Real data distribution (FINETUNE backup — verified)

| txn_type | Count | Label |
|---|---|---|
| 1 | 1,281 | Sale Invoice |
| 30 | 391 | Estimate / Quotation |
| 2 | 27 | Purchase Invoice |
| 4 | 7 | Payment-Out |
| 21 | 6 | Cr. Note / Sale Return |
| 28 | 3 | Purchase Order |
| 3 | 2 | Payment-In |
| 6 | 2 | Opening Balance |

Types confirmed by APK but absent from FINETUNE: 5, 7, 23, 24, 27, 50, 51, 60, 61, 65, 67, 68, 70, 71, 83, 90

---

## txn_status — Transaction Status

| Value | Meaning | Migration Action |
|---|---|---|
| 1 | Active / Posted | Migrate as posted |
| 2 | Draft | Migrate as draft — seen on Purchase Orders (txn_type=28) |
| 3 | Cancelled | Skip or migrate as cancelled |
| 4 | Converted | **Only on txn_type=30.** Estimate converted to Sale Invoice. Link in `kb_linked_transactions`. Skip estimate — invoice is authoritative. |
| 5 | Seen in exclusion queries | Treat as inactive, skip |

**Verified in FINETUNE**: values 1, 2, 4 only

---

## txn_payment_status — Payment Status

| Value | Meaning | Odoo `payment_state` |
|---|---|---|
| 1 | Unpaid | `not_paid` |
| 2 | Partial | `partial` |
| 3 | Fully Paid | `paid` |

---

## txn_tax_inclusive — Tax Calculation Mode

| Value | Meaning | Odoo `account.tax.price_include` |
|---|---|---|
| 1 | Tax Inclusive | `True` |
| 2 | Tax Exclusive | `False` (default) |

---

## name_type — Party Type

| Value | Meaning | Odoo |
|---|---|---|
| 1 | Customer | Buying party — owes money to the business |
| 2 | Vendor / Supplier | Supplying party — business owes money to them |

A single party can be both. Use `name_id` as unique key.

---

## name_sub_type — Party Sub Type

| Value | Meaning |
|---|---|
| 0 | Default (individual or company) |

---

## item_type — Product Type

| Value | Meaning | Product behaviour |
|---|---|---|
| 1 | Physical Product (storable) | `'product'` |
| 2 | Service | No stock tracking |
| 3 | Non-inventory | Expensed on purchase, no stock |

**Real data**: All 635 items are type=1 in FINETUNE backup.

---

## item_tax_type / item_tax_type_purchase — Tax Mode per Item

| Value | Meaning |
|---|---|
| 1 | Tax Inclusive |
| 2 | Tax Exclusive (default) |

---

## tax_rate_type — GST Component Type

| Value | Meaning | Notes |
|---|---|---|
| 1 | IGST | Inter-state supply |
| 2 | CGST | Intra-state (Central) |
| 3 | SGST | Intra-state (State) |
| 4 | GST Combined | Composite rate |
| 6 | Cess | Additional cess |

**GST Grouping Rule**:
- Inter-state → IGST only
- Intra-state (firm_state == place_of_supply) → CGST + SGST together
- If `txn_place_of_supply` is empty, default to intra-state

---

## tax_code_type — Tax Category

| Value | Meaning |
|---|---|
| 0 | GST (standard) |
| 1 | TCS (Tax Collected at Source) |
| 2 | TDS (Tax Deducted at Source) |
| 3 | Cess |

---

## item_discount_type / lineitem_discount_type — Discount Mode

| Value | Meaning |
|---|---|
| 1 | Percentage (%) |
| 2 | Flat amount |

---

## txn_discount_type — Transaction-level Discount Mode

| Value | Meaning |
|---|---|
| 0 | No discount |
| 1 | Percentage (%) |
| 2 | Flat amount |

---

## amount_type (journal_entry_line_items)

| Value | Meaning | Odoo |
|---|---|---|
| 1 | Debit | `debit` |
| 2 | Credit | `credit` |

---

## paymentType_type — Payment Method

| Value | Meaning | Odoo journal type |
|---|---|---|
| 'CASH' | Cash | `cash` |
| 'CHEQUE' | Cheque | `bank` |
| 'BANK' | Bank transfer | `bank` |
| 'UPI' | UPI | `bank` |

---

## kb_firms.firm_business_type

| Value | Meaning |
|---|---|
| 0 | Not set |
| 1 | Retail |
| 2 | Wholesale |
| 3 | Manufacturing |
| 4 | Service |

---

## other_accounts.account_type — CoA Group

| Value | Meaning | Odoo account type |
|---|---|---|
| 14 | Equity | `equity` |
| 15 | Loan | `liability_non_current` |
| 18 | Revenue | `income` |
| 19 | Other Income | `income_other` |
| 20 | Other Income (gain) | `income_other` |
| 21 | Cost of Goods | `expense_direct_cost` |
| 22 | Direct Expense | `expense` |
| 23 | Indirect Expense | `expense` |
| 102 | Input Tax (Asset) | `asset_current` |
| 105 | Other Asset | `asset_current` |
| 106 | Output Tax (Liability) | `liability_current` |
| 107 | Other Liability | `liability_current` |
