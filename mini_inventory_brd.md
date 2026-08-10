# Mini Inventory Management System
## Business Requirements Document (BRD)

**Document Version:** 1.0  
**Application Type:** Internal Web-Based Application  
**Primary Users:** Internal inventory staff and engineers  

---

## 1. Background

The company provides local support services for servers, storage systems, and laptops. Spare parts are stored internally on racks and are used by engineers when supporting customers.

Currently, the movement of spare parts is recorded manually. When an engineer takes a part, the company may not have a complete record of:

- Which part was taken.
- The quantity taken.
- Which engineer took the part.
- Which customer the part was used for.
- Which rack the part came from.
- Whether the part was returned.
- The current stock balance.

The company requires a simple web-based inventory management system to record stock-in, stock release, and stock return transactions.

---

## 2. Objectives

The system shall:

1. Record all incoming stock.
2. Record all parts released to engineers.
3. Record all parts returned by engineers.
4. Record the related customer for each transaction when applicable.
5. Record the source or destination rack.
6. Automatically calculate the current stock balance.
7. Provide stock movement reports.
8. Reduce manual stock recording.

---

## 3. Scope

### 3.1 Master Modules

1. Model
   - Child: Service Tag
2. Device
   - Child: Part Number, DP/N, and Specification
3. Customer
4. Rack

### 3.2 Transaction Modules

1. Stock Adjustment In
2. Stock Release
3. Stock Return

### 3.3 Report Modules

1. Stock Card Report
2. Stock Card Report by Customer
3. Stock-In Report
4. Stock-In Report by Customer
5. Stock-Out Report
6. Stock-Out Report by Customer

### 3.4 Supporting Requirement

Engineer Name shall be recorded in Stock Release and Stock Return transactions.

Engineer Name may be implemented as a dropdown or text field. A separate Engineer Master is not required for the first version.

---

## 4. Out of Scope

The following features are not included in the first version:

- Purchase order management.
- Supplier management.
- Approval workflow.
- Stock reservation.
- Warehouse transfer.
- Barcode or QR code scanning.
- Procurement integration.
- ERP integration.
- Mobile application.
- Defective stock management.
- Automated notification.
- Advanced role and permission configuration.

---

## 5. User Access

### 5.1 Administrator

The Administrator can:

- Manage master data.
- Create transactions.
- Cancel eligible transactions.
- View reports.
- Export reports.

### 5.2 User

The User can:

- Create stock transactions.
- View stock information.
- View reports.

---

# 6. Module Requirements

## 6.1 Model Master

### Purpose

Stores the equipment models supported by the company.

### Example Data

- Dell PowerEdge R740
- Dell PowerEdge R750
- Dell PowerStore 500T
- Dell Latitude 5420

### Fields

| Field | Required | Description |
|---|---:|---|
| Model ID | System | Unique record identifier |
| Model Name | Yes | Equipment model name |
| Description | No | Additional information |
| Active Status | Yes | Active or inactive |

### Business Rules

- Model Name is mandatory.
- Model Name must be unique.
- One Model may have multiple Service Tags.
- Inactive Models cannot be selected in new transactions.

---

## 6.2 Service Tag

### Purpose

Stores the unique service tag of a specific customer device.

### Relationship

A Service Tag is a child record of a Model.

### Fields

| Field | Required | Description |
|---|---:|---|
| Service Tag ID | System | Unique record identifier |
| Service Tag | Yes | Unique device service tag |
| Model | Yes | Parent Model |
| Customer | No | Related Customer |
| Description | No | Additional information |
| Active Status | Yes | Active or inactive |

### Business Rules

- Service Tag is mandatory.
- Service Tag must be unique.
- Every Service Tag must belong to one Model.
- A Service Tag may be linked to one Customer.
- Inactive Service Tags cannot be selected in new transactions.

---

## 6.3 Device Master

### Purpose

Stores the general spare-part category or device name.

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

### Fields

| Field | Required | Description |
|---|---:|---|
| Device ID | System | Unique record identifier |
| Device Name | Yes | General part or device name |
| Description | No | Additional information |
| Active Status | Yes | Active or inactive |

### Business Rules

- Device Name is mandatory.
- Device Name must be unique.
- One Device may have multiple Device Details.
- Inactive Devices cannot be selected in new transactions.

---

## 6.4 Device Detail

### Purpose

Stores the specific identity and specification of a spare part.

### Relationship

