# Odoo 19.0 — Accounting Models Reference

Source: `odoo/odoo@19.0` — `addons/account/models/`

---

## account.move — Journal Entry / Invoice / Bill

The single model for all accounting documents. `move_type` determines the document kind.

### `move_type` values (source-verified)

| Value | Document | Direction |
|---|---|---|
| `out_invoice` | Customer Invoice | Sale → receivable |
| `in_invoice` | Vendor Bill | Purchase → payable |
| `out_refund` | Customer Credit Note | Reduces receivable |
| `in_refund` | Vendor Credit Note | Reduces payable |
| `out_receipt` | Customer Receipt | Sale (simplified) |
| `in_receipt` | Vendor Receipt | Purchase (simplified) |
| `entry` | Manual Journal Entry | Arbitrary debit/credit |

### `state` values

| Value | Meaning |
|---|---|
| `draft` | Editable, not posted |
| `posted` | Locked, affects balances |
| `cancel` | Cancelled, no financial effect |

### `payment_state` values (from `PAYMENT_STATE_SELECTION`)

| Value | Meaning |
|---|---|
| `not_paid` | No payment applied |
| `in_payment` | Payment registered, not bank-reconciled |
| `paid` | Fully paid |
| `partial` | Partially paid |
| `reversed` | Reversed by a credit note |
| `invoicing_legacy` | Set via SQL for historical records |

### Key fields

```python
move_type          = fields.Selection(...)        # document type
state              = fields.Selection(...)        # draft/posted/cancel
payment_state      = fields.Selection(...)        # payment status (computed)
partner_id         = fields.Many2one('res.partner')
invoice_date       = fields.Date()               # invoice/bill date
invoice_date_due   = fields.Date()               # payment due date
date               = fields.Date()               # accounting date
journal_id         = fields.Many2one('account.journal')
currency_id        = fields.Many2one('res.currency')
line_ids           = fields.One2many('account.move.line', 'move_id')
invoice_line_ids   = fields.One2many(...)        # filtered view of line_ids (invoice lines only)
amount_untaxed     = fields.Monetary(...)        # computed
amount_tax         = fields.Monetary(...)        # computed
amount_total       = fields.Monetary(...)        # computed
amount_residual    = fields.Monetary(...)        # outstanding amount (computed)
payment_reference  = fields.Char()              # payment communication
ref                = fields.Char()              # vendor reference / internal ref
name               = fields.Char()              # sequence number (auto-generated on post)
invoice_payment_term_id = fields.Many2one('account.payment.term')
fiscal_position_id = fields.Many2one('account.fiscal.position')
reversed_entry_id  = fields.Many2one('account.move')  # source move (for refunds)
reversal_move_ids  = fields.One2many(...)       # refunds generated from this move
```

### Creating an invoice

```python
invoice = self.env['account.move'].create({
    'move_type': 'out_invoice',
    'partner_id': partner.id,
    'invoice_date': fields.Date.today(),
    'journal_id': journal.id,
    'invoice_line_ids': [
        Command.create({
            'product_id': product.id,
            'quantity': 1.0,
            'price_unit': 100.0,
            'tax_ids': [Command.set(tax_ids)],
        })
    ],
})

# Post (lock) the invoice
invoice.action_post()

# Reset to draft
invoice.button_draft()

# Cancel
invoice.button_cancel()
```

### Querying invoices

```python
# Posted customer invoices
invoices = self.env['account.move'].search([
    ('move_type', '=', 'out_invoice'),
    ('state', '=', 'posted'),
])

# Unpaid vendor bills
bills = self.env['account.move'].search([
    ('move_type', '=', 'in_invoice'),
    ('payment_state', 'in', ['not_paid', 'partial']),
])
```

---

## account.move.line — Journal Entry Lines

Every `account.move` line. Invoice lines AND tax lines AND payment term lines all live here.

### Key fields

```python
move_id            = fields.Many2one('account.move')
account_id         = fields.Many2one('account.account')
partner_id         = fields.Many2one('res.partner')
product_id         = fields.Many2one('product.product')
quantity           = fields.Float()
price_unit         = fields.Float()
price_subtotal     = fields.Monetary()           # computed (excl. tax)
price_total        = fields.Monetary()           # computed (incl. tax)
tax_ids            = fields.Many2many('account.tax')
tax_line_id        = fields.Many2one('account.tax')   # set on tax lines
balance            = fields.Monetary()           # debit - credit (signed)
debit              = fields.Monetary()
credit             = fields.Monetary()
amount_currency    = fields.Monetary()           # amount in foreign currency
amount_residual    = fields.Monetary()           # unreconciled amount
currency_id        = fields.Many2one('res.currency')
date               = fields.Date()               # related to move.date
name               = fields.Char()              # label / description
exclude_from_invoice_tab = fields.Boolean()     # True for tax/payment term lines
```

