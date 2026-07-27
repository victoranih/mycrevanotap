ALTER TABLE applications
DROP CONSTRAINT IF EXISTS applications_sector_check;

ALTER TABLE applications
ADD CONSTRAINT applications_sector_check CHECK (
  sector IN (
    'ICT',
    'Manufacturing',
    'Hotel Mgt',
    'Construction',
    'Consultancy Service',
    'Services',
    'Franchise',
    'Agriculture',
    'Technical Know-How',
    'Annual Technical Spport',
    'Trademark',
    'Technical Service',
    'Software Reseller',
    'Software License',
    'Oil & Gas',
    'Finance',
    'Management Service',
    'Mining',
    'Aviation'
  )
);