A Device Detail is a child record of a Device.

### Fields

| Field | Required | Description |
|---|---:|---|
| Device Detail ID | System | Unique record identifier |
| Device | Yes | Parent Device |
| Part Number | Yes | Manufacturer or product part number |
| DP/N | No | Dell Part Number or equivalent |
| Specification | Yes | Technical specification |
| Description | No | Additional information |
| Active Status | Yes | Active or inactive |

### Business Rules

- Every Device Detail must belong to one Device.
- Part Number is mandatory.
- Specification is mandatory.
- The combination of Part Number and DP/N must be unique.
- Inactive Device Details cannot be selected in new transactions.

---

## 6.5 Customer Master

### Purpose

Stores customers supported by the company.

### Fields

| Field | Required | Description |
|---|---:|---|
| Customer ID | System | Unique record identifier |
| Customer Name | Yes | Customer company name |
| Address | No | Customer address |
| Contact Person | No | Customer contact |
| Contact Number | No | Customer phone number |
| Description | No | Additional information |
| Active Status | Yes | Active or inactive |

### Business Rules

- Customer Name is mandatory.
- Customer Name must be unique.
- Inactive Customers cannot be selected in new transactions.
- Historical transactions remain visible after a Customer is deactivated.

---

## 6.6 Rack Master

### Purpose

Stores the physical locations where spare parts are kept.

### Fields

| Field | Required | Description |
|---|---:|---|
| Rack ID | System | Unique record identifier |
| Rack Code | Yes | Unique rack code |
| Rack Name | Yes | Rack name |
| Description | No | Additional information |
| Active Status | Yes | Active or inactive |

### Business Rules

- Rack Code is mandatory.
- Rack Code must be unique.
- Inactive Racks cannot be selected in new transactions.
- A Rack containing stock cannot be deleted.

---

## 6.7 Stock Adjustment In

### Purpose

Records parts entering inventory.

### Use Cases

- Initial stock entry.
- Newly received stock.
- Additional stock.
- Stock quantity correction.

### Header Fields

| Field | Required | Description |
|---|---:|---|
| Stock-In Number | System | Auto-generated transaction number |
| Transaction Date | Yes | Stock-in date |
| Customer | No | Related Customer |
| Notes | No | Transaction notes |
| Status | System | Draft, Completed, or Cancelled |
| Created By | System | User who created the transaction |
| Created Date | System | Creation timestamp |

### Detail Fields

| Field | Required | Description |
|---|---:|---|
| Device | Yes | Selected Device |
| Device Detail | Yes | Selected PN, DP/N, and Specification |
| Rack | Yes | Destination Rack |
| Quantity | Yes | Incoming quantity |
| Notes | No | Line notes |

### Business Rules

- The transaction number is generated automatically.
- Quantity must be greater than zero.
- A Completed transaction increases stock.
- A Draft transaction does not affect stock.
- A Cancelled transaction does not affect current stock.
- Completed transactions cannot be permanently deleted.
- Customer is optional.

### Number Format

`SAI-YYYYMM-0001`

---

## 6.8 Stock Release

### Purpose

Records parts taken from a rack by an engineer for customer support.

### Header Fields

| Field | Required | Description |
|---|---:|---|
| Stock Release Number | System | Auto-generated transaction number |
| Release Date | Yes | Release date |
| Engineer Name | Yes | Engineer taking the part |
| Customer | Yes | Related Customer |
| Model | No | Related equipment Model |
| Service Tag | No | Related Service Tag |
| Support Ticket / Reference | No | Ticket or work reference |
| Notes | No | Transaction notes |
| Status | System | Draft, Completed, or Cancelled |
| Created By | System | User who created the transaction |
| Created Date | System | Creation timestamp |

### Detail Fields

| Field | Required | Description |
|---|---:|---|
| Device | Yes | Selected Device |
| Device Detail | Yes | Selected PN, DP/N, and Specification |
| Source Rack | Yes | Rack from which stock is taken |
| Available Quantity | System | Current available stock |
| Released Quantity | Yes | Quantity taken |
| Notes | No | Line notes |

### Business Rules

- The transaction number is generated automatically.
- Engineer Name is mandatory.
- Customer is mandatory.
- Service Tag is optional.
- Released Quantity must be greater than zero.
- Released Quantity cannot exceed Available Quantity.
- A Completed transaction reduces stock.
- The system must prevent negative stock.
- A Cancelled transaction does not affect current stock.
- Completed transactions cannot be permanently deleted.

