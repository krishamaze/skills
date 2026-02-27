# Vyapar SQLite Schema Reference

Verified from live `.vyp` SQLite backup analysis.
All tables, columns, and types are authoritative — no assumptions.

---

## kb_firms — Company / Business Profile

One row per Vyapar business (single-company app).

| Column | Type | Notes |
|---|---|---|
| firm_id | INTEGER PK | |
| firm_name | varchar(256) | Business display name |
| firm_gstin_number | varchar(32) | GSTIN — may be blank for unregistered |
| firm_state | varchar(32) | State name (string, not code) |
| firm_email | varchar(256) | |
| firm_phone | varchar(20) | |
| firm_address | varchar(256) | |
| firm_pincode | varchar(10) | |
| firm_bank_name | varchar(32) | Primary bank name |
| firm_bank_account_number | varchar(32) | |
| firm_bank_ifsc_code | varchar(32) | |
| firm_invoice_prefix | varchar(10) | Invoice number sequence prefix |
| firm_invoice_number | INTEGER | Last used invoice number |
| firm_tax_invoice_prefix | varchar(10) | Tax invoice prefix |
| firm_business_type | INTEGER | See enums.md — 1=Retail, 2=Wholesale, etc. |
| firm_business_category | varchar(50) | Free text industry category |

---

## kb_names — Parties (Customers & Vendors)

All customers, vendors, and any named party. A single `name_id` can be both
customer and vendor simultaneously — check `name_type`.

| Column | Type | Notes |
|---|---|---|
| name_id | INTEGER PK | Unique party identifier |
| full_name | varchar(50) | Display name |
| phone_number | varchar(11) | May be blank |
| email | varchar(50) | May be blank |
| address | varchar(2000) | Billing address |
| name_shipping_address | varchar(2000) | Shipping address |
| pincode | varchar(10) | |
| name_shipping_pincode | varchar(10) | |
| name_type | INTEGER | 1=Customer, 2=Vendor — see enums.md |
| name_gstin_number | varchar(32) | GSTIN — blank for unregistered parties |
| name_state | varchar(32) | State name string |
| name_tin_number | varchar(20) | Legacy TIN — store as reference |
| name_group_id | INTEGER | FK → kb_party_groups |
| credit_limit | INTEGER | Credit limit in INR |
| credit_limit_enabled | INTEGER | 0/1 boolean |
| name_is_active | INTEGER | 1=active, 0=archived — always filter on this |
| party_billing_name | varchar(50) | Override billing name (used on invoices) |
| name_sub_type | INTEGER | 0=default — see enums.md |
| name_last_txn_date | datetime | Last transaction date (informational) |
| amount | double | Cached outstanding balance — derive from transactions instead |

---

## kb_items — Products / Services

All stock items and services the business sells or purchases.

| Column | Type | Notes |
|---|---|---|
| item_id | INTEGER PK | |
| item_name | varchar(256) | Product/service name |
| item_sale_unit_price | double | Default selling price |
| item_purchase_unit_price | double | Default purchase price |
| item_stock_quantity | double | **Current snapshot quantity** — not opening stock |
| item_min_stock_quantity | double | Reorder threshold |
| item_type | INTEGER | 1=Product, 2=Service, 3=Non-inventory — see enums.md |
| item_code | varchar(32) | Internal reference / SKU |
| category_id | INTEGER | FK → kb_item_categories |
| base_unit_id | INTEGER | FK → kb_item_units (primary UoM) |
| secondary_unit_id | INTEGER | FK → kb_item_units (alternate UoM) |
| unit_mapping_id | INTEGER | FK → kb_item_units_mapping (conversion rate) |
| item_hsn_sac_code | varchar(32) | HSN (goods) or SAC (services) code — may be blank |
| item_tax_id | INTEGER | FK → kb_tax_code — default sales tax |
| item_tax_type | INTEGER | 1=tax-inclusive, 2=tax-exclusive — see enums.md |
| item_tax_type_purchase | INTEGER | Same for purchase side |
| item_additional_cess_per_unit | double | Cess per unit (e.g. tobacco, luxury) |
| item_description | varchar(256) | Internal description / notes |
| item_is_active | INTEGER | 1=active, 0=deleted — always filter on this |
| item_mrp | double | Maximum Retail Price |
| item_wholesale_price | double | Wholesale price |
| item_discount | double | Default discount value |
| item_discount_type | INTEGER | 1=percentage, 2=flat amount |

