-- Add xlsx to feed_format_enum so suppliers with Excel feeds can be saved
ALTER TYPE feed_format_enum ADD VALUE IF NOT EXISTS 'xlsx';
