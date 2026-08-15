# Mini Inventory Management System
## Entity Relationship Diagram (ERD) Reference

**Document Version:** 1.0  
**Purpose:** Database structure reference for implementation with Codex  

---

# 1. ERD Overview

The Mini Inventory Management System uses a simple relational structure consisting of:

- Master tables.
- Transaction header tables.
- Transaction detail tables.
- A stock movement ledger.

The master tables store reusable data such as Models, Service Tags, Devices, Customers, and Racks.

The transaction header tables store general information about each transaction, while transaction detail tables store the parts, racks, and quantities involved.

The `stock_movements` table acts as the inventory ledger and should be used as the primary source for stock balance calculations and inventory reports.

---

# 2. Main Relationships

The main relationships are:

- One Model can have many Service Tags.
- One Customer can have many Service Tags.
- One Device can have many Device Details.
- One Customer can have many Stock Adjustment In transactions.
- One Customer can have many Stock Release transactions.
- One Stock Adjustment In can have many Stock Adjustment In Details.
- One Stock Release can have many Stock Release Details.
- One Stock Release can have many Stock Returns.
- One Stock Return can have many Stock Return Details.
- One Stock Release Detail can be returned several times through partial returns.
- One Rack can contain many stock movements.
- One Device Detail can have many stock movements.

---

# 3. Master Tables

## 3.1 Models

The `models` table stores the supported equipment model.

| Column | Type | Key | Description |
|---|---|---|---|
| id | BIGINT / UUID | PK | Unique identifier |
| model_name | VARCHAR | UNIQUE | Equipment model name |
| description | TEXT |  | Additional description |
| is_active | BOOLEAN |  | Active status |
| created_at | DATETIME |  | Creation timestamp |
| updated_at | DATETIME |  | Last update timestamp |

### Example Data

- Dell PowerEdge R740
- Dell PowerEdge R750
- Dell PowerStore 500T
- Dell Latitude 5420

---

## 3.2 Service Tags

The `service_tags` table stores the unique service tag for a specific customer asset.

| Column | Type | Key | Description |
|---|---|---|---|
| id | BIGINT / UUID | PK | Unique identifier |
| model_id | BIGINT / UUID | FK | References `models.id` |
| customer_id | BIGINT / UUID | FK, Nullable | References `customers.id` |
| service_tag | VARCHAR | UNIQUE | Unique Service Tag |
| description | TEXT |  | Additional description |
| is_active | BOOLEAN |  | Active status |
| created_at | DATETIME |  | Creation timestamp |
| updated_at | DATETIME |  | Last update timestamp |

### Relationship

```text
models 1 ---- N service_tags
customers 1 ---- N service_tags
```

---

## 3.3 Customers

The `customers` table stores customers supported by the company.

| Column | Type | Key | Description |
|---|---|---|---|
| id | BIGINT / UUID | PK | Unique identifier |
| customer_name | VARCHAR | UNIQUE | Customer name |
| address | TEXT |  | Customer address |
| contact_person | VARCHAR |  | Contact person |
| contact_number | VARCHAR |  | Contact number |
| description | TEXT |  | Additional description |
| is_active | BOOLEAN |  | Active status |
| created_at | DATETIME |  | Creation timestamp |
| updated_at | DATETIME |  | Last update timestamp |

---

## 3.4 Devices

The `devices` table stores the general spare-part category or device name.

| Column | Type | Key | Description |
|---|---|---|---|
| id | BIGINT / UUID | PK | Unique identifier |
| device_name | VARCHAR | UNIQUE | General part or device name |
| description | TEXT |  | Additional description |
| is_active | BOOLEAN |  | Active status |
| created_at | DATETIME |  | Creation timestamp |
| updated_at | DATETIME |  | Last update timestamp |

### Example Data

- Hard Disk
- SSD
- Memory
- Power Supply
- System Board
- Processor
- RAID Controller
- Network Card
- Battery
- Cable

---

## 3.5 Device Details

The `device_details` table stores the specific identity and specification of each spare part.