### Number Format

`SRL-YYYYMM-0001`

---

## 6.9 Stock Return

### Purpose

Records parts returned after a Stock Release.

### Header Fields

| Field | Required | Description |
|---|---:|---|
| Stock Return Number | System | Auto-generated transaction number |
| Return Date | Yes | Return date |
| Original Stock Release Number | Yes | Related Stock Release |
| Engineer Name | System | Taken from original release |
| Customer | System | Taken from original release |
| Notes | No | Transaction notes |
| Status | System | Draft, Completed, or Cancelled |
| Created By | System | User who created the transaction |
| Created Date | System | Creation timestamp |

### Detail Fields

| Field | Required | Description |
|---|---:|---|
| Device | System | Taken from original release |
| Device Detail | System | Taken from original release |
| Released Quantity | System | Original released quantity |
| Previously Returned Quantity | System | Total previous returns |
| Remaining Returnable Quantity | System | Quantity still returnable |
| Return Quantity | Yes | Current returned quantity |
| Destination Rack | Yes | Rack receiving the returned part |
| Notes | No | Line notes |

### Business Rules

- Stock Return must reference a Completed Stock Release.
- Return Quantity must be greater than zero.
- Return Quantity cannot exceed Remaining Returnable Quantity.
- Partial return is allowed.
- A Completed Stock Return increases stock.
- A Cancelled Stock Return does not affect current stock.
- Completed transactions cannot be permanently deleted.

### Number Format

`SRT-YYYYMM-0001`

---

# 7. Stock Calculation

## 7.1 Current Stock

```text
Current Stock =
Total Completed Stock Adjustment In
- Total Completed Stock Release
+ Total Completed Stock Return
```

## 7.2 Remaining Returnable Quantity

```text
Remaining Returnable Quantity =
Released Quantity
- Total Completed Return Quantity
```

## 7.3 Calculation Dimension

Stock shall be calculated by:

- Device Detail.
- Part Number.
- DP/N.
- Specification.
- Rack.

---

# 8. Report Requirements

## 8.1 Stock Card Report

Displays chronological stock movement and running balance.

### Fields

- Transaction Date
- Transaction Number
- Transaction Type
- Device
- Part Number
- DP/N
- Specification
- Rack
- Customer
- Engineer Name
- Quantity In
- Quantity Out
- Running Balance
- Notes

### Filters

- Date Range
- Device
- Part Number
- DP/N
- Rack
- Transaction Type

---

## 8.2 Stock Card Report by Customer

Displays stock movements for a selected Customer.

### Fields

- Customer
- Transaction Date
- Transaction Number
- Transaction Type
- Model
- Service Tag
- Device
- Part Number
- DP/N
- Specification
- Rack
- Engineer Name
- Quantity In
- Quantity Out
- Notes

### Filters

- Date Range
- Customer
- Model
- Service Tag
- Device
- Part Number
- Transaction Type

---

## 8.3 Stock-In Report

Displays all Completed Stock Adjustment In and Stock Return transactions.

### Fields

- Transaction Date
- Transaction Number
- Stock-In Type
- Device
- Part Number
- DP/N
- Specification
- Quantity
- Rack
- Customer
- Created By
- Notes

### Filters

- Date Range
- Device
- Part Number
- DP/N
- Rack
- Stock-In Type

---

## 8.4 Stock-In Report by Customer

Displays incoming transactions associated with a selected Customer.

### Filters

- Date Range
- Customer
- Device
- Part Number
- Rack
- Stock-In Type

---

## 8.5 Stock-Out Report

Displays all Completed Stock Release transactions.

### Fields

- Release Date
- Stock Release Number
- Engineer Name
- Customer
- Model
- Service Tag
- Device
- Part Number
- DP/N
- Specification
- Source Rack
- Released Quantity
- Support Ticket / Reference
- Created By
- Notes

### Filters

- Date Range
- Engineer Name
- Customer
- Device
- Part Number
- DP/N
- Rack

---

## 8.6 Stock-Out Report by Customer

Displays Stock Release transactions for a selected Customer.

### Filters

- Date Range
- Customer
- Model
- Service Tag
- Engineer Name
- Device
- Part Number
- Rack

---

# 9. General Functional Requirements

