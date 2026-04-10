# Vyapar SQLite Schema Reference

Verified from live `.vyp` SQLite backup analysis.
All tables, columns, and types are authoritative — no assumptions.

---

## Table of Contents

1. [kb_firms — Company / Business Profile](#kb_firms--company--business-profile)
2. [kb_prefix — Invoice Prefix Registry](#kb_prefix--invoice-prefix-registry)
3. [kb_names — Parties (Customers & Vendors)](#kb_names--parties-customers--vendors)
4. [kb_items — Products / Services](#kb_items--products--services)
5. [kb_item_categories — Product Categories](#kb_item_categories--product-categories)
6. [kb_item_units — Units of Measure](#kb_item_units--units-of-measure)
7. [kb_item_units_mapping — UoM Conversion Rates](#kb_item_units_mapping--uom-conversion-rates)
8. [kb_tax_code — Tax Definitions](#kb_tax_code--tax-definitions)
9. [kb_transactions — All Transaction Headers](#kb_transactions--all-transaction-headers)
10. [kb_lineitems — Invoice Line Items](#kb_lineitems--invoice-line-items)
11. [kb_paymentTypes — Payment Methods](#kb_paymenttypes--payment-methods)
12. [kb_payment_terms — Payment Terms](#kb_payment_terms--payment-terms)
13. [txn_payment_mapping — Payment Method Per Transaction](#txn_payment_mapping--payment-method-per-transaction)
14. [kb_txn_links — Optional Payment-to-Invoice Links](#kb_txn_links--optional-payment-to-invoice-links)
15. [kb_linked_transactions — Document Conversion Trail](#kb_linked_transactions--document-conversion-trail)
16. [journal_entry — Manual Journal Entry Headers](#journal_entry--manual-journal-entry-headers)
17. [journal_entry_line_items — Manual Journal Lines](#journal_entry_line_items--manual-journal-lines)
18. [other_accounts — Vyapar Internal Chart of Accounts](#other_accounts--vyapar-internal-chart-of-accounts)
19. [kb_serial_details — Serial Number Registry](#kb_serial_details--serial-number-registry)
20. [kb_serial_mapping — Serial ↔ Transaction Link](#kb_serial_mapping--serial--transaction-link)
21. [kb_item_stock_tracking — Stock Lots / Batches](#kb_item_stock_tracking--stock-lots--batches)
22. [party_to_party_transfer — Inter-Party Transfers](#party_to_party_transfer--inter-party-transfers)
23. [kb_settings — App Settings](#kb_settings--app-settings)

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
| firm_invoice_prefix | varchar(10) | Invoice number sequence prefix (legacy — see kb_prefix) |
| firm_invoice_number | INTEGER | Last used invoice sequence number |
| firm_tax_invoice_prefix | varchar(10) | Tax invoice prefix |
| firm_tax_invoice_number | INTEGER | Last used tax invoice number |
| firm_estimate_prefix | varchar(10) | Estimate/quotation prefix |
| firm_estimate_number | INTEGER | Last used estimate number |
| firm_cash_in_prefix | varchar(10) | Payment-In voucher prefix |
| firm_delivery_challan_prefix | varchar(10) | Delivery challan prefix |
| firm_tin_number | varchar(20) | Legacy TIN |
| firm_description | varchar(256) | Business description |
| firm_logo | blob | Logo image |
| firm_signature | blob | Signature image |
| firm_visiting_card | blob | Visiting card image |
| firm_dispatch_address | varchar(256) | Dispatch address |
| firm_dispatch_pincode | varchar(10) | Dispatch pincode |
| firm_phone_secondary | varchar(20) | Secondary phone |
| firm_upi_bank_account_number | varchar(32) | UPI account number |
| firm_upi_bank_ifsc_code | varchar(32) | UPI IFSC code |
| firm_invoice_printing_bank_id | INTEGER | Bank shown on invoice |
| firm_collect_payment_bank_id | INTEGER | Bank for payment collection |
| firm_pg_linked_account_id | varchar(64) | Payment gateway account |
| firm_business_type | INTEGER | See enums.md — 1=Retail, 2=Wholesale, etc. |
| firm_business_category | varchar(50) | Free text industry category |

---

## kb_prefix — Invoice Prefix Registry

Controls which prefix string is used for each transaction type. Supersedes the legacy `firm_invoice_prefix` column in `kb_firms`. When creating or filtering invoices, join via `txn_prefix_id` to get the active prefix.

| Column | Type | Notes |
|---|---|---|
| prefix_id | INTEGER PK | |
| prefix_firm_id | INTEGER | FK → kb_firms |
| prefix_txn_type | INTEGER | Transaction type this prefix applies to (1=Sale Invoice, etc.) |
| prefix_value | varchar(50) | The prefix string (e.g. `2526FT`, `25-26/`, `TEMP`) |
| prefix_is_default | INTEGER | 1 = active/default prefix for this txn_type |

**Invoice number = `txn_invoice_prefix` + `txn_ref_number_char`**
Both stored on `kb_transactions`. `txn_prefix_id` FK → `kb_prefix.prefix_id`.
Example: prefix `2526FT` + number `1026` = Invoice `2526FT1026`.

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
| ~~txn_total_amount~~ | — | **DOES NOT EXIST** — column absent from live DB. Use `txn_cash_amount + txn_balance_amount` for net invoice total. |
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
| txn_ac1_amount / txn_ac2_amount / txn_ac3_amount | double | Additional charge amounts (**NOTE: skill previously had wrong names `ac1_amount` etc. — correct names have `txn_` prefix**) |
| ac1_name / ac2_name / ac3_name | varchar | Additional charge labels (e.g. "Freight") |
| ac1_sac_code / ac2_sac_code / ac3_sac_code | varchar | SAC codes for additional charges |
| ac1_tax_id / ac2_tax_id / ac3_tax_id | INTEGER | FK → kb_tax_code for each charge |
| ac1_tax_amount / ac2_tax_amount / ac3_tax_amount | double | Tax on each charge |
| ac1_itc_applicable / ac2_itc_applicable / ac3_itc_applicable | INTEGER | ITC flag per charge |
| loyalty_amount | double | Loyalty points redeemed as discount |
| txn_prefix_id | INTEGER | FK → kb_prefix.prefix_id — determines invoice prefix |
| txn_category_id | INTEGER | FK → kb_item_categories (transaction-level category) |
| txn_current_balance | double | Running balance snapshot |
| txn_date_created | datetime | Record creation timestamp |
| txn_date_modified | datetime | Record last modified timestamp |
| txn_discount_percent | double | Transaction-level discount percentage |
| txn_tax_percent | double | Transaction-level tax percentage |
| txn_display_name | varchar(256) | Display name override |
| mobile_no | varchar(20) | Customer mobile at time of transaction |
| store_id | INTEGER | FK → stores (multi-store setups) |
| icf_names | TEXT | Custom field names (JSON) |
| latitude / longitude | double | GPS coordinates at time of sale |
| created_by / updated_by | INTEGER | FK → urp_users |

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
| lineitem_is_serialized | INTEGER | 1 = this line is serial-tracked (use kb_serial_mapping) |
| lineitem_ist_id | INTEGER | FK → kb_item_stock_tracking |
| lineitem_size | varchar(100) | Size variant |
| lineitem_count | INTEGER | Internal count field |
| lineitem_manufacturing_date | datetime | Manufacturing date for batch items |
| lineitem_total_amount_edited | INTEGER | 1 = total was manually overridden |
| lineitem_ref_id | INTEGER | Reference to source lineitem (for returns/conversions) |
| lineitem_txn_po_ref_number | varchar(50) | PO reference carried from source document |
| lineitem_discount_type | INTEGER | 1=percentage, 2=flat amount |
| lineitem_fa_cost_price | double | Fixed asset cost price |
| icf_values | TEXT | Custom field values (JSON) |

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
| edc_payment_status | varchar | EDC terminal payment status |
| edc_payment_txnId | varchar | EDC terminal transaction ID |
| edc_payment_mode | varchar | EDC payment mode (card type, etc.) |
| edc_payment_initiationId | varchar | EDC initiation identifier |
| edc_card_last_digits | varchar | Last 4 digits of card used at EDC terminal |

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

## kb_serial_details — Serial Number Registry

**The authoritative serial/IMEI master table.** Every tracked unit (phone, appliance, TV) gets one row here when stock is received. `serial_current_quantity` = 1 means in stock, 0 means sold, -1 means over-sold.

> ⚠️ `kb_lineitems.lineitem_serial_number` is present in the schema but is **always empty** in live data. Do NOT use it for serial tracking. The correct path is `kb_serial_details` → `kb_serial_mapping` → `kb_lineitems`.

| Column | Type | Notes |
|---|---|---|
| serial_id | INTEGER PK | |
| serial_item_id | INTEGER | FK → kb_items |
| serial_number | varchar(256) | The IMEI / serial number string |
| serial_current_quantity | double | 1=in stock, 0=sold, -1=over-sold |

---

## kb_serial_mapping — Serial ↔ Transaction Link

Links each serial number to the lineitem (and therefore invoice) where it was sold or adjusted. A serial appears here twice when it is first received (via `serial_mapping_adj_id`) and again when sold (via `serial_mapping_lineitem_id`).

| Column | Type | Notes |
|---|---|---|
| serial_mapping_id | INTEGER PK | |
| serial_mapping_serial_id | INTEGER | FK → kb_serial_details.serial_id |
| serial_mapping_lineitem_id | INTEGER | FK → kb_lineitems.lineitem_id — NULL if this is a stock adjustment row |
| serial_mapping_adj_id | INTEGER | FK → kb_item_adjustments — NULL if this is a sale row |

**Join pattern to get serial → sale invoice:**
```sql
SELECT sd.serial_number, t.txn_ref_number_char, t.txn_date,
       ki.item_name, t.txn_cash_amount + t.txn_balance_amount AS invoice_total,
       n.full_name AS party_name
FROM kb_serial_details sd
JOIN kb_serial_mapping sm ON sm.serial_mapping_serial_id = sd.serial_id
JOIN kb_lineitems li      ON li.lineitem_id = sm.serial_mapping_lineitem_id
JOIN kb_transactions t    ON t.txn_id = li.lineitem_txn_id
JOIN kb_items ki          ON ki.item_id = li.item_id
LEFT JOIN kb_names n      ON n.name_id = t.txn_name_id
WHERE t.txn_type = 1
  AND t.txn_status != 3
  AND sm.serial_mapping_lineitem_id IS NOT NULL;
```

---

## kb_item_stock_tracking — Stock Lots / Batches

Tracks batch/serial/lot-level stock for items with `item_type=1` (physical).
**Note: In live FINETUNE backups this table is empty — serial tracking runs through `kb_serial_details` instead.**

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

| Column | Type | Notes |
|---|---|---|
| p_txn_id | INTEGER PK | Transfer ID |
| p_amount | double | Transfer amount |
| p_received_txn_id | INTEGER | FK → kb_transactions (receiving side) |
| p_paid_txn_id | INTEGER | FK → kb_transactions (paying side) |
| p_txn_date | date | Transfer date |
| p_txn_description | varchar(1024) | Narration / notes |
| p_txn_date_created | datetime | Record creation timestamp (default: CURRENT_TIMESTAMP) |
| p_txn_date_modified | datetime | Record last modified (default: CURRENT_TIMESTAMP) |
| p_txn_image_id | INTEGER | Attached image reference (default: null) |
| p_txn_firm_id | INTEGER | FK → kb_firms (default: null) |

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