---

## kb_item_categories — Product Categories

| Column | Type | Notes |
|---|---|---|
| item_category_id | INTEGER PK | |
| item_category_name | varchar(1024) | Category name |

---

## kb_item_units — Units of Measure

| Column | Type | Notes |
|---|---|---|
| unit_id | INTEGER PK | |
| unit_name | varchar(50) | Full name (e.g., KILOGRAMS) |
| unit_short_name | varchar(10) | Abbreviation (e.g., Kg) |
| unit_full_name_editable | INTEGER | 0=system unit (read-only name) |
| unit_deletable | INTEGER | 0=cannot delete |

**Standard built-in units**: Bag, Box, Btl, Bdl, Can, Ctn, Dzn, Gm, Kg, Ltr, Ml, Mtr, Nos, Pac, Pcs, Prs, Qtl, Rol, Sqf, Sqm, Tbs

---

## kb_item_units_mapping — UoM Conversion Rates

| Column | Type | Notes |
|---|---|---|
| unit_mapping_id | INTEGER PK | |
| base_unit_id | INTEGER | FK → kb_item_units |
| secondary_unit_id | INTEGER | FK → kb_item_units |
| conversion_rate | double | secondary = base × conversion_rate |

---

## kb_tax_code — Tax Definitions

Stores each GST component (IGST, CGST, SGST) as a separate row.

| Column | Type | Notes |
|---|---|---|
| tax_code_id | INTEGER PK | |
| tax_code_name | varchar(32) | e.g., "CGST@9%", "IGST@18%", "GST@5%" |
| tax_rate | double | Percentage rate |
| tax_code_type | INTEGER | 0=GST, 1=TCS, 2=TDS, 3=Cess — see enums.md |
| tax_rate_type | INTEGER | 1=IGST, 2=CGST, 3=SGST, 4=GST(combined), 6=Cess — see enums.md |

---

## kb_transactions — All Transaction Headers

Central table — every financial and non-financial document.
Use `txn_type` to determine document type before processing.
Always read `references/enums.md` first.

| Column | Type | Notes |
|---|---|---|
| txn_id | INTEGER PK | |
| txn_type | INTEGER | **Document type — see enums.md** |
| txn_sub_type | INTEGER | Sub-classification of type |
| txn_date | date | Transaction date |
| txn_name_id | INTEGER | FK → kb_names (the party) |
| txn_ref_number_char | varchar(50) | Invoice/voucher number |
| txn_invoice_prefix | varchar(10) | Number prefix used |
| txn_cash_amount | double | **Amount already paid/collected** |
| txn_balance_amount | double | **Amount still outstanding** |
| txn_total_amount | double | Gross before discounts and charges |
| txn_tax_amount | double | Total tax across all lines |
| txn_discount_amount | double | Transaction-level discount |
| txn_round_off_amount | double | Rounding applied to final total |
| txn_due_date | date | Payment due date |
| txn_status | INTEGER | 1=Active, 2=Draft, 3=Cancelled, 4=Converted — see enums.md |
| txn_payment_status | INTEGER | 1=Unpaid, 2=Partial, 3=Paid — see enums.md |
| txn_payment_type_id | INTEGER | FK → kb_paymentTypes (primary payment method) |
| txn_payment_reference | varchar(50) | Cheque number / UTR reference |
| txn_tax_id | INTEGER | FK → kb_tax_code (transaction-level tax) |
| txn_tax_inclusive | INTEGER | 1=price includes tax, 2=price excludes tax |
| txn_place_of_supply | varchar(256) | State name — determines GST type (IGST vs CGST+SGST) |
| txn_reverse_charge | INTEGER | 1=reverse charge applicable |
| txn_itc_applicable | INTEGER | 1=ITC claimable on this transaction |
| txn_billing_address | TEXT | Billing address at time of transaction |
| txn_shipping_address | TEXT | Shipping address |
| txn_eway_bill_number | varchar(50) | e-Way Bill number |
| txn_irn_number | varchar(256) | e-Invoice IRN (government generated) |
| txn_einvoice_qr | varchar | e-Invoice QR data |
| txn_tcs_tax_id | INTEGER | FK → kb_tax_code (TCS tax) |
| txn_tcs_tax_amount | double | TCS amount |
| txn_tds_tax_id | INTEGER | FK → kb_tax_code (TDS tax) |
| txn_tds_tax_amount | double | TDS amount |
| txn_discount_type | INTEGER | 1=percentage, 2=flat amount |
| txn_payment_term_id | INTEGER | FK → kb_payment_terms |
| txn_description | varchar(1024) | Narration / notes |
| txn_firm_id | INTEGER | FK → kb_firms |
| txn_po_date | date | PO date (on purchase transactions) |
| txn_po_ref_number | varchar(50) | PO reference number |
| ac1_name / ac2_name / ac3_name | varchar | Additional charge labels (e.g. "Freight") |
| ac1_amount / ac2_amount / ac3_amount | double | Additional charge amounts |
| ac1_tax_id / ac2_tax_id / ac3_tax_id | INTEGER | FK → kb_tax_code for each charge |
| ac1_tax_amount / ac2_tax_amount / ac3_tax_amount | double | Tax on each charge |
| loyalty_amount | double | Loyalty points redeemed as discount |