| Column | Type | Key | Description |
|---|---|---|---|
| id | BIGINT / UUID | PK | Unique identifier |
| device_id | BIGINT / UUID | FK | References `devices.id` |
| part_number | VARCHAR |  | Part Number |
| dpn | VARCHAR | Nullable | Dell Part Number or equivalent |
| specification | TEXT |  | Technical specification |
| description | TEXT |  | Additional description |
| is_active | BOOLEAN |  | Active status |
| created_at | DATETIME |  | Creation timestamp |
| updated_at | DATETIME |  | Last update timestamp |

### Recommended Constraint

```sql
UNIQUE (device_id, part_number, dpn)
```

### Relationship

```text
devices 1 ---- N device_details
```

### Example

```text
Device:
Hard Disk

Device Detail:
Part Number: 0B24496
DP/N: 0B24496
Specification: 600 GB 15K 3.5-inch 6G SAS
```

The inventory stock should be calculated using `device_detail_id`, not only `device_id`.

---

## 3.6 Racks

The `racks` table stores the physical storage location.

| Column | Type | Key | Description |
|---|---|---|---|
| id | BIGINT / UUID | PK | Unique identifier |
| rack_code | VARCHAR | UNIQUE | Unique Rack Code |
| rack_name | VARCHAR |  | Rack Name |
| description | TEXT |  | Additional description |
| is_active | BOOLEAN |  | Active status |
| created_at | DATETIME |  | Creation timestamp |
| updated_at | DATETIME |  | Last update timestamp |

---

# 4. Stock Adjustment In Tables

## 4.1 Stock Adjustment In Header

The `stock_adjustment_ins` table stores the general information of each Stock Adjustment In transaction.

| Column | Type | Key | Description |
|---|---|---|---|
| id | BIGINT / UUID | PK | Unique identifier |
| transaction_number | VARCHAR | UNIQUE | Stock-In Number |
| transaction_date | DATE |  | Transaction date |
| customer_id | BIGINT / UUID | FK, Nullable | References `customers.id` |
| notes | TEXT |  | Transaction notes |
| status | VARCHAR / ENUM |  | Draft, Completed, or Cancelled |
| created_by | BIGINT / UUID | FK / Nullable | User who created the transaction |
| created_at | DATETIME |  | Creation timestamp |
| updated_at | DATETIME |  | Last update timestamp |

---

## 4.2 Stock Adjustment In Details

The `stock_adjustment_in_details` table stores the parts and quantities included in the Stock Adjustment In transaction.

| Column | Type | Key | Description |
|---|---|---|---|
| id | BIGINT / UUID | PK | Unique identifier |
| stock_adjustment_in_id | BIGINT / UUID | FK | References `stock_adjustment_ins.id` |
| device_detail_id | BIGINT / UUID | FK | References `device_details.id` |
| rack_id | BIGINT / UUID | FK | References `racks.id` |
| quantity | INTEGER |  | Incoming quantity |
| notes | TEXT |  | Detail notes |
| created_at | DATETIME |  | Creation timestamp |
| updated_at | DATETIME |  | Last update timestamp |

### Relationship

```text
stock_adjustment_ins 1 ---- N stock_adjustment_in_details
device_details 1 ---- N stock_adjustment_in_details
racks 1 ---- N stock_adjustment_in_details
```

---

# 5. Stock Release Tables

## 5.1 Stock Release Header

The `stock_releases` table stores the general information of each Stock Release transaction.

| Column | Type | Key | Description |
|---|---|---|---|
| id | BIGINT / UUID | PK | Unique identifier |
| transaction_number | VARCHAR | UNIQUE | Stock Release Number |
| release_date | DATE |  | Release date |
| engineer_name | VARCHAR |  | Engineer taking the part |
| customer_id | BIGINT / UUID | FK | References `customers.id` |
| model_id | BIGINT / UUID | FK, Nullable | References `models.id` |
| service_tag_id | BIGINT / UUID | FK, Nullable | References `service_tags.id` |
| reference_number | VARCHAR | Nullable | Ticket or work reference |
| notes | TEXT |  | Transaction notes |
| status | VARCHAR / ENUM |  | Draft, Completed, or Cancelled |
| created_by | BIGINT / UUID | FK / Nullable | User who created the transaction |
| created_at | DATETIME |  | Creation timestamp |
| updated_at | DATETIME |  | Last update timestamp |

