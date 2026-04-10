# Odoo 19.0 — Security Reference

Source: `odoo/odoo@19.0/odoo/addons/base/security/` and ORM source.

---

## ir.model.access.csv — Model-Level Access

Every model needs an access record or no user can CRUD it.
File must be listed under `data:` in `__manifest__.py`.

```csv
id,name,model_id:id,group_id:id,perm_read,perm_write,perm_create,perm_unlink
access_my_model_user,my.model user,model_my_model,base.group_user,1,1,1,0
access_my_model_manager,my.model manager,model_my_model,my_module.group_manager,1,1,1,1
```

Column rules:
- `id` — unique XML ID (no dots, underscores only)
- `model_id:id` — `model_` + model `_name` with dots replaced by underscores
- `group_id:id` — XML ID of `res.groups` record. **Leave blank = applies to all users**
- `perm_*` — 1=allowed, 0=denied

```python
# model _name → model_id:id
'my.model'          → model_my_model
'account.move'      → model_account_move
'res.partner'       → model_res_partner
```

---

## res.groups — Access Groups

```python
# Define a group in XML
<record id="group_manager" model="res.groups">
    <field name="name">Manager</field>
    <field name="category_id" ref="base.module_category_my_module"/>
    <field name="implied_ids" eval="[(4, ref('base.group_user'))]"/>
</record>
```

Reference in Python:
```python
self.env.user.has_group('my_module.group_manager')   # returns bool
```

Predefined base groups:
- `base.group_user` — Internal User
- `base.group_portal` — Portal
- `base.group_public` — Public
- `base.group_system` — Settings (admin)
- `base.group_erp_manager` — Administration / Access Rights
- `base.group_no_one` — Technical (hidden features)

---

## Record Rules — Row-Level Security

```xml
<record id="rule_my_model_own" model="ir.rule">
    <field name="name">My Model: own records</field>
    <field name="model_id" ref="model_my_model"/>
    <field name="groups" eval="[(4, ref('base.group_user'))]"/>
    <field name="domain_force">[('create_uid', '=', user.id)]</field>
    <field name="perm_read" eval="True"/>
    <field name="perm_write" eval="True"/>
    <field name="perm_create" eval="True"/>
    <field name="perm_unlink" eval="False"/>
</record>
```

`domain_force` has access to these variables:
- `user` — current `res.users` record
- `time` — Python time module
- `company_id` — current company ID (integer)
- `company_ids` — all allowed company IDs (list)

**Global rules** (no `groups`) — apply to ALL users, ANDed with group rules.
**Group rules** — apply only to specified group, ORed with other group rules for same group.

---

## ORM Access Checks

```python
# Check access programmatically
self.env['my.model'].check_access_rights('write')   # raises AccessError if denied
self.env['my.model'].check_access_rule('write')     # checks record rules

# Bypass access (use with care — only in trusted server-side code)
self.env['my.model'].sudo().search([])
self.env['my.model'].sudo(user_id).create({})       # run as specific user

# Check group membership
self.env.user.has_group('base.group_system')
```

---

## Field-Level Access

```python
# Restrict field visibility to a group
secret = fields.Char(groups='base.group_system')

# Readonly for non-managers
amount = fields.Float(
    groups='my_module.group_manager',   # only managers can write
)
```

In views, field access can also be restricted:
```xml
<field name="secret" groups="base.group_system"/>
```

---

## Multi-Company Security

```python
# Company-aware domain (always filter by allowed companies)
records = self.env['my.model'].search([
    ('company_id', 'in', self.env.companies.ids),
])

# Set company on record
record = self.env['my.model'].with_company(company).create({
    'company_id': company.id,
})

# Current company
self.env.company        # single active company
self.env.companies      # all companies user has access to
```

For multi-company models, always include:
```python
company_id = fields.Many2one(
    'res.company',
    required=True,
    default=lambda self: self.env.company,
)
```

---

## Security in Controllers

```python
from odoo import http
from odoo.http import request
from odoo.exceptions import AccessError

class MyController(http.Controller):

    @http.route('/my/route', type='jsonrpc', auth='user', methods=['POST'])
    def my_route(self, **kwargs):
        # auth='user'   — requires logged-in user
        # auth='public' — allows portal and public
        # auth='none'   — no auth check at all
        ...

    @http.route('/my/admin', type='jsonrpc', auth='user', methods=['POST'])
    def admin_only(self, **kwargs):
        if not request.env.user.has_group('base.group_system'):
            raise AccessError("Admin only")
```

---

## Computed Field Security Pattern

```python
# Field visible to all, writable only by managers
state = fields.Selection([...])

# In view XML:
# <field name="state" attrs="{'readonly': [('state', '=', 'posted')]}"/>

# Via groups on separate field for sensitive data:
internal_notes = fields.Text(groups='my_module.group_manager')
```

---

## Common Mistakes

1. **Forgetting `ir.model.access.csv`** — model is inaccessible to all users, raises `AccessError`
2. **Using `sudo()` in controllers** — bypasses security entirely; use only in batch jobs/crons
3. **Multi-company: not filtering `company_id`** — users see cross-company data
4. **Global record rule with wrong domain** — blocks ALL users including admin (except superuser)
5. **`perm_unlink=0` in access but no record rule** — unlink still blocked at model level