**Amount identity**: `txn_cash_amount + txn_balance_amount` = net invoice value

---

## kb_lineitems — Invoice Line Items

One row per product line per transaction. Only financial transaction types
have lineitems. Non-financial types (orders, challans, estimates) also have
lineitems — but those do not affect account balances.

| Column | Type | Notes |
|---|---|---|
| lineitem_id | INTEGER PK | |
| lineitem_txn_id | INTEGER | FK → kb_transactions |
| item_id | INTEGER | FK → kb_items |
| quantity | double | Quantity sold/purchased |
| priceperunit | double | Unit price (check txn_tax_inclusive for inclusive/exclusive) |
| total_amount | double | qty × priceperunit (before tax, before discount) |
| lineitem_tax_amount | double | Tax on this line |
| lineitem_discount_amount | double | Line-level discount amount |
| lineitem_discount_percent | double | Line-level discount percentage |
| lineitem_unit_id | INTEGER | FK → kb_item_units |
| lineitem_unit_mapping_id | INTEGER | FK → kb_item_units_mapping |
| lineitem_tax_id | INTEGER | FK → kb_tax_code |
| lineitem_mrp | double | MRP at time of sale |
| lineitem_batch_number | varchar(30) | Batch tracking |
| lineitem_expiry_date | datetime | Batch expiry |
| lineitem_serial_number | varchar(30) | Serial number tracking |
| lineitem_free_quantity | double | Free items on scheme (not charged) |
| lineitem_description | varchar(1024) | Line-level note |
| lineitem_additional_cess | double | Additional cess on this line |
| lineitem_itc_applicable | INTEGER | ITC claimable on this line |

---

## kb_paymentTypes — Payment Methods

Each row is a payment method/account (Cash, Cheque, Bank, UPI).
`paymentType_id` is the key referenced by `txn_payment_mapping.payment_id`.

| Column | Type | Notes |
|---|---|---|
| paymentType_id | INTEGER PK | Cash=1, Cheque=2 in standard setup |
| paymentType_type | varchar(30) | 'CASH', 'CHEQUE', 'BANK', 'UPI' |
| paymentType_name | varchar(30) | Display name |
| paymentType_bankName | varchar(30) | Bank name (for bank/cheque accounts) |
| paymentType_accountNumber | varchar(30) | Account number |
| paymentType_opening_balance | double | Opening balance for this account |
| pt_bank_ifsc_code | varchar(30) | |
| pt_bank_upi_id | varchar(30) | |

---

## kb_payment_terms — Payment Terms

| Column | Type | Notes |
|---|---|---|
| payment_term_id | INTEGER PK | |
| term_name | varchar(50) | e.g., "Net 30", "Due On Receipt" |
| term_days | INTEGER | Days until payment due (0=immediate) |
| is_default | INTEGER | 1=default term applied to new parties |

**Built-in terms**: Due On Receipt (0d), Net 15, Net 30, Net 45, Net 60

---

## txn_payment_mapping — Payment Method Per Transaction

Records which payment method was used and for how much.
Multiple rows per `txn_id` = split payment across methods.