---

## account.payment — Payment

Separate model for customer/vendor payments. Generates a journal entry on post.

### Key fields

```python
payment_type       = fields.Selection([
    ('inbound', 'Send Money'),    # money received (customer payment)
    ('outbound', 'Receive Money') # money paid out (vendor payment)
])
partner_type       = fields.Selection([
    ('customer', 'Customer'),
    ('supplier', 'Vendor'),
])
partner_id         = fields.Many2one('res.partner')
amount             = fields.Monetary()
date               = fields.Date()
journal_id         = fields.Many2one('account.journal')
currency_id        = fields.Many2one('res.currency')
payment_method_id  = fields.Many2one('account.payment.method')
state              = fields.Selection([
    ('draft', 'Draft'),
    ('posted', 'Validated'),
    ('cancel', 'Cancelled'),
])
move_id            = fields.Many2one('account.move')     # generated journal entry
reconciled_invoice_ids = fields.Many2many('account.move')  # linked invoices
```

### Creating a payment

```python
payment = self.env['account.payment'].create({
    'payment_type': 'inbound',       # customer paying us
    'partner_type': 'customer',
    'partner_id': partner.id,
    'amount': 1000.0,
    'date': fields.Date.today(),
    'journal_id': cash_journal.id,
    'currency_id': currency.id,
})
payment.action_post()
```

---

## account.journal — Journal

```python
name        = fields.Char()
type        = fields.Selection([
    ('sale', 'Sales'),
    ('purchase', 'Purchase'),
    ('cash', 'Cash'),
    ('bank', 'Bank'),
    ('general', 'Miscellaneous'),
])
code        = fields.Char()             # 4-char prefix (e.g. INV, BILL, CSH)
currency_id = fields.Many2one('res.currency')
company_id  = fields.Many2one('res.company')
default_account_id = fields.Many2one('account.account')
```

---

## account.tax — Tax

```python
name           = fields.Char()
type_tax_use   = fields.Selection([
    ('sale', 'Sales'),
    ('purchase', 'Purchase'),
    ('none', 'None'),
])
amount_type    = fields.Selection([
    ('percent', 'Percentage'),
    ('fixed', 'Fixed'),
    ('division', 'Percentage of Price Tax Included'),
    ('group', 'Group of Taxes'),
])
amount         = fields.Float()         # e.g. 18.0 for 18%
price_include  = fields.Boolean()       # True = tax-inclusive pricing
company_id     = fields.Many2one('res.company')
```

---

## res.partner — Partner (Customer / Vendor)

```python
name            = fields.Char()
customer_rank   = fields.Integer()      # > 0 = customer
supplier_rank   = fields.Integer()      # > 0 = vendor
vat             = fields.Char()         # GSTIN / VAT number
phone           = fields.Char()
email           = fields.Char()
street          = fields.Char()
city            = fields.Char()
state_id        = fields.Many2one('res.country.state')
country_id      = fields.Many2one('res.country')
zip             = fields.Char()
company_type    = fields.Selection([('person','Individual'), ('company','Company')])
parent_id       = fields.Many2one('res.partner')   # company of contact
property_account_receivable_id = fields.Many2one('account.account')
property_account_payable_id    = fields.Many2one('account.account')
property_payment_term_id       = fields.Many2one('account.payment.term')
```

---

## product.template / product.product

```python
# product.template — the product definition
name        = fields.Char()
type        = fields.Selection([
    ('consu', 'Consumable'),
    ('service', 'Service'),
    ('product', 'Storable Product'),   # tracks stock
])
list_price      = fields.Float()        # sales price
standard_price  = fields.Float()        # cost price
taxes_id        = fields.Many2many('account.tax')       # customer taxes
supplier_taxes_id = fields.Many2many('account.tax')     # vendor taxes
uom_id          = fields.Many2one('uom.uom')
uom_po_id       = fields.Many2one('uom.uom')
categ_id        = fields.Many2one('product.category')
default_code    = fields.Char()         # internal reference / SKU

# product.product — the variant (inherits template)
product_tmpl_id = fields.Many2one('product.template')
# Access via: template.product_variant_ids or template.product_variant_id (if single)
```
