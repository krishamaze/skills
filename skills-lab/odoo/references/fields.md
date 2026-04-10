# Odoo 19.0 — Field Parameters Reference

Source: `odoo/odoo@19.0/odoo/orm/fields.py`

---

## Common Parameters (all field types)

```python
fields.Char(
    string='Label',          # UI label (default: field name formatted)
    required=False,          # NOT NULL constraint
    readonly=False,          # not editable in UI (can still write via ORM)
    store=True,              # stored in DB (False = computed only in memory)
    index=False,             # DB index: False, True, 'btree', 'btree_not_null', 'trigram'
    copy=True,               # copied when duplicating record
    default=None,            # default value or callable
    compute='_compute_name', # method name that computes this field
    compute_sudo=False,      # compute as superuser
    inverse='_inverse_name', # method to write back computed field
    search='_search_name',   # method for domain search on computed field
    related='partner_id.name', # chain of fields (shortcut for compute+depends)
    depends=['field1'],      # explicit compute dependencies (use @api.depends instead)
    precompute=False,        # compute before creation (for required computed fields)
    company_dependent=False, # per-company value (stored as JSONB)
    aggregator='sum',        # how to aggregate in group_by: 'sum','avg','min','max','count'
    groups='base.group_user', # access restriction by XML ID
    help='Tooltip text',     # tooltip shown in UI
    tracking=True,           # track changes in chatter (True, or priority int)
    translate=False,         # enable translation (True or callable)
    prefetch=True,           # prefetch group (False = no prefetch)
)
```

---

## Char

```python
name = fields.Char(
    string='Name',
    size=256,           # max length (optional — no DB constraint, only validation)
    trim=True,          # strip leading/trailing whitespace
)
```

---

## Text / Html

```python
description = fields.Text()
body = fields.Html(sanitize=True, sanitize_tags=True, strip_style=False)
```

---

## Integer / Float / Monetary

```python
count = fields.Integer()

rate = fields.Float(
    digits=(16, 4),     # (total digits, decimal digits) — or use precision parameter
    # OR:
    digits='Product Price',  # reference to decimal.precision record name
)

amount = fields.Monetary(
    currency_field='currency_id',   # field on same model pointing to res.currency
)
currency_id = fields.Many2one('res.currency')
```

---

## Boolean

```python
active = fields.Boolean(default=True)
# NOTE: active=False automatically filters records — Odoo convention
```

---

## Date / Datetime

```python
from odoo import fields

invoice_date = fields.Date(
    default=fields.Date.today,    # callable — evaluated at record time
)

scheduled_at = fields.Datetime(
    default=fields.Datetime.now,  # callable
)

# Utilities
fields.Date.today()               # current date as date object
fields.Date.from_string('2024-01-15')
fields.Date.to_string(date_obj)
fields.Datetime.now()
fields.Datetime.from_string('2024-01-15 10:30:00')
```

Datetimes are always stored and returned in UTC.

---

## Selection

```python
state = fields.Selection(
    selection=[
        ('draft', 'Draft'),
        ('posted', 'Posted'),
        ('cancel', 'Cancelled'),
    ],
    default='draft',
    selection_add=[('new_state', 'New State')],  # when extending inherited field
)
```

---

## Many2one

```python
partner_id = fields.Many2one(
    comodel_name='res.partner',   # or just positional: fields.Many2one('res.partner')
    string='Customer',
    required=True,
    ondelete='restrict',          # 'restrict' | 'cascade' | 'set null'
    domain=[('customer_rank', '>', 0)],
    context={'default_customer_rank': 1},
    auto_join=False,              # JOIN in search (bypasses access rules — use carefully)
)
```

---

## One2many

```python
line_ids = fields.One2many(
    comodel_name='my.model.line',
    inverse_name='parent_id',     # Many2one field on the child model pointing back
    string='Lines',
    copy=True,
    domain=[('active', '=', True)],
)
```

---

## Many2many

```python
tag_ids = fields.Many2many(
    comodel_name='my.tag',
    relation='my_model_tag_rel',  # relation table name (auto-generated if omitted)
    column1='model_id',           # FK column for this model in relation table
    column2='tag_id',             # FK column for comodel in relation table
    string='Tags',
)
```

---

## Binary

```python
image = fields.Binary(
    attachment=True,      # store as ir.attachment (recommended for large files)
    string='Image',
)
```

---

## Computed Fields

```python
total = fields.Float(
    compute='_compute_total',
    store=True,           # store=True = recalculated and persisted on dependency change
    # store=False = recalculated every time it's read (no DB column)
)

@api.depends('line_ids.price_subtotal')
def _compute_total(self):
    for record in self:
        record.total = sum(record.line_ids.mapped('price_subtotal'))
```

---

## Related Fields

```python
partner_name = fields.Char(
    related='partner_id.name',
    store=True,           # store=True copies value to DB
    readonly=True,
)
```

---

## Property Fields (company-dependent)

```python
# Value differs per company — stored as JSONB
property_account_id = fields.Many2one(
    'account.account',
    company_dependent=True,
)
```

---

## `index` options (19.0)

| Value | PostgreSQL index type |
|---|---|
| `True` or `'btree'` | Standard B-tree |
| `'btree_not_null'` | B-tree, excludes NULL values |
| `'trigram'` | GIN trigram (for ilike search) |
| `False` | No index |

---

## `aggregator` values (19.0, replaces `group_operator`)

| Value | Behaviour |
|---|---|
| `'sum'` | Sum of values |
| `'avg'` | Average |
| `'min'` | Minimum |
| `'max'` | Maximum |
| `'count'` | Count of records |
| `'count_distinct'` | Count distinct |
| `'array_agg'` | Array of values |
| `None` | No aggregation (default for most fields) |

```python
amount = fields.Float(aggregator='sum')    # groups will sum this field
```
