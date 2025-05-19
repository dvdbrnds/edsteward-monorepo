-- Create the regulation_updates table if it doesn't exist
CREATE TABLE IF NOT EXISTS regulation_updates (
  id SERIAL PRIMARY KEY,
  regulation_id INTEGER NOT NULL REFERENCES regulations(id) ON DELETE CASCADE,
  original_content TEXT NOT NULL,
  updated_content TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  summary TEXT,
  reason TEXT,
  rejection_reason TEXT,
  deferral_reason TEXT,
  reviewer_id INTEGER,
  reviewed_at TIMESTAMP,
  signature_data TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create a test update using content from the files
-- This will select a random regulation from the database
WITH random_regulation AS (
  SELECT id, name 
  FROM regulations 
  WHERE regulation_text IS NOT NULL 
  ORDER BY RANDOM() 
  LIMIT 1
)
INSERT INTO regulation_updates (
  regulation_id,
  original_content,
  updated_content,
  status,
  summary,
  created_at,
  updated_at
)
SELECT 
  r.id,
  $$# Title IX Compliance Requirements

## Purpose
This document outlines the requirements for compliance with Title IX of the Education Amendments of 1972, which prohibits discrimination on the basis of sex in education programs and activities that receive federal financial assistance.

## Scope
These requirements apply to all educational institutions receiving federal funding, including colleges, universities, and K-12 schools.

## General Requirements

1. Each institution must designate at least one employee as the Title IX Coordinator to oversee compliance efforts and investigate any complaints of sex discrimination.

2. Institutions must adopt and publish grievance procedures that provide for the prompt and equitable resolution of student and employee complaints alleging sex discrimination.

3. Institutions must notify all students, employees, applicants for admission and employment, and unions or professional organizations holding collective bargaining agreements with the institution that:
   a. The institution does not discriminate on the basis of sex in its education programs and activities
   b. Questions regarding Title IX may be referred to the institution's Title IX Coordinator or to the Office for Civil Rights

4. Educational materials and curriculum content must not discriminate on the basis of sex.

5. Institutions must provide equitable athletic opportunities for members of both sexes.

## Reporting Requirements

1. Annual submission of the Civil Rights Data Collection (CRDC) survey to the Department of Education.

2. Maintenance of records documenting Title IX compliance for a minimum of three years.

3. Documentation of all Title IX complaints, investigations, and resolutions.

## Enforcement

1. The Office for Civil Rights (OCR) at the U.S. Department of Education is responsible for enforcing Title IX.

2. Institutions found to be in violation of Title IX may face:
   a. Loss of federal funding
   b. Debarment from federal programs
   c. Referral to the Department of Justice for further action

## Effective Date
This regulation is effective as of July 1, 2020.$$,
  $$# Title IX Compliance Requirements (2023 Updates)

## Purpose
This document outlines the updated requirements for compliance with Title IX of the Education Amendments of 1972, which prohibits discrimination on the basis of sex in education programs and activities that receive federal financial assistance. The 2023 amendments strengthen protections for LGBTQ+ students and update reporting procedures.

## Scope
These requirements apply to all educational institutions receiving federal funding, including colleges, universities, K-12 schools, and online education providers.

## General Requirements

1. Each institution must designate at least one employee as the Title IX Coordinator to oversee compliance efforts and investigate any complaints of sex discrimination. The Title IX Coordinator must receive comprehensive training annually.

2. Institutions must adopt and publish grievance procedures that provide for the prompt and equitable resolution of student and employee complaints alleging sex discrimination, with a clear timeline for resolution not exceeding 60 calendar days.

3. Institutions must notify all students, employees, applicants for admission and employment, and unions or professional organizations holding collective bargaining agreements with the institution that:
   a. The institution does not discriminate on the basis of sex in its education programs and activities
   b. Questions regarding Title IX may be referred to the institution's Title IX Coordinator or to the Office for Civil Rights
   c. The notification must be available in multiple languages and accessible formats

4. Educational materials and curriculum content must not discriminate on the basis of sex or gender identity.

5. Institutions must provide equitable athletic opportunities for members of all genders and maintain detailed participation records.

6. Digital learning environments and online courses must adhere to the same Title IX requirements as in-person instruction.

## Reporting Requirements

1. Annual submission of the Civil Rights Data Collection (CRDC) survey to the Department of Education with expanded demographic reporting.

2. Maintenance of records documenting Title IX compliance for a minimum of five years (increased from three years).

3. Documentation of all Title IX complaints, investigations, and resolutions through a secure digital records management system.

4. Annual campus climate surveys to assess the prevalence of sex discrimination and the effectiveness of prevention programs.

## Enforcement

1. The Office for Civil Rights (OCR) at the U.S. Department of Education is responsible for enforcing Title IX.

2. Institutions found to be in violation of Title IX may face:
   a. Loss of federal funding
   b. Debarment from federal programs
   c. Referral to the Department of Justice for further action
   d. Mandatory compliance training programs and monitoring

## Supporting Resources

1. Institutions must provide access to confidential support services for those affected by sex discrimination.

2. Institutions must implement evidence-based prevention programs focused on bystander intervention and consent education.

## Effective Date
This updated regulation is effective as of October 1, 2023.$$,
  'pending',
  'Title IX compliance updates for 2023 amendments',
  NOW(),
  NOW()
FROM random_regulation r
RETURNING id;