### Recommended Validation

- `customer_id` is required.
- `engineer_name` is required.
- `service_tag_id` is optional.
- When `service_tag_id` is selected, it should belong to the selected Model and Customer.

---

## 5.2 Stock Release Details

The `stock_release_details` table stores the parts and quantities released.

| Column | Type | Key | Description |
|---|---|---|---|
| id | BIGINT / UUID | PK | Unique identifier |
| stock_release_id | BIGINT / UUID | FK | References `stock_releases.id` |
| device_detail_id | BIGINT / UUID | FK | References `device_details.id` |
| rack_id | BIGINT / UUID | FK | References `racks.id` |
| released_quantity | INTEGER |  | Released quantity |
| notes | TEXT |  | Detail notes |
| created_at | DATETIME |  | Creation timestamp |
| updated_at | DATETIME |  | Last update timestamp |

### Relationship

```text
stock_releases 1 ---- N stock_release_details
device_details 1 ---- N stock_release_details
racks 1 ---- N stock_release_details
```

---

# 6. Stock Return Tables

## 6.1 Stock Return Header

The `stock_returns` table stores the general information of each Stock Return transaction.

| Column | Type | Key | Description |
|---|---|---|---|
| id | BIGINT / UUID | PK | Unique identifier |
| transaction_number | VARCHAR | UNIQUE | Stock Return Number |
| return_date | DATE |  | Return date |
| stock_release_id | BIGINT / UUID | FK | References `stock_releases.id` |
| notes | TEXT |  | Transaction notes |
| status | VARCHAR / ENUM |  | Draft, Completed, or Cancelled |
| created_by | BIGINT / UUID | FK / Nullable | User who created the transaction |
| created_at | DATETIME |  | Creation timestamp |
| updated_at | DATETIME |  | Last update timestamp |

### Relationship

```text
stock_releases 1 ---- N stock_returns
```

A Stock Release may have multiple Stock Returns because partial returns are allowed.

---

## 6.2 Stock Return Details

The `stock_return_details` table stores the specific released part that is returned.

| Column | Type | Key | Description |
|---|---|---|---|
| id | BIGINT / UUID | PK | Unique identifier |
| stock_return_id | BIGINT / UUID | FK | References `stock_returns.id` |
| stock_release_detail_id | BIGINT / UUID | FK | References `stock_release_details.id` |
| destination_rack_id | BIGINT / UUID | FK | References `racks.id` |
| return_quantity | INTEGER |  | Returned quantity |
| notes | TEXT |  | Detail notes |
| created_at | DATETIME |  | Creation timestamp |
| updated_at | DATETIME |  | Last update timestamp |

### Relationship

```text
stock_returns 1 ---- N stock_return_details
stock_release_details 1 ---- N stock_return_details
racks 1 ---- N stock_return_details
```

### Important Rule

The Stock Return Detail must reference `stock_release_detail_id`, not only the Stock Release header.

This is required because one Stock Release may contain multiple parts.

Example:

```text
Stock Release SRL-001

Detail 1:
Hard Disk, Quantity 2

Detail 2:
Memory, Quantity 4
```

When one Hard Disk is returned, the Stock Return must reference the Hard Disk detail.

---

# 7. Stock Movement Ledger

## 7.1 Stock Movements

The `stock_movements` table stores every completed stock movement.

It should be used as the main data source for:

- Current stock balance.
- Stock Card Report.
- Stock Card Report by Customer.
- Stock-In Report.
- Stock-In Report by Customer.
- Stock-Out Report.
- Stock-Out Report by Customer.

| Column | Type | Key | Description |
|---|---|---|---|
| id | BIGINT / UUID | PK | Unique identifier |
| transaction_type | VARCHAR / ENUM |  | SAI, SRL, or SRT |
| transaction_id | BIGINT / UUID |  | Source transaction header ID |
| transaction_detail_id | BIGINT / UUID |  | Source transaction detail ID |
| transaction_number | VARCHAR |  | Human-readable transaction number |
| transaction_date | DATE |  | Business transaction date |
| device_detail_id | BIGINT / UUID | FK | References `device_details.id` |
| rack_id | BIGINT / UUID | FK | References `racks.id` |
| customer_id | BIGINT / UUID | FK, Nullable | References `customers.id` |
| engineer_name | VARCHAR | Nullable | Engineer from Stock Release |
| quantity_in | INTEGER |  | Incoming quantity |
| quantity_out | INTEGER |  | Outgoing quantity |
| created_by | BIGINT / UUID | FK / Nullable | User who posted the movement |
| created_at | DATETIME |  | Creation timestamp |