| ID | Requirement |
|---|---|
| FR-GEN-001 | The system shall be accessible through a web browser. |
| FR-GEN-002 | The system shall require login before access. |
| FR-GEN-003 | The system shall generate unique transaction numbers automatically. |
| FR-GEN-004 | The system shall record Created By and Created Date. |
| FR-GEN-005 | The system shall display current stock before Stock Release. |
| FR-GEN-006 | The system shall prevent negative stock. |
| FR-GEN-007 | The system shall update stock immediately after a transaction becomes Completed. |
| FR-GEN-008 | The system shall exclude Draft and Cancelled transactions from stock calculations. |
| FR-GEN-009 | The system shall preserve Completed transaction history. |
| FR-GEN-010 | The system shall support search and filtering. |
| FR-GEN-011 | The system shall allow report export to Excel. |
| FR-GEN-012 | The system shall only show active master data in new transactions. |

---

# 10. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-001 | The application shall be web-based. |
| NFR-002 | The interface shall be simple and suitable for internal users. |
| NFR-003 | Standard pages should load within five seconds under normal internal network conditions. |
| NFR-004 | The system shall support current versions of Google Chrome and Microsoft Edge. |
| NFR-005 | Passwords shall be stored securely. |
| NFR-006 | The deployed application shall use HTTPS. |
| NFR-007 | The system shall preserve data consistency during stock updates. |

---

# 11. Acceptance Criteria

## 11.1 Master Data

```gherkin
Feature: Model and Service Tag management

  Scenario: Create a Model
    Given the user is logged in
    When the user enters a unique Model Name
    And saves the record
    Then the system shall create the Model

  Scenario: Add a Service Tag
    Given an active Model exists
    When the user enters a unique Service Tag
    And saves the record
    Then the system shall register the Service Tag under the selected Model
```

```gherkin
Feature: Device and Device Detail management

  Scenario: Add a Device Detail
    Given an active Device exists
    When the user enters a Part Number and Specification
    And saves the record
    Then the system shall register the Device Detail under the selected Device
```

```gherkin
Feature: Customer and Rack management

  Scenario: Create a Customer
    When the user enters a unique Customer Name
    And saves the record
    Then the system shall create the Customer

  Scenario: Create a Rack
    When the user enters a unique Rack Code and Rack Name
    And saves the record
    Then the system shall create the Rack
```

## 11.2 Stock Adjustment In

```gherkin
Feature: Stock Adjustment In

  Scenario: Complete a valid Stock Adjustment In
    Given an active Device Detail and Rack exist
    When the user enters a Quantity greater than zero
    And completes the transaction
    Then the system shall generate a Stock-In Number
    And increase the stock
    And show the transaction in the Stock-In Report
```

## 11.3 Stock Release

```gherkin
Feature: Stock Release

  Scenario: Release available stock
    Given sufficient stock is available
    When the user selects an Engineer, Customer, Device Detail, Rack, and valid Quantity
    And completes the transaction
    Then the system shall generate a Stock Release Number
    And reduce the stock
    And show the transaction in the Stock-Out Report

  Scenario: Prevent release above available stock
    Given the available stock is 2
    When the user enters a Released Quantity of 3
    Then the system shall reject the transaction
    And display the available quantity
```

## 11.4 Stock Return

```gherkin
Feature: Stock Return

  Scenario: Return a released part
    Given a Completed Stock Release has a remaining returnable quantity
    When the user enters a valid Return Quantity
    And completes the transaction
    Then the system shall increase the stock
    And reduce the Remaining Returnable Quantity
    And show the transaction in the Stock-In Report

  Scenario: Prevent excessive return
    Given the Remaining Returnable Quantity is 2
    When the user enters a Return Quantity of 3
    Then the system shall reject the transaction
```

## 11.5 Reports

```gherkin
Feature: Inventory reports

  Scenario: View Stock Card
    Given Completed inventory transactions exist
    When the user selects a Device Detail and Date Range
    Then the system shall show chronological stock movements
    And calculate the Running Balance

  Scenario: Export report
    Given the user has opened a report
    When the user selects Export to Excel
    Then the generated file shall match the selected filters
```

---

# 12. Application Menu

## Master

- Model
- Service Tag
- Device
- Device Detail
- Customer
- Rack

## Transaction

- Stock Adjustment In
- Stock Release
- Stock Return

## Report

- Stock Card Report
- Stock Card Report by Customer
- Stock-In Report
- Stock-In Report by Customer
- Stock-Out Report
- Stock-Out Report by Customer
