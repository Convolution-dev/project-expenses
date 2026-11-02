# Context: Project Expenses

Shared glossary for the project-expenses domain. Definitions only — no implementation.

## Glossary

### User
An authentication identity (managed by Convex Auth). Can log in and perform actions. Sign-up is closed: Users are created by hand (`npx convex run users:create`).

### Participant
A User who has been added to a Project as a financial actor — owes money or is owed money within that Project's settlement.

Being a Participant does not gate access: every User sees and edits every Project. Participation only decides who can be a Payer, Recipient or Beneficiary.

In v1, Participant and User are strictly 1:1: every Participant is a logged-in User, and there are no "ghost" Participants (financial actors who cannot log in). A User becomes a Participant only by being added to a specific Project (any User may add one); a User is not automatically a Participant of every Project.

A Participant cannot be removed from a Project while they have a nonzero Balance or appear in any item that is not yet squared — removal is allowed only once they are settled up, to avoid orphaned debt.

### Project
A container that groups Participants, Expenses, Incomes, and Settlements. All money math is scoped to a single Project — there is no cross-project balance. Each Project holds one or more currencies (ARS, USD). Every Expense, Income and Settlement is recorded in one of them. Amounts are never converted: totals and Balances are kept per currency. FX conversion is out of scope.

Any User may edit a Project (name, currencies, default Split Rule) or delete it. A currency can only be dropped while no item uses it. Deleting a Project removes everything in it and cannot be undone.

### Expense
A cost incurred within a Project. Has exactly one Payer, a set of Beneficiaries, an amount, and a split rule. May carry one or more optional attached bills (PDF/image).

### Payer
The single Participant who fronted the money for an Expense. Exactly one per Expense. The other Beneficiaries owe their share back to the Payer. The Payer is a Beneficiary by default but can be excluded from the Beneficiary set (paid for a cost they don't share).

### Income
Money entering a Project from outside (e.g. a client payment, a shared-kitty deposit). The mirror image of an Expense: has exactly one Recipient, a set of Beneficiaries, an amount, and a split rule. Carries a title, a description, and one or more optional attached documents (PDF/image). Flips the sign of an Expense in settlement.

An Income is money from *outside* the group, not a transfer *between* Participants. A Participant paying another back is a Settlement, not an Income, and must not be recorded as one.

### Recipient
The single Participant who received the external money of an Income (e.g. it landed in their account). Exactly one per Income. Because they hold money that belongs to the group, the Recipient owes each other Beneficiary their credited share — the inverse of how a Payer is owed.

### Beneficiary
A Participant who shares in an Expense or an Income. For an Expense, a Beneficiary owes their slice of the cost. For an Income, a Beneficiary is credited their slice of the money. The Beneficiary set is configurable per Expense and per Income.

The Beneficiary set and Split Rule are *snapshotted onto the Expense/Income at creation time* — they are not derived live from current Project membership. Adding or removing a Participant changes only the default applied to future items; existing items keep their original split. (This is why the set lives on the item, not on the Project.)

### Split Rule
The policy that divides an Expense or Income amount among its Beneficiaries. Two modes in v1:
- **Equal** — divide evenly among Beneficiaries (the default).
- **Weighted shares** — each Beneficiary holds a share count; the amount is divided in proportion (percentages are shares summing to 100).

Each Project has a default Split Rule (equal across all current Participants). Every Expense and Income inherits the Project default but may override both the Beneficiary set and the Split Rule. Exact-amount splits are out of scope for v1.

Division uses the largest-remainder method: floor each share to the cent, then distribute leftover cents one at a time in a stable Participant order, so the parts always sum exactly to the total.

### Settlement
A recorded transfer of money from one Participant to another to clear debt within a Project — e.g. "Bob paid Ana $40." May be full or partial against what is owed. A Settlement is one of the three core record types (alongside Expense and Income); it is the actual payment, not a computed snapshot. Nothing is frozen by recording a Settlement. Like Expenses and Incomes, a Settlement is tagged to a Period and may carry one or more optional attachments (e.g. proof of transfer).

### Balance
The live, computed net of who owes whom within a Project, scoped to a Period. Derived on demand from that Period's Expenses, Incomes, and Settlements — never stored. Clicking the Settle button computes the Balance for the selected month and shows the suggested transfers needed to bring it to zero. Suggested transfers use the **minimal set** that zeroes everyone's net position (fewest debtor→creditor payments), each accompanied by a plain-text explanation of why it is owed. A Period is "done" when its Balance is zero (everyone is square).

Balances are computed per month and per currency; there is no netting across Periods or across currencies.

### Period
The calendar month an Expense, Income, or Settlement belongs to, stored as a field on each record. Periods do not open or close — they are purely a grouping and reporting dimension. Records remain freely editable; nothing is ever frozen.

### Registrar
The User who recorded an Expense (or Income) in the app; they need not be a Participant. An audit field only — does not affect settlement math. Any User may register an Expense or Income on behalf of any Payer or Recipient.