---

## 7.2 Ledger Rules

### Stock Adjustment In

A Completed Stock Adjustment In creates a movement with:

```text
quantity_in = transaction quantity
quantity_out = 0
```

### Stock Release

A Completed Stock Release creates a movement with:

```text
quantity_in = 0
quantity_out = released quantity
```

### Stock Return

A Completed Stock Return creates a movement with:

```text
quantity_in = return quantity
quantity_out = 0
```

### Stock Balance

```text
Current Stock =
SUM(quantity_in) - SUM(quantity_out)
```

The balance must be grouped by:

- `device_detail_id`
- `rack_id`

### Example

```text
Stock Adjustment In: +10
Stock Release:        -2
Stock Return:         +1

Current Stock:         9
```

---

# 8. Complete Relationship Summary

```text
models
  1 ---- N service_tags

customers
  1 ---- N service_tags

devices
  1 ---- N device_details

customers
  1 ---- N stock_adjustment_ins

customers
  1 ---- N stock_releases

models
  1 ---- N stock_releases

service_tags
  1 ---- N stock_releases

stock_adjustment_ins
  1 ---- N stock_adjustment_in_details

device_details
  1 ---- N stock_adjustment_in_details

racks
  1 ---- N stock_adjustment_in_details

stock_releases
  1 ---- N stock_release_details

device_details
  1 ---- N stock_release_details

racks
  1 ---- N stock_release_details

stock_releases
  1 ---- N stock_returns

stock_returns
  1 ---- N stock_return_details

stock_release_details
  1 ---- N stock_return_details

racks
  1 ---- N stock_return_details

device_details
  1 ---- N stock_movements

racks
  1 ---- N stock_movements

customers
  1 ---- N stock_movements
```

---

# 9. Text-Based ERD

```text
┌─────────────────────┐
│ models              │
├─────────────────────┤
│ id PK               │
│ model_name          │
│ description         │
│ is_active           │
└──────────┬──────────┘
           │ 1
           │
           │ N
┌──────────▼──────────┐
│ service_tags        │
├─────────────────────┤
│ id PK               │
│ model_id FK         │
│ customer_id FK      │
│ service_tag         │
│ description         │
│ is_active           │
└─────────────────────┘


┌─────────────────────┐
│ customers           │
├─────────────────────┤
│ id PK               │
│ customer_name       │
│ address             │
│ contact_person      │
│ contact_number      │
│ description         │
│ is_active           │
└─────────────────────┘


┌─────────────────────┐
│ devices             │
├─────────────────────┤
│ id PK               │
│ device_name         │
│ description         │
│ is_active           │
└──────────┬──────────┘
           │ 1
           │
           │ N
┌──────────▼──────────┐
│ device_details      │
├─────────────────────┤
│ id PK               │
│ device_id FK        │
│ part_number         │
│ dpn                 │
│ specification       │
│ description         │
│ is_active           │
└─────────────────────┘


┌─────────────────────┐
│ racks               │
├─────────────────────┤
│ id PK               │
│ rack_code           │
│ rack_name           │
│ description         │
│ is_active           │
└─────────────────────┘
```

```text
┌──────────────────────────────┐
│ stock_adjustment_ins         │
├──────────────────────────────┤
│ id PK                        │
│ transaction_number           │
│ transaction_date             │
│ customer_id FK nullable      │
│ notes                        │
│ status                       │
│ created_by                   │
└──────────────┬───────────────┘
               │ 1
               │
               │ N
┌──────────────▼───────────────┐
│ stock_adjustment_in_details  │
├──────────────────────────────┤
│ id PK                        │
│ stock_adjustment_in_id FK    │
│ device_detail_id FK          │
│ rack_id FK                   │
│ quantity                     │
│ notes                        │
└──────────────────────────────┘
```

