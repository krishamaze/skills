# Odoo Breaking Changes — Version Reference

Source: `odoo/odoo` GitHub changelogs + `docs.odoo.com` ORM changelog.
Always check the target branch's source before assuming behaviour.

---

## Odoo 19.0 (current stable)

### Removed / Hard Breaks

| What | Before | After 19.0 |
|---|---|---|
| `name_get()` | Override to customize display name | **Removed** — override `_compute_display_name` |
| `read_group()` public API | Available | **Deprecated** → use `_read_group()` or `formatted_read_group()` |
| `from odoo import registry` | `registry` importable from `odoo` | `from odoo.modules.registry import Registry` |
| HTTP route type | `@http.route(type='json')` | Must be `type='jsonrpc'` |
| `res.partner.title` model | Existed | **Removed** — migrate data to alternative |
| `record._cr` | `self._cr` | Use `self.env.cr` |
| `record._context` | `self._context` | Use `self.env.context` |
| `record._uid` | `self._uid` | Use `self.env.uid` |
| `odoo.osv` | Import available | **Deprecated** |
| Demo data | Loaded by default | **Not loaded by default** — must be explicitly requested |
| UoM categories | Required for conversions | `relative_uom_id` for direct unit links (overhaul) |
| `res.groups` categories | `ir.module.category` | Now `res.groups.privilege` |
| ORM location | `odoo/fields.py`, `odoo/models.py` | Moved to `odoo/orm/` subpackage |

### New in 19.0

```python
@api.private                              # marks method as not RPC-accessible
def _internal_method(self): ...

from odoo.fields import Domain            # Domain class now importable directly
d = Domain('field', '=', value) & Domain('other', '!=', False)

# _read_group() — correct API
groups = self.env['my.model']._read_group(
    domain=[('active', '=', True)],
    groupby=['partner_id'],
    aggregates=['amount:sum'],
)

# formatted_read_group() — public API equivalent
```

---

## Odoo 18.0

### Key Changes

| What | Change |
|---|---|
| `group_operator` field attr | **Deprecated** → use `aggregator` |
| `name_get()` | Still works but deprecated (removed in 19) |
| Payment optional journal entry | Payments can exist without generating a journal entry |

```python
# 18.0+ field definition
amount = fields.Float(aggregator='sum')    # NOT group_operator='sum'
```

---

## Odoo 17.0

### Key Changes

| What | Change |
|---|---|
| `name_get()` | **Deprecated** — use `display_name` |
| `_read_group()` | New signature — incompatible with 16.0 `read_group()` |
| `search_fetch()` / `fetch()` | New methods combining search + read |
| Translations | Stored as JSONB, not in `ir.translation` table |
| `fields_get_keys()` | **Deprecated** |
| `get_xml_id()` | **Deprecated** |
| `_mapped_cache()` | **Removed** |
| `One2many`/`Many2many` `limit` attr | **Removed** |
| `_sequence` model attr | **Removed** |
| Field `column_format` attr | **Removed** |
| Field `deprecated` attr | **Removed** |
| `search_count()` | Now accepts `limit` param |

```python
# 17.0+ display name — correct way
class MyModel(models.Model):
    _name = 'my.model'

    def _compute_display_name(self):
        for record in self:
            record.display_name = f"{record.name} ({record.code})"

# WRONG in 17.0+ — will cause deprecation warning
def name_get(self):
    return [(r.id, f"{r.name} ({r.code})") for r in self]
```

---

## Odoo 16.0

### Key Changes

| What | Change |
|---|---|
| `account.move` | `invoice_payment_state` field renamed to `payment_state` |
| `account_move_line` `user_type_id` | Removed — use `account_id.account_type` |

---

## Common Upgrade Patterns

### `name_get` → `_compute_display_name`

```python
# OLD (pre-17)
def name_get(self):
    return [(r.id, f"{r.ref} - {r.name}") for r in self]

# NEW (17+)
def _compute_display_name(self):
    for r in self:
        r.display_name = f"{r.ref} - {r.name}"
```

### `read_group` → `_read_group`

```python
# OLD (pre-17)
result = self.env['my.model'].read_group(
    domain=[('active', '=', True)],
    fields=['amount:sum', 'partner_id'],
    groupby=['partner_id'],
)

# NEW (17+)
groups = self.env['my.model']._read_group(
    domain=[('active', '=', True)],
    groupby=['partner_id'],
    aggregates=['amount:sum'],
)
for group_key, amount_sum in groups:
    partner = group_key  # recordset
```

### HTTP route type

```python
# OLD (pre-19)
@http.route('/my/route', type='json', auth='user')
def my_route(self):
    return {'result': True}

# NEW (19.0)
@http.route('/my/route', type='jsonrpc', auth='user')
def my_route(self):
    return {'result': True}
```

### Deprecated attributes

```python
# OLD
amount = fields.Float(group_operator='sum')

# NEW (18+)
amount = fields.Float(aggregator='sum')
```

---

## Module Version Format

```
'version': '19.0.1.0.0'
             ^    ^ ^ ^
             |    | | patch fix
             |    | minor
             |    major
             Odoo version
```

The leading `19.0.` is required — Odoo uses it to know which branch the module targets.
