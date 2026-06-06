# Broker API Documents

Place official broker API manuals, endpoint tables, TR mappings, field specs, and
master-file format documents under each broker directory before implementing
live adapter calls.

Adapters must not invent endpoint paths, TR IDs, or field names. If mapping is
missing, return `not_configured`.
