# Mini Inventory Documentation

This package contains implementation references for the Mini Inventory Management System.

## Files

- `mini_inventory_brd.md` — Business requirements, scope, module definitions, rules, and acceptance criteria.
- `mini_inventory_fsd.md` — Functional flows, field behavior, validation, stock logic, reporting logic, and suggested entities.

## Recommended Codex Usage

Provide both Markdown files as project context. Ask Codex to:

1. Treat the BRD as the business scope and source of requirements.
2. Treat the FSD as the functional implementation reference.
3. Avoid adding features listed as out of scope.
4. Use the requirement IDs and functional IDs in code comments, tests, migrations, and pull requests.
5. Implement the stock ledger as the source of truth for stock calculations.
