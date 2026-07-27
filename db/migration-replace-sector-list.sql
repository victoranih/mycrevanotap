ALTER TABLE applications
DROP CONSTRAINT IF EXISTS applications_sector_check;

ALTER TABLE applications
DROP CONSTRAINT IF EXISTS applications_check;

UPDATE applications
SET sector = CASE
  WHEN sector = 'Hotel Mgt' THEN 'Hotels & Restaurants'
  WHEN sector = 'Agriculture' THEN 'Agriculture/Forestry'
  WHEN sector = 'Construction' THEN 'Civil Construction'
  WHEN sector = 'Franchise' THEN 'Franchising'
  WHEN sector = 'Finance' THEN 'Finance & Insurance'
  WHEN sector = 'Mining' THEN 'Mining & Quarry'
  ELSE sector
END;

UPDATE applications
SET sector = 'ICT'
WHERE sector NOT IN (
  'ICT',
  'Manufacturing',
  'Finance & Insurance',
  'Hotels & Restaurants',
  'Oil & Gas',
  'Agriculture/Forestry',
  'Civil Construction',
  'Transport & Logistics',
  'Franchising',
  'Power & Energy',
  'Mining & Quarry',
  'Gaming',
  'Aviation'
);

UPDATE applications
SET duration_years = 3
WHERE sector NOT IN ('Hotels & Restaurants', 'Agriculture/Forestry')
  AND duration_years > 3;

ALTER TABLE applications
ADD CONSTRAINT applications_sector_check CHECK (
  sector IN (
    'ICT',
    'Manufacturing',
    'Finance & Insurance',
    'Hotels & Restaurants',
    'Oil & Gas',
    'Agriculture/Forestry',
    'Civil Construction',
    'Transport & Logistics',
    'Franchising',
    'Power & Energy',
    'Mining & Quarry',
    'Gaming',
    'Aviation'
  )
);

ALTER TABLE applications
ADD CONSTRAINT applications_duration_by_sector_check CHECK (
  (
    sector IN ('Hotels & Restaurants', 'Agriculture/Forestry')
    AND duration_years BETWEEN 1 AND 5
  )
  OR
  (
    sector NOT IN ('Hotels & Restaurants', 'Agriculture/Forestry')
    AND duration_years BETWEEN 1 AND 3
  )
);