```text
┌──────────────────────────────┐
│ stock_releases               │
├──────────────────────────────┤
│ id PK                        │
│ transaction_number           │
│ release_date                 │
│ engineer_name                │
│ customer_id FK               │
│ model_id FK nullable         │
│ service_tag_id FK nullable   │
│ reference_number nullable    │
│ notes                        │
│ status                       │
│ created_by                   │
└──────────────┬───────────────┘
               │ 1
               │
               │ N
┌──────────────▼───────────────┐
│ stock_release_details        │
├──────────────────────────────┤
│ id PK                        │
│ stock_release_id FK          │
│ device_detail_id FK          │
│ rack_id FK                   │
│ released_quantity            │
│ notes                        │
└──────────────────────────────┘
```

```text
┌──────────────────────────────┐
│ stock_returns                │
├──────────────────────────────┤
│ id PK                        │
│ transaction_number           │
│ return_date                  │
│ stock_release_id FK          │
│ notes                        │
│ status                       │
│ created_by                   │
└──────────────┬───────────────┘
               │ 1
               │
               │ N
┌──────────────▼───────────────┐
│ stock_return_details         │
├──────────────────────────────┤
│ id PK                        │
│ stock_return_id FK           │
│ stock_release_detail_id FK   │
│ destination_rack_id FK       │
│ return_quantity              │
│ notes                        │
└──────────────────────────────┘
```

```text
┌──────────────────────────────┐
│ stock_movements              │
├──────────────────────────────┤
│ id PK                        │
│ transaction_type             │
│ transaction_id               │
│ transaction_detail_id        │
│ transaction_number           │
│ transaction_date             │
│ device_detail_id FK          │
│ rack_id FK                   │
│ customer_id FK nullable      │
│ engineer_name nullable       │
│ quantity_in                  │
│ quantity_out                 │
│ created_by                   │
│ created_at                   │
└──────────────────────────────┘
```

---

# 10. Recommended Unique Constraints

```text
models.model_name
service_tags.service_tag
customers.customer_name
devices.device_name
racks.rack_code
stock_adjustment_ins.transaction_number
stock_releases.transaction_number
stock_returns.transaction_number
```

For Device Detail:

```sql
UNIQUE (device_id, part_number, dpn)
```

---

# 11. Recommended Status Values

```text
DRAFT
COMPLETED
CANCELLED
```

Only `COMPLETED` transactions should create active stock movement records and affect current stock.

---

# 12. Recommended Transaction Type Values

```text
SAI = Stock Adjustment In
SRL = Stock Release
SRT = Stock Return
```

---

# 13. Important Implementation Notes

## 13.1 Device Detail Is the Stock Item

The system must calculate stock using `device_detail_id`.

The `devices` table only represents the general category, while `device_details` represents the actual inventory item.

## 13.2 Rack Is Part of the Stock Balance

The same Device Detail may exist in multiple Racks.

Example:

```text
Hard Disk PN 0B24496
Rack A: 5 units
Rack B: 3 units
```

The total stock is 8 units, but Stock Release must reduce stock from the selected Rack.

## 13.3 Stock Return Must Reference Release Detail

A Stock Return Detail must reference `stock_release_detail_id`.

This allows the system to:

- Identify the exact released part.
- Calculate Previously Returned Quantity.
- Calculate Remaining Returnable Quantity.
- Support partial returns.

## 13.4 Use Stock Movement as Report Source

Reports should primarily read from `stock_movements`.

This avoids repeatedly combining all transaction tables and provides one consistent source for:

- Quantity In.
- Quantity Out.
- Running Balance.
- Stock by Rack.
- Stock by Customer.
- Stock history.

## 13.5 Cancellation Handling

Use one consistent method:

### Recommended Method

When a Completed transaction is cancelled:

1. Keep the original Stock Movement.
2. Create a reversing Stock Movement.
3. Mark the transaction as Cancelled.
4. Preserve the full audit history.

Example:

```text
Original Stock Adjustment In:
quantity_in = 10
quantity_out = 0

Cancellation Reversal:
quantity_in = 0
quantity_out = 10
```

This method keeps the ledger traceable and prevents deletion of historical stock activity.
