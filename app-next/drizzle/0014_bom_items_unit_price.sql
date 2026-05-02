-- Change BOM Items from wastage_percent to unit_price for price-based calculations
ALTER TABLE bom_items 
RENAME COLUMN wastage_percent TO unit_price;

-- Update any existing data (convert percentage values to default price values)
UPDATE bom_items 
SET unit_price = '0'::numeric 
WHERE unit_price IS NOT NULL;