**CRITICAL**: `payment_id` here points to `kb_paymentTypes.paymentType_id`
(the payment METHOD — Cash, Cheque, UPI). It is NOT a link to another transaction.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| payment_id | INTEGER | FK → **kb_paymentTypes.paymentType_id** — NOT a payment txn |
| cheque_id | INTEGER | FK → kb_cheque_status (if payment method is cheque) |
| txn_id | INTEGER | FK → kb_transactions |
| amount | double | Amount via this payment method |
| payment_reference | varchar | Cheque number / UTR |

---

## kb_txn_links — Optional Payment-to-Invoice Links

Created only when user manually taps the "Link" button in Vyapar UI.
Feature is controlled by a settings toggle — many businesses don't use it.
Absence of a row does NOT mean the payment is unrelated to an invoice.

| Column | Type | Notes |
|---|---|---|
| txn_links_id | INTEGER PK | |
| txn_links_txn_1_id | INTEGER | FK → kb_transactions (payment / credit note) |
| txn_links_txn_2_id | INTEGER | FK → kb_transactions (invoice being settled) |
| txn_links_amount | double | Amount applied from txn_1 to settle txn_2 |
| txn_links_txn_1_type | INTEGER | txn_type of txn_1 |
| txn_links_txn_2_type | INTEGER | txn_type of txn_2 |

**Observed pairings** (from live FINETUNE backup):
- txn_1_type=4 (Payment-Out) → txn_2_type=21 (Credit Note)
- txn_1_type=1 (Sale Invoice) → txn_2_type=21 (Credit Note offset)

---

## kb_linked_transactions — Document Conversion Trail

Tracks when a non-financial document is converted to a financial one.
Example: Estimate (txn_type=30, txn_status=4) → Sale Invoice (txn_type=1).

| Column | Type | Notes |
|---|---|---|
| linked_id | INTEGER PK | |
| txn_source_id | INTEGER | FK → kb_transactions (the original document) |
| txn_destination_id | INTEGER | FK → kb_transactions (the resulting invoice) |
| txns_linked_date | date | Conversion date |

If `txn_source_id` appears here — that estimate/order was converted.
The destination invoice is the authoritative financial record.

---

## journal_entry — Manual Journal Entry Headers

Manual double-entry records entered directly by the user.

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| journal_firm_id | INTEGER | FK → kb_firms |
| reference_number | varchar(256) | |
| date | DATETIME | |
| description | TEXT | Narration |

---

## journal_entry_line_items — Manual Journal Lines

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| journal_entry_id | INTEGER | FK → journal_entry |
| account_id | INTEGER | FK → other_accounts (Vyapar internal CoA) |
| amount | DOUBLE | |
| amount_type | INTEGER | 1=Debit, 2=Credit |

---

## other_accounts — Vyapar Internal Chart of Accounts

Used in manual journals. Not a standard CoA — Vyapar has fixed internal account IDs.

Key identifiers (approximate, validate in live data):
```
29 = Sales Revenue
34 = Purchase Account
19 = Output GST
20 = Output CGST
21 = Output SGST
22 = Output IGST
1  = Input GST
2  = Input CGST
3  = Input SGST
4  = Input IGST
```

Query all: `SELECT * FROM other_accounts;`

---

## kb_item_stock_tracking — Stock Lots / Batches

Tracks batch/serial/lot-level stock for items with `item_type=1` (physical).

| Column | Type | Notes |
|---|---|---|
| ist_id | INTEGER PK | |
| ist_item_id | INTEGER | FK → kb_items |
| ist_batch_number | varchar(30) | Batch / lot identifier |
| ist_serial_number | varchar(30) | Serial number (for serialized items) |
| ist_mrp | double | MRP for this batch |
| ist_expiry_date | datetime | Expiry date |
| ist_manufacturing_date | datetime | Manufacturing date |
| ist_current_quantity | double | Current quantity in this lot |
| ist_opening_quantity | double | **Opening stock for this lot** — use this for historical migration |

---

## party_to_party_transfer — Inter-Party Transfers

Separate table from `kb_transactions`. Party-to-party transfers are NOT stored
as `txn_type` rows — they have their own table.

Query to find all transfers:
```sql
SELECT * FROM party_to_party_transfer;
```

---

## kb_settings — App Settings

Key-value store for all Vyapar app configuration.

```sql
SELECT setting_key, setting_value FROM kb_settings;
```

Relevant keys:
- Fiscal year start
- Default tax mode
- Feature toggles (delivery challan enabled, estimate enabled, etc.)
- Invoice number sequences
