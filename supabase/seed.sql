-- ============================================================================
-- seed.sql — JeniMcRich Recruitment ATS demo data
--
-- Mirrors the prototype's seedData() (heavy industry: cement / aggregates /
-- mining / steel) and adds US requisitions with TN-visa constraints.
-- Intended for fresh local databases: `pnpm dlx supabase db reset` runs it
-- after migrations. Inserts are keyed with fixed UUIDs and use ON CONFLICT
-- DO NOTHING so a re-run will not duplicate keyed rows.
--
-- Runs as the postgres owner: RLS is bypassed, triggers still fire — the
-- applications insert trigger writes "Application received via …" activity
-- automatically; "Moved to …" rows are inserted manually below.
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- Staff profiles (user_id NULL until each person first signs in — the
-- on_auth_user_created trigger links auth.users to these rows by email)
-- ----------------------------------------------------------------------------

insert into public.profiles (id, user_id, email, full_name, role) values
  ('aaaaaaaa-0000-4000-a000-000000000001', null, 'jenny@jenimcrich.com',        'Jenny McRich',  'admin'),
  ('aaaaaaaa-0000-4000-a000-000000000002', null, 'ramon.santos@jenimcrich.com', 'Ramon Santos',  'recruiter'),
  ('aaaaaaaa-0000-4000-a000-000000000003', null, 'mark.delgado@helixcement.com','Mark Delgado',  'hiring_manager')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Clients
-- ----------------------------------------------------------------------------

insert into public.clients (id, name, contact_name, contact_email, notes) values
  ('bbbbbbbb-0000-4000-a000-000000000001', 'Helix Cement Corp',        'Mark Delgado',   'mark.delgado@helixcement.com',   'Integrated 2.5 MTPA line in Cebu plus a grinding station. Fee: 18% of first-year base.'),
  ('bbbbbbbb-0000-4000-a000-000000000002', 'Stonebridge Aggregates',   'Liza Onglao',    'l.onglao@stonebridgeagg.com',    'Three quarries in Rizal; volume hiring for supervisors and dispatch.'),
  ('bbbbbbbb-0000-4000-a000-000000000003', 'Orion Mining Group',       'Teodoro Ramos',  't.ramos@orionmining.com',        'Nickel and copper operations in Davao and Surigao. Safety-first culture; slow approvals.'),
  ('bbbbbbbb-0000-4000-a000-000000000004', 'Lonestar Cement USA',      'Dale Whitfield', 'dale.whitfield@lonestarcement.com', 'Texas panhandle plant. Hires Canadians on TN-1 only — see visa notes on each requisition.'),
  ('bbbbbbbb-0000-4000-a000-000000000005', 'Redrock Copper Mining',    'Susan Ortega',   's.ortega@redrockcopper.com',     'Open-pit copper, Tucson AZ. Accepts TN candidates (Canadian or Mexican) for engineer-class roles.'),
  ('bbbbbbbb-0000-4000-a000-000000000006', 'Great Lakes Steel Works',  'Frank Kowalski', 'f.kowalski@glsteelworks.com',    'EAF mini-mill, Gary IN. Defense-adjacent contracts; strict work-authorization rules.')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Jobs (j1–j6 from the prototype, PH/local; j7–j9 US roles with visa rules)
-- ----------------------------------------------------------------------------

insert into public.jobs
  (id, client_id, title, location, salary_range, min_years, description, status, visa, visa_notes, jd_text, opened_at)
values
  ('cccccccc-0000-4000-a000-000000000001', 'bbbbbbbb-0000-4000-a000-000000000001',
   'Plant Manager – Cement', 'Cebu, PH', '₱180k–240k/mo', 10,
   'Lead full plant P&L for a 2.5 MTPA cement line.',
   'open', 'LOCAL', null,
   E'Plant Manager – Cement\nHelix Cement Corp — Cebu, PH\n\nRequirements:\n- 10+ yrs cement plant operations\n- Kiln & pyro-processing expertise\n- ISO 45001 safety leadership\n- Managed 100+ headcount',
   now() - interval '40 days'),

  ('cccccccc-0000-4000-a000-000000000002', 'bbbbbbbb-0000-4000-a000-000000000002',
   'Quarry Supervisor – Aggregates', 'Rizal, PH', '₱90k–120k/mo', 6,
   'Supervise drilling, blasting and crushing operations.',
   'open', 'LOCAL', null,
   E'Quarry Supervisor – Aggregates\nStonebridge Aggregates — Rizal, PH\n\nRequirements:\n- 6+ yrs quarry supervision\n- Licensed blaster preferred\n- DENR/MGB compliance\n- Fleet & crusher scheduling',
   now() - interval '40 days'),

  ('cccccccc-0000-4000-a000-000000000003', 'bbbbbbbb-0000-4000-a000-000000000003',
   'Maintenance Reliability Engineer', 'Davao, PH', '₱110k–150k/mo', 5,
   'Own asset reliability strategy for fixed & mobile plant.',
   'open', 'LOCAL', null,
   E'Maintenance Reliability Engineer\nOrion Mining Group — Davao, PH\n\nRequirements:\n- 5+ yrs reliability in mining/heavy industry\n- CMRP preferred\n- Predictive maintenance program ownership\n- SAP PM proficiency',
   now() - interval '40 days'),

  ('cccccccc-0000-4000-a000-000000000004', 'bbbbbbbb-0000-4000-a000-000000000003',
   'HSE Manager – Mining', 'Surigao, PH', '₱140k–180k/mo', 8,
   'Drive site-wide HSE strategy across two mine sites.',
   'open', 'LOCAL', null,
   E'HSE Manager – Mining\nOrion Mining Group — Surigao, PH\n\nRequirements:\n- 8+ yrs HSE in mining\n- ISO 45001 lead auditor\n- Fatality-prevention programs\n- Regulatory liaison (DENR, DOLE)',
   now() - interval '40 days'),

  ('cccccccc-0000-4000-a000-000000000005', 'bbbbbbbb-0000-4000-a000-000000000001',
   'Electrical Engineer – Plant', 'Cebu, PH', '₱80k–110k/mo', 4,
   'Maintain and improve plant electrical systems.',
   'open', 'LOCAL', null,
   E'Electrical Engineer – Plant\nHelix Cement Corp — Cebu, PH\n\nRequirements:\n- 4+ yrs plant electrical\n- PLC/SCADA exposure\n- MV/LV distribution\n- PEE/REE license',
   now() - interval '40 days'),

  ('cccccccc-0000-4000-a000-000000000006', 'bbbbbbbb-0000-4000-a000-000000000002',
   'Logistics Coordinator', 'Rizal, PH', '₱45k–60k/mo', 3,
   'Coordinate outbound aggregate dispatch & fleet.',
   'on_hold', 'LOCAL', null,
   E'Logistics Coordinator\nStonebridge Aggregates — Rizal, PH\n\nRequirements:\n- 3+ yrs logistics/dispatch\n- Truck fleet coordination\n- ERP literacy\n- Strong Excel',
   now() - interval '25 days'),

  ('cccccccc-0000-4000-a000-000000000007', 'bbbbbbbb-0000-4000-a000-000000000004',
   'Process Engineer – Cement (US)', 'Amarillo, TX, USA', '$95k–115k/yr', 5,
   'Optimize kiln and mill performance for a 1.8 MTPA dry-process line.',
   'open', 'TN_CANADIAN_ONLY',
   'Client processes TN-1 at the border for Canadian citizens only. No H-1B or green card sponsorship. Engineering degree required for the TN petition.',
   E'Process Engineer – Cement\nLonestar Cement USA — Amarillo, TX\n\nRequirements:\n- 5+ yrs cement process engineering\n- Pyro-processing and mill optimization\n- TN visa: Canadian citizens only — no sponsorship\n- Bachelor of Engineering required',
   now() - interval '18 days'),

  ('cccccccc-0000-4000-a000-000000000008', 'bbbbbbbb-0000-4000-a000-000000000005',
   'Mine Maintenance Superintendent (US)', 'Tucson, AZ, USA', '$130k–155k/yr', 8,
   'Lead fixed and mobile maintenance for an open-pit copper operation.',
   'open', 'TN_CANADIAN_OR_MEXICAN',
   'TN eligible (Engineer category) for Canadian or Mexican citizens; engineering degree required for the TN petition. Relocation support provided.',
   E'Mine Maintenance Superintendent\nRedrock Copper Mining — Tucson, AZ\n\nRequirements:\n- 8+ yrs maintenance leadership in mining\n- Haul truck and shovel fleet experience\n- SAP PM\n- TN visa: Canadian or Mexican citizens eligible',
   now() - interval '14 days'),

  ('cccccccc-0000-4000-a000-000000000009', 'bbbbbbbb-0000-4000-a000-000000000006',
   'Melt Shop Manager – Steel', 'Gary, IN, USA', '$140k–170k/yr', 10,
   'Run EAF melt shop operations: two furnaces, caster, 180 headcount.',
   'open', 'US_CITIZEN_GC_ONLY',
   'Defense-adjacent contracts: US citizens or green card holders only. No visa sponsorship of any kind.',
   E'Melt Shop Manager – Steel\nGreat Lakes Steel Works — Gary, IN\n\nRequirements:\n- 10+ yrs EAF steelmaking\n- Continuous casting oversight\n- Union workforce leadership\n- US citizens or green card holders only',
   now() - interval '12 days')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Job skills (weight 1–3, feeds the match-scoring engine)
-- ----------------------------------------------------------------------------

insert into public.job_skills (job_id, skill, weight) values
  ('cccccccc-0000-4000-a000-000000000001', 'Plant Operations', 3),
  ('cccccccc-0000-4000-a000-000000000001', 'Kiln Management', 3),
  ('cccccccc-0000-4000-a000-000000000001', 'Safety Compliance', 2),
  ('cccccccc-0000-4000-a000-000000000001', 'Team Leadership', 2),
  ('cccccccc-0000-4000-a000-000000000001', 'Budgeting', 1),

  ('cccccccc-0000-4000-a000-000000000002', 'Quarry Operations', 3),
  ('cccccccc-0000-4000-a000-000000000002', 'Blasting', 3),
  ('cccccccc-0000-4000-a000-000000000002', 'Heavy Equipment', 2),
  ('cccccccc-0000-4000-a000-000000000002', 'Safety Compliance', 2),
  ('cccccccc-0000-4000-a000-000000000002', 'Production Planning', 1),

  ('cccccccc-0000-4000-a000-000000000003', 'Reliability Engineering', 3),
  ('cccccccc-0000-4000-a000-000000000003', 'Predictive Maintenance', 3),
  ('cccccccc-0000-4000-a000-000000000003', 'SAP PM', 2),
  ('cccccccc-0000-4000-a000-000000000003', 'Root Cause Analysis', 2),
  ('cccccccc-0000-4000-a000-000000000003', 'Vibration Analysis', 2),

  ('cccccccc-0000-4000-a000-000000000004', 'Safety Compliance', 3),
  ('cccccccc-0000-4000-a000-000000000004', 'HSE Management', 3),
  ('cccccccc-0000-4000-a000-000000000004', 'Incident Investigation', 2),
  ('cccccccc-0000-4000-a000-000000000004', 'Training', 2),
  ('cccccccc-0000-4000-a000-000000000004', 'Audit', 1),

  ('cccccccc-0000-4000-a000-000000000005', 'Electrical Systems', 3),
  ('cccccccc-0000-4000-a000-000000000005', 'PLC Programming', 2),
  ('cccccccc-0000-4000-a000-000000000005', 'Motor Control', 2),
  ('cccccccc-0000-4000-a000-000000000005', 'Power Distribution', 2),
  ('cccccccc-0000-4000-a000-000000000005', 'Safety Compliance', 1),

  ('cccccccc-0000-4000-a000-000000000006', 'Logistics', 3),
  ('cccccccc-0000-4000-a000-000000000006', 'Dispatch', 2),
  ('cccccccc-0000-4000-a000-000000000006', 'ERP Systems', 2),
  ('cccccccc-0000-4000-a000-000000000006', 'Vendor Management', 1),
  ('cccccccc-0000-4000-a000-000000000006', 'Excel', 1),

  ('cccccccc-0000-4000-a000-000000000007', 'Pyro Processing', 3),
  ('cccccccc-0000-4000-a000-000000000007', 'Process Optimization', 3),
  ('cccccccc-0000-4000-a000-000000000007', 'Kiln Management', 2),
  ('cccccccc-0000-4000-a000-000000000007', 'Safety Compliance', 1),

  ('cccccccc-0000-4000-a000-000000000008', 'Maintenance Management', 3),
  ('cccccccc-0000-4000-a000-000000000008', 'Reliability Engineering', 2),
  ('cccccccc-0000-4000-a000-000000000008', 'Heavy Equipment', 2),
  ('cccccccc-0000-4000-a000-000000000008', 'SAP PM', 2),
  ('cccccccc-0000-4000-a000-000000000008', 'Budgeting', 1),

  ('cccccccc-0000-4000-a000-000000000009', 'EAF Operations', 3),
  ('cccccccc-0000-4000-a000-000000000009', 'Continuous Casting', 2),
  ('cccccccc-0000-4000-a000-000000000009', 'Team Leadership', 2),
  ('cccccccc-0000-4000-a000-000000000009', 'Safety Compliance', 2),
  ('cccccccc-0000-4000-a000-000000000009', 'Budgeting', 1)
on conflict (job_id, skill) do nothing;

-- ----------------------------------------------------------------------------
-- Job notes (hiring manager voice)
-- ----------------------------------------------------------------------------

insert into public.job_notes (job_id, author_id, body, created_at) values
  ('cccccccc-0000-4000-a000-000000000001', 'aaaaaaaa-0000-4000-a000-000000000003',
   'Kiln downtime is our #1 KPI this year — prioritize candidates with hands-on pyro-processing leadership, not just grinding-side experience.',
   now() - interval '21 days'),
  ('cccccccc-0000-4000-a000-000000000007', 'aaaaaaaa-0000-4000-a000-000000000001',
   'Reminder from client call: TN-1 means Canadian citizens ONLY for this req. Screen citizenship before submitting anyone.',
   now() - interval '10 days');

-- ----------------------------------------------------------------------------
-- Candidates (c1–c18 from the prototype + c19/c20 for the US TN roles)
-- ----------------------------------------------------------------------------

insert into public.candidates
  (id, full_name, email, phone, source, years_exp, summary, expected_salary, notice_period, resume_text, flagged, created_at)
values
  ('dddddddd-0000-4000-a000-000000000001', 'Alex Miller', 'alex.miller@gmail.com', '+63 917 555 0101', 'linkedin', 14,
   'Seasoned cement plant leader; ran a 3 MTPA integrated line with 220 staff and cut kiln downtime 18%.',
   '₱220,000/mo', '60 days',
   'Seasoned cement plant leader; ran a 3 MTPA integrated line with 220 staff and cut kiln downtime 18%. Skills: Plant Operations, Kiln Management, Safety Compliance, Team Leadership, Budgeting. Certifications: ISO 45001 Lead Auditor, Six Sigma Black Belt.',
   true, now() - interval '20 days'),

  ('dddddddd-0000-4000-a000-000000000002', 'Sarah Jenkins', 'sarah.jenkins@gmail.com', '+63 917 555 0102', 'referral', 8,
   'Reliability engineer who built a predictive maintenance program reducing unplanned downtime 31% at a nickel mine.',
   '₱135,000/mo', '30 days',
   'Reliability engineer who built a predictive maintenance program reducing unplanned downtime 31% at a nickel mine. Skills: Reliability Engineering, Predictive Maintenance, SAP PM, Root Cause Analysis, Vibration Analysis. Certifications: CMRP, ISO 18436 Cat II Vibration.',
   true, now() - interval '30 days'),

  ('dddddddd-0000-4000-a000-000000000003', 'Marcus Thompson', 'marcus.thompson@gmail.com', '+63 917 555 0103', 'job_portal', 7,
   'Quarry supervisor with full drill-blast-crush cycle ownership; improved crusher utilization to 87%.',
   '₱105,000/mo', '30 days',
   'Quarry supervisor with full drill-blast-crush cycle ownership; improved crusher utilization to 87%. Skills: Quarry Operations, Blasting, Heavy Equipment, Safety Compliance, Production Planning. Certifications: Licensed Blaster (PNP-FED), NCII Heavy Equipment.',
   false, now() - interval '24 days'),

  ('dddddddd-0000-4000-a000-000000000004', 'Diana Reyes', 'diana.reyes@gmail.com', '+63 917 555 0104', 'linkedin', 11,
   'HSE leader across 3 mine sites; led a 4-year LTI-free program and DENR audit readiness.',
   '₱165,000/mo', '45 days',
   'HSE leader across 3 mine sites; led a 4-year LTI-free program and DENR audit readiness. Skills: Safety Compliance, HSE Management, Incident Investigation, Training, Audit. Certifications: ISO 45001 Lead Auditor, NEBOSH IGC.',
   false, now() - interval '22 days'),

  ('dddddddd-0000-4000-a000-000000000005', 'James Uy', 'james.uy@gmail.com', '+63 917 555 0105', 'indeed', 5,
   'Plant electrical engineer; led MV switchgear upgrade and PLC migration to S7-1500.',
   '₱95,000/mo', '30 days',
   'Plant electrical engineer; led MV switchgear upgrade and PLC migration to S7-1500. Skills: Electrical Systems, PLC Programming, Motor Control, Power Distribution. Certifications: REE License.',
   false, now() - interval '2 days'),

  ('dddddddd-0000-4000-a000-000000000006', 'Maria Santos', 'maria.santos@gmail.com', '+63 917 555 0106', 'referral', 9,
   'Production manager in cement grinding; strong cost control, limited kiln exposure.',
   '₱170,000/mo', '60 days',
   'Production manager in cement grinding; strong cost control, limited kiln exposure. Skills: Plant Operations, Safety Compliance, Team Leadership, Budgeting. Certifications: Six Sigma Green Belt.',
   false, now() - interval '26 days'),

  ('dddddddd-0000-4000-a000-000000000007', 'Robert Lim', 'robert.lim@gmail.com', '+63 917 555 0107', 'linkedin', 4,
   'Condition-monitoring analyst moving into reliability engineering; strong vibration analysis.',
   '₱90,000/mo', '15 days',
   'Condition-monitoring analyst moving into reliability engineering; strong vibration analysis. Skills: Predictive Maintenance, Vibration Analysis, Root Cause Analysis. Certifications: ISO 18436 Cat I.',
   false, now() - interval '1 day'),

  ('dddddddd-0000-4000-a000-000000000008', 'Angela Cruz', 'angela.cruz@gmail.com', '+63 917 555 0108', 'job_portal', 6,
   'Dispatch lead for a 60-truck aggregates fleet; cut idle time 22% with route scheduling.',
   '₱55,000/mo', '30 days',
   'Dispatch lead for a 60-truck aggregates fleet; cut idle time 22% with route scheduling. Skills: Logistics, Dispatch, ERP Systems, Excel, Vendor Management. Certifications: CLTD.',
   false, now() - interval '25 days'),

  ('dddddddd-0000-4000-a000-000000000009', 'Kevin Tan', 'kevin.tan@gmail.com', '+63 917 555 0109', 'indeed', 3,
   'Heavy equipment operator stepping up to supervision; limited blasting exposure.',
   '₱70,000/mo', '15 days',
   'Heavy equipment operator stepping up to supervision; limited blasting exposure. Skills: Heavy Equipment, Quarry Operations. Certifications: NCII Heavy Equipment.',
   false, now() - interval '12 days'),

  ('dddddddd-0000-4000-a000-000000000010', 'Patricia Gomez', 'patricia.gomez@gmail.com', '+63 917 555 0110', 'agency', 8,
   'HSE superintendent in construction transitioning to mining; strong training systems.',
   '₱150,000/mo', '30 days',
   'HSE superintendent in construction transitioning to mining; strong training systems. Skills: HSE Management, Safety Compliance, Training, Audit. Certifications: NEBOSH IGC, OSHA 30.',
   false, now() - interval '19 days'),

  ('dddddddd-0000-4000-a000-000000000011', 'Daniel Ocampo', 'daniel.ocampo@gmail.com', '+63 917 555 0111', 'job_portal', 6,
   'Operations supervisor in food manufacturing; no heavy-industry exposure.',
   '₱140,000/mo', '30 days',
   'Operations supervisor in food manufacturing; no heavy-industry exposure. Skills: Plant Operations, Budgeting.',
   false, now() - interval '20 days'),

  ('dddddddd-0000-4000-a000-000000000012', 'Grace Villanueva', 'grace.villanueva@gmail.com', '+63 917 555 0112', 'referral', 6,
   'Senior plant electrician turned engineer; SCADA and MV distribution strength.',
   '₱105,000/mo', '30 days',
   'Senior plant electrician turned engineer; SCADA and MV distribution strength. Skills: Electrical Systems, PLC Programming, Motor Control, Power Distribution, Safety Compliance. Certifications: PEE License.',
   false, now() - interval '16 days'),

  ('dddddddd-0000-4000-a000-000000000013', 'Carlo Mendoza', 'carlo.mendoza@gmail.com', '+63 917 555 0113', 'linkedin', 7,
   'Maintenance planner with strong SAP PM mastery; building PdM exposure.',
   '₱120,000/mo', '45 days',
   'Maintenance planner with strong SAP PM mastery; building PdM exposure. Skills: Reliability Engineering, SAP PM, Root Cause Analysis, Predictive Maintenance. Certifications: CMRP (in progress).',
   false, now() - interval '28 days'),

  ('dddddddd-0000-4000-a000-000000000014', 'Liza Fernandez', 'liza.fernandez@gmail.com', '+63 917 555 0114', 'job_portal', 4,
   'Logistics analyst with SAP MM background; no dispatch floor experience.',
   '₱48,000/mo', '30 days',
   'Logistics analyst with SAP MM background; no dispatch floor experience. Skills: Logistics, ERP Systems, Excel.',
   false, now() - interval '3 days'),

  ('dddddddd-0000-4000-a000-000000000015', 'Miguel Bautista', 'miguel.bautista@gmail.com', '+63 917 555 0115', 'referral', 9,
   'Veteran quarry supervisor; ran 3 quarry pits concurrently with zero LTI over 5 years.',
   '₱118,000/mo', '60 days',
   'Veteran quarry supervisor; ran 3 quarry pits concurrently with zero LTI over 5 years. Skills: Quarry Operations, Blasting, Heavy Equipment, Safety Compliance, Production Planning. Certifications: Licensed Blaster (PNP-FED), OSHA 30.',
   true, now() - interval '17 days'),

  ('dddddddd-0000-4000-a000-000000000016', 'Hannah Dizon', 'hannah.dizon@gmail.com', '+63 917 555 0116', 'linkedin', 5,
   'Safety officer in manufacturing; growing into HSE management.',
   '₱100,000/mo', '30 days',
   'Safety officer in manufacturing; growing into HSE management. Skills: Safety Compliance, Training, Incident Investigation. Certifications: OSHA 30.',
   false, now() - interval '6 days'),

  ('dddddddd-0000-4000-a000-000000000017', 'Paolo Ramos', 'paolo.ramos@gmail.com', '+63 917 555 0117', 'indeed', 4,
   'Facilities electrical engineer; commercial buildings background.',
   '₱85,000/mo', '30 days',
   'Facilities electrical engineer; commercial buildings background. Skills: Electrical Systems, Power Distribution, PLC Programming. Certifications: REE License.',
   false, now() - interval '29 days'),

  ('dddddddd-0000-4000-a000-000000000018', 'Nicole Aquino', 'nicole.aquino@gmail.com', '+63 917 555 0118', 'agency', 12,
   'Deputy plant manager at a competing cement producer; kiln and finance fluent.',
   '₱210,000/mo', '90 days',
   'Deputy plant manager at a competing cement producer; kiln and finance fluent. Skills: Plant Operations, Kiln Management, Team Leadership, Safety Compliance, Budgeting. Certifications: Six Sigma Black Belt.',
   true, now() - interval '8 days'),

  ('dddddddd-0000-4000-a000-000000000019', 'Etienne Tremblay', 'etienne.tremblay@gmail.com', '+1 416 555 0119', 'linkedin', 7,
   'Canadian process engineer (P.Eng, Ontario); optimized two preheater kiln lines and cut specific heat consumption 6%. TN-1 eligible.',
   '$105,000/yr', '30 days',
   'Canadian process engineer (P.Eng, Ontario); optimized two preheater kiln lines and cut specific heat consumption 6%. TN-1 eligible. Skills: Pyro Processing, Process Optimization, Kiln Management, Safety Compliance. Certifications: P.Eng (Ontario).',
   false, now() - interval '9 days'),

  ('dddddddd-0000-4000-a000-000000000020', 'Carlos Hernandez', 'carlos.hernandez@gmail.com', '+52 55 5550 0120', 'referral', 10,
   'Mexican maintenance leader (Ing. Mecanico) from an open-pit copper mine; 120-asset mobile fleet under SAP PM. TN eligible.',
   '$140,000/yr', '45 days',
   'Mexican maintenance leader (Ing. Mecanico) from an open-pit copper mine; 120-asset mobile fleet under SAP PM. TN eligible. Skills: Maintenance Management, Reliability Engineering, Heavy Equipment, SAP PM, Budgeting. Certifications: CMRP.',
   false, now() - interval '2 days')
on conflict (id) do nothing;

-- candidates.location was added later (migration 0003) and isn't in the insert
-- column list above; backfill the seed people by name so fresh seeds match the
-- demo data (Philippines bases, plus the TN-visa Canadian/Mexican applicants).
update public.candidates set location = case full_name
    when 'Alex Miller'           then 'Cebu, PH'
    when 'Angela Cruz'           then 'Rizal, PH'
    when 'Carlo Mendoza'         then 'Davao, PH'
    when 'Carlos Hernandez'      then 'Mexico City, MX'
    when 'Daniel Ocampo'         then 'Manila, PH'
    when 'Diana Reyes'           then 'Surigao, PH'
    when 'Etienne Tremblay'      then 'Toronto, ON, Canada'
    when 'Grace Villanueva'      then 'Cebu, PH'
    when 'Hannah Dizon'          then 'Manila, PH'
    when 'James Uy'              then 'Cebu, PH'
    when 'Kevin Tan'             then 'Rizal, PH'
    when 'Liza Fernandez'        then 'Rizal, PH'
    when 'Marcus Thompson'       then 'Rizal, PH'
    when 'Maria Santos'          then 'Cebu, PH'
    when 'Miguel Bautista'       then 'Rizal, PH'
    when 'Nicole Aquino'         then 'Manila, PH'
    when 'Paolo Ramos'           then 'Cebu, PH'
    when 'Patricia Gomez'        then 'Manila, PH'
    when 'Robert Lim'            then 'Davao, PH'
    when 'Sarah Jenkins'         then 'Davao, PH'
  end
where location is null;

-- ----------------------------------------------------------------------------
-- Candidate skills (skill, years)
-- ----------------------------------------------------------------------------

insert into public.candidate_skills (candidate_id, skill, years) values
  ('dddddddd-0000-4000-a000-000000000001', 'Plant Operations', 14),
  ('dddddddd-0000-4000-a000-000000000001', 'Kiln Management', 11),
  ('dddddddd-0000-4000-a000-000000000001', 'Safety Compliance', 9),
  ('dddddddd-0000-4000-a000-000000000001', 'Team Leadership', 10),
  ('dddddddd-0000-4000-a000-000000000001', 'Budgeting', 6),

  ('dddddddd-0000-4000-a000-000000000002', 'Reliability Engineering', 8),
  ('dddddddd-0000-4000-a000-000000000002', 'Predictive Maintenance', 7),
  ('dddddddd-0000-4000-a000-000000000002', 'SAP PM', 5),
  ('dddddddd-0000-4000-a000-000000000002', 'Root Cause Analysis', 6),
  ('dddddddd-0000-4000-a000-000000000002', 'Vibration Analysis', 4),

  ('dddddddd-0000-4000-a000-000000000003', 'Quarry Operations', 7),
  ('dddddddd-0000-4000-a000-000000000003', 'Blasting', 5),
  ('dddddddd-0000-4000-a000-000000000003', 'Heavy Equipment', 6),
  ('dddddddd-0000-4000-a000-000000000003', 'Safety Compliance', 4),
  ('dddddddd-0000-4000-a000-000000000003', 'Production Planning', 3),

  ('dddddddd-0000-4000-a000-000000000004', 'Safety Compliance', 11),
  ('dddddddd-0000-4000-a000-000000000004', 'HSE Management', 9),
  ('dddddddd-0000-4000-a000-000000000004', 'Incident Investigation', 8),
  ('dddddddd-0000-4000-a000-000000000004', 'Training', 7),
  ('dddddddd-0000-4000-a000-000000000004', 'Audit', 6),

  ('dddddddd-0000-4000-a000-000000000005', 'Electrical Systems', 5),
  ('dddddddd-0000-4000-a000-000000000005', 'PLC Programming', 3),
  ('dddddddd-0000-4000-a000-000000000005', 'Motor Control', 4),
  ('dddddddd-0000-4000-a000-000000000005', 'Power Distribution', 3),

  ('dddddddd-0000-4000-a000-000000000006', 'Plant Operations', 9),
  ('dddddddd-0000-4000-a000-000000000006', 'Safety Compliance', 7),
  ('dddddddd-0000-4000-a000-000000000006', 'Team Leadership', 6),
  ('dddddddd-0000-4000-a000-000000000006', 'Budgeting', 5),

  ('dddddddd-0000-4000-a000-000000000007', 'Predictive Maintenance', 4),
  ('dddddddd-0000-4000-a000-000000000007', 'Vibration Analysis', 3),
  ('dddddddd-0000-4000-a000-000000000007', 'Root Cause Analysis', 3),

  ('dddddddd-0000-4000-a000-000000000008', 'Logistics', 6),
  ('dddddddd-0000-4000-a000-000000000008', 'Dispatch', 5),
  ('dddddddd-0000-4000-a000-000000000008', 'ERP Systems', 4),
  ('dddddddd-0000-4000-a000-000000000008', 'Excel', 6),
  ('dddddddd-0000-4000-a000-000000000008', 'Vendor Management', 3),

  ('dddddddd-0000-4000-a000-000000000009', 'Heavy Equipment', 3),
  ('dddddddd-0000-4000-a000-000000000009', 'Quarry Operations', 2),

  ('dddddddd-0000-4000-a000-000000000010', 'HSE Management', 8),
  ('dddddddd-0000-4000-a000-000000000010', 'Safety Compliance', 8),
  ('dddddddd-0000-4000-a000-000000000010', 'Training', 6),
  ('dddddddd-0000-4000-a000-000000000010', 'Audit', 4),

  ('dddddddd-0000-4000-a000-000000000011', 'Plant Operations', 6),
  ('dddddddd-0000-4000-a000-000000000011', 'Budgeting', 3),

  ('dddddddd-0000-4000-a000-000000000012', 'Electrical Systems', 6),
  ('dddddddd-0000-4000-a000-000000000012', 'PLC Programming', 5),
  ('dddddddd-0000-4000-a000-000000000012', 'Motor Control', 4),
  ('dddddddd-0000-4000-a000-000000000012', 'Power Distribution', 4),
  ('dddddddd-0000-4000-a000-000000000012', 'Safety Compliance', 3),

  ('dddddddd-0000-4000-a000-000000000013', 'Reliability Engineering', 6),
  ('dddddddd-0000-4000-a000-000000000013', 'SAP PM', 6),
  ('dddddddd-0000-4000-a000-000000000013', 'Root Cause Analysis', 5),
  ('dddddddd-0000-4000-a000-000000000013', 'Predictive Maintenance', 3),

  ('dddddddd-0000-4000-a000-000000000014', 'Logistics', 4),
  ('dddddddd-0000-4000-a000-000000000014', 'ERP Systems', 3),
  ('dddddddd-0000-4000-a000-000000000014', 'Excel', 5),

  ('dddddddd-0000-4000-a000-000000000015', 'Quarry Operations', 9),
  ('dddddddd-0000-4000-a000-000000000015', 'Blasting', 8),
  ('dddddddd-0000-4000-a000-000000000015', 'Heavy Equipment', 7),
  ('dddddddd-0000-4000-a000-000000000015', 'Safety Compliance', 6),
  ('dddddddd-0000-4000-a000-000000000015', 'Production Planning', 5),

  ('dddddddd-0000-4000-a000-000000000016', 'Safety Compliance', 5),
  ('dddddddd-0000-4000-a000-000000000016', 'Training', 4),
  ('dddddddd-0000-4000-a000-000000000016', 'Incident Investigation', 3),

  ('dddddddd-0000-4000-a000-000000000017', 'Electrical Systems', 4),
  ('dddddddd-0000-4000-a000-000000000017', 'Power Distribution', 3),
  ('dddddddd-0000-4000-a000-000000000017', 'PLC Programming', 2),

  ('dddddddd-0000-4000-a000-000000000018', 'Plant Operations', 12),
  ('dddddddd-0000-4000-a000-000000000018', 'Kiln Management', 8),
  ('dddddddd-0000-4000-a000-000000000018', 'Team Leadership', 9),
  ('dddddddd-0000-4000-a000-000000000018', 'Safety Compliance', 7),
  ('dddddddd-0000-4000-a000-000000000018', 'Budgeting', 8),

  ('dddddddd-0000-4000-a000-000000000019', 'Pyro Processing', 7),
  ('dddddddd-0000-4000-a000-000000000019', 'Process Optimization', 6),
  ('dddddddd-0000-4000-a000-000000000019', 'Kiln Management', 5),
  ('dddddddd-0000-4000-a000-000000000019', 'Safety Compliance', 4),

  ('dddddddd-0000-4000-a000-000000000020', 'Maintenance Management', 9),
  ('dddddddd-0000-4000-a000-000000000020', 'Reliability Engineering', 5),
  ('dddddddd-0000-4000-a000-000000000020', 'Heavy Equipment', 8),
  ('dddddddd-0000-4000-a000-000000000020', 'SAP PM', 6),
  ('dddddddd-0000-4000-a000-000000000020', 'Budgeting', 4)
on conflict (candidate_id, skill) do nothing;

-- ----------------------------------------------------------------------------
-- Candidate certifications
-- ----------------------------------------------------------------------------

insert into public.candidate_certifications (candidate_id, name) values
  ('dddddddd-0000-4000-a000-000000000001', 'ISO 45001 Lead Auditor'),
  ('dddddddd-0000-4000-a000-000000000001', 'Six Sigma Black Belt'),
  ('dddddddd-0000-4000-a000-000000000002', 'CMRP'),
  ('dddddddd-0000-4000-a000-000000000002', 'ISO 18436 Cat II Vibration'),
  ('dddddddd-0000-4000-a000-000000000003', 'Licensed Blaster (PNP-FED)'),
  ('dddddddd-0000-4000-a000-000000000003', 'NCII Heavy Equipment'),
  ('dddddddd-0000-4000-a000-000000000004', 'ISO 45001 Lead Auditor'),
  ('dddddddd-0000-4000-a000-000000000004', 'NEBOSH IGC'),
  ('dddddddd-0000-4000-a000-000000000005', 'REE License'),
  ('dddddddd-0000-4000-a000-000000000006', 'Six Sigma Green Belt'),
  ('dddddddd-0000-4000-a000-000000000007', 'ISO 18436 Cat I'),
  ('dddddddd-0000-4000-a000-000000000008', 'CLTD'),
  ('dddddddd-0000-4000-a000-000000000009', 'NCII Heavy Equipment'),
  ('dddddddd-0000-4000-a000-000000000010', 'NEBOSH IGC'),
  ('dddddddd-0000-4000-a000-000000000010', 'OSHA 30'),
  ('dddddddd-0000-4000-a000-000000000012', 'PEE License'),
  ('dddddddd-0000-4000-a000-000000000013', 'CMRP (in progress)'),
  ('dddddddd-0000-4000-a000-000000000015', 'Licensed Blaster (PNP-FED)'),
  ('dddddddd-0000-4000-a000-000000000015', 'OSHA 30'),
  ('dddddddd-0000-4000-a000-000000000016', 'OSHA 30'),
  ('dddddddd-0000-4000-a000-000000000017', 'REE License'),
  ('dddddddd-0000-4000-a000-000000000018', 'Six Sigma Black Belt'),
  ('dddddddd-0000-4000-a000-000000000019', 'P.Eng (Ontario)'),
  ('dddddddd-0000-4000-a000-000000000020', 'CMRP')
on conflict (candidate_id, name) do nothing;

-- ----------------------------------------------------------------------------
-- Candidate tags
-- ----------------------------------------------------------------------------

insert into public.candidate_tags (candidate_id, tag) values
  ('dddddddd-0000-4000-a000-000000000001', 'Top Tier'),
  ('dddddddd-0000-4000-a000-000000000001', 'Leadership'),
  ('dddddddd-0000-4000-a000-000000000002', 'Top Tier'),
  ('dddddddd-0000-4000-a000-000000000003', 'Remote Ready'),
  ('dddddddd-0000-4000-a000-000000000004', 'Top Tier'),
  ('dddddddd-0000-4000-a000-000000000004', 'Leadership'),
  ('dddddddd-0000-4000-a000-000000000006', 'Leadership'),
  ('dddddddd-0000-4000-a000-000000000012', 'Top Tier'),
  ('dddddddd-0000-4000-a000-000000000015', 'Top Tier'),
  ('dddddddd-0000-4000-a000-000000000018', 'Top Tier'),
  ('dddddddd-0000-4000-a000-000000000019', 'TN Eligible'),
  ('dddddddd-0000-4000-a000-000000000020', 'TN Eligible')
on conflict (candidate_id, tag) do nothing;

-- ----------------------------------------------------------------------------
-- Applications. The AFTER INSERT trigger writes "Application received via …"
-- into activity_log at applied_at; "Moved to …" rows are added further below.
-- ----------------------------------------------------------------------------

insert into public.applications (id, candidate_id, job_id, stage, stage_entered_at, applied_at) values
  ('eeeeeeee-0000-4000-a000-000000000001', 'dddddddd-0000-4000-a000-000000000001', 'cccccccc-0000-4000-a000-000000000001', 'interview', now() - interval '3 days',  now() - interval '20 days'),
  ('eeeeeeee-0000-4000-a000-000000000002', 'dddddddd-0000-4000-a000-000000000002', 'cccccccc-0000-4000-a000-000000000003', 'offer',     now() - interval '2 days',  now() - interval '30 days'),
  ('eeeeeeee-0000-4000-a000-000000000003', 'dddddddd-0000-4000-a000-000000000003', 'cccccccc-0000-4000-a000-000000000002', 'screening', now() - interval '7 days',  now() - interval '24 days'),
  ('eeeeeeee-0000-4000-a000-000000000004', 'dddddddd-0000-4000-a000-000000000004', 'cccccccc-0000-4000-a000-000000000004', 'interview', now() - interval '6 days',  now() - interval '22 days'),
  ('eeeeeeee-0000-4000-a000-000000000005', 'dddddddd-0000-4000-a000-000000000005', 'cccccccc-0000-4000-a000-000000000005', 'applied',   now() - interval '2 days',  now() - interval '2 days'),
  ('eeeeeeee-0000-4000-a000-000000000006', 'dddddddd-0000-4000-a000-000000000006', 'cccccccc-0000-4000-a000-000000000001', 'screening', now() - interval '9 days',  now() - interval '26 days'),
  ('eeeeeeee-0000-4000-a000-000000000007', 'dddddddd-0000-4000-a000-000000000007', 'cccccccc-0000-4000-a000-000000000003', 'applied',   now() - interval '1 day',   now() - interval '1 day'),
  ('eeeeeeee-0000-4000-a000-000000000008', 'dddddddd-0000-4000-a000-000000000008', 'cccccccc-0000-4000-a000-000000000006', 'interview', now() - interval '8 days',  now() - interval '25 days'),
  ('eeeeeeee-0000-4000-a000-000000000009', 'dddddddd-0000-4000-a000-000000000009', 'cccccccc-0000-4000-a000-000000000002', 'applied',   now() - interval '12 days', now() - interval '12 days'),
  ('eeeeeeee-0000-4000-a000-000000000010', 'dddddddd-0000-4000-a000-000000000010', 'cccccccc-0000-4000-a000-000000000004', 'screening', now() - interval '4 days',  now() - interval '19 days'),
  ('eeeeeeee-0000-4000-a000-000000000011', 'dddddddd-0000-4000-a000-000000000011', 'cccccccc-0000-4000-a000-000000000001', 'rejected',  now() - interval '5 days',  now() - interval '20 days'),
  ('eeeeeeee-0000-4000-a000-000000000012', 'dddddddd-0000-4000-a000-000000000012', 'cccccccc-0000-4000-a000-000000000005', 'hired',     now() - interval '1 day',   now() - interval '16 days'),
  ('eeeeeeee-0000-4000-a000-000000000013', 'dddddddd-0000-4000-a000-000000000013', 'cccccccc-0000-4000-a000-000000000003', 'interview', now() - interval '11 days', now() - interval '28 days'),
  ('eeeeeeee-0000-4000-a000-000000000014', 'dddddddd-0000-4000-a000-000000000014', 'cccccccc-0000-4000-a000-000000000006', 'applied',   now() - interval '3 days',  now() - interval '3 days'),
  ('eeeeeeee-0000-4000-a000-000000000015', 'dddddddd-0000-4000-a000-000000000015', 'cccccccc-0000-4000-a000-000000000002', 'offer',     now() - interval '1 day',   now() - interval '17 days'),
  ('eeeeeeee-0000-4000-a000-000000000016', 'dddddddd-0000-4000-a000-000000000016', 'cccccccc-0000-4000-a000-000000000004', 'applied',   now() - interval '6 days',  now() - interval '6 days'),
  ('eeeeeeee-0000-4000-a000-000000000017', 'dddddddd-0000-4000-a000-000000000017', 'cccccccc-0000-4000-a000-000000000005', 'screening', now() - interval '13 days', now() - interval '29 days'),
  ('eeeeeeee-0000-4000-a000-000000000018', 'dddddddd-0000-4000-a000-000000000018', 'cccccccc-0000-4000-a000-000000000001', 'applied',   now() - interval '8 days',  now() - interval '8 days'),
  ('eeeeeeee-0000-4000-a000-000000000019', 'dddddddd-0000-4000-a000-000000000019', 'cccccccc-0000-4000-a000-000000000007', 'screening', now() - interval '4 days',  now() - interval '9 days'),
  ('eeeeeeee-0000-4000-a000-000000000020', 'dddddddd-0000-4000-a000-000000000020', 'cccccccc-0000-4000-a000-000000000008', 'applied',   now() - interval '2 days',  now() - interval '2 days')
on conflict (id) do nothing;

-- "Moved to …" audit entries for every application past the applied stage
-- (the stage-change trigger only fires on UPDATE; these seed rows were
-- inserted directly in their current stage).

insert into public.activity_log (candidate_id, actor_id, type, body, created_at, updated_at)
select a.candidate_id,
       'aaaaaaaa-0000-4000-a000-000000000001',
       'stage',
       format('Moved to %s — %s', initcap(a.stage::text), j.title),
       a.stage_entered_at,
       a.stage_entered_at
  from public.applications a
  join public.jobs j on j.id = a.job_id
 where a.stage <> 'applied'
   and a.id::text like 'eeeeeeee-%';

-- ----------------------------------------------------------------------------
-- Candidate notes
-- ----------------------------------------------------------------------------

insert into public.notes (candidate_id, author_id, category, body, created_at) values
  ('dddddddd-0000-4000-a000-000000000001', 'aaaaaaaa-0000-4000-a000-000000000001', 'general',
   'Negotiation anchor at 220k/mo; open to Cebu relocation immediately. Wants clarity on kiln capex plan before final panel.',
   now() - interval '4 days'),
  ('dddddddd-0000-4000-a000-000000000002', 'aaaaaaaa-0000-4000-a000-000000000002', 'technical',
   'Walked through her PdM rollout at the nickel mine — vibration routes, oil analysis, criticality ranking. Very strong; ready for offer.',
   now() - interval '6 days'),
  ('dddddddd-0000-4000-a000-000000000006', 'aaaaaaaa-0000-4000-a000-000000000001', 'screening',
   'Strong cost control track record; kiln exposure is thin — flag for HM review before moving to interview.',
   now() - interval '8 days'),
  ('dddddddd-0000-4000-a000-000000000019', 'aaaaaaaa-0000-4000-a000-000000000002', 'screening',
   'Canadian citizen, P.Eng Ontario — TN-1 eligible for the Lonestar role. Passport current; can start border process within 2 weeks of offer.',
   now() - interval '3 days');

-- ----------------------------------------------------------------------------
-- Scorecards
-- ----------------------------------------------------------------------------

insert into public.scorecards (id, application_id, interviewer_id, ratings, summary, recommendation, created_at) values
  ('acacacac-0000-4000-a000-000000000001', 'eeeeeeee-0000-4000-a000-000000000002', 'aaaaaaaa-0000-4000-a000-000000000002',
   '{"Technical Skills": 5, "Industry Experience": 4, "Communication": 4, "Leadership": 4, "Culture Fit": 5, "Problem-Solving": 5}'::jsonb,
   'Outstanding technical depth; clear PdM program ownership.',
   'strong_hire', now() - interval '6 days'),
  ('acacacac-0000-4000-a000-000000000002', 'eeeeeeee-0000-4000-a000-000000000015', 'aaaaaaaa-0000-4000-a000-000000000001',
   '{"Technical Skills": 5, "Industry Experience": 5, "Communication": 3, "Leadership": 4, "Culture Fit": 4, "Problem-Solving": 4}'::jsonb,
   'Deep quarry expertise, slightly reserved communicator.',
   'hire', now() - interval '4 days')
on conflict (id) do nothing;

insert into public.activity_log (candidate_id, actor_id, type, body, created_at, updated_at) values
  ('dddddddd-0000-4000-a000-000000000002', 'aaaaaaaa-0000-4000-a000-000000000002', 'scorecard',
   'Scorecard submitted by Ramon Santos — Strong Hire', now() - interval '6 days', now() - interval '6 days'),
  ('dddddddd-0000-4000-a000-000000000015', 'aaaaaaaa-0000-4000-a000-000000000001', 'scorecard',
   'Scorecard submitted by Jenny McRich — Hire', now() - interval '4 days', now() - interval '4 days');

-- ----------------------------------------------------------------------------
-- Interviews (scheduled; respects the (interviewer_id, starts_at) guard)
-- ----------------------------------------------------------------------------

insert into public.interviews (id, application_id, interviewer_id, starts_at, type, status) values
  ('abababab-0000-4000-a000-000000000001', 'eeeeeeee-0000-4000-a000-000000000001', 'aaaaaaaa-0000-4000-a000-000000000001',
   (current_date + 1 + time '10:00')::timestamptz, 'final_panel', 'scheduled'),
  ('abababab-0000-4000-a000-000000000002', 'eeeeeeee-0000-4000-a000-000000000004', 'aaaaaaaa-0000-4000-a000-000000000002',
   (current_date + time '15:00')::timestamptz, 'technical', 'scheduled'),
  ('abababab-0000-4000-a000-000000000003', 'eeeeeeee-0000-4000-a000-000000000008', 'aaaaaaaa-0000-4000-a000-000000000001',
   (current_date + 3 + time '09:30')::timestamptz, 'hr_interview', 'scheduled'),
  ('abababab-0000-4000-a000-000000000004', 'eeeeeeee-0000-4000-a000-000000000013', 'aaaaaaaa-0000-4000-a000-000000000002',
   (current_date + 5 + time '13:00')::timestamptz, 'technical', 'scheduled')
on conflict (id) do nothing;

insert into public.activity_log (candidate_id, actor_id, type, body, created_at, updated_at) values
  ('dddddddd-0000-4000-a000-000000000001', 'aaaaaaaa-0000-4000-a000-000000000001', 'interview',
   'Interview scheduled: Final Panel with Jenny McRich', now() - interval '2 days', now() - interval '2 days'),
  ('dddddddd-0000-4000-a000-000000000004', 'aaaaaaaa-0000-4000-a000-000000000001', 'interview',
   'Interview scheduled: Technical with Ramon Santos', now() - interval '3 days', now() - interval '3 days'),
  ('dddddddd-0000-4000-a000-000000000008', 'aaaaaaaa-0000-4000-a000-000000000001', 'interview',
   'Interview scheduled: HR Interview with Jenny McRich', now() - interval '2 days', now() - interval '2 days'),
  ('dddddddd-0000-4000-a000-000000000013', 'aaaaaaaa-0000-4000-a000-000000000002', 'interview',
   'Interview scheduled: Technical with Ramon Santos', now() - interval '4 days', now() - interval '4 days');

-- ----------------------------------------------------------------------------
-- Documents (metadata only — binaries belong in the private Storage bucket)
-- ----------------------------------------------------------------------------

insert into public.documents (candidate_id, storage_path, file_name, category, uploaded_by, created_at) values
  ('dddddddd-0000-4000-a000-000000000001', 'candidates/dddddddd-0000-4000-a000-000000000001/Alex_Miller_Resume.pdf',
   'Alex_Miller_Resume.pdf', 'resume', 'aaaaaaaa-0000-4000-a000-000000000001', now() - interval '20 days'),
  ('dddddddd-0000-4000-a000-000000000001', 'candidates/dddddddd-0000-4000-a000-000000000001/ISO45001_Cert.pdf',
   'ISO45001_Cert.pdf', 'certification', 'aaaaaaaa-0000-4000-a000-000000000001', now() - interval '19 days'),
  ('dddddddd-0000-4000-a000-000000000002', 'candidates/dddddddd-0000-4000-a000-000000000002/Sarah_Jenkins_Resume.pdf',
   'Sarah_Jenkins_Resume.pdf', 'resume', 'aaaaaaaa-0000-4000-a000-000000000002', now() - interval '30 days')
on conflict (storage_path) do nothing;

-- ----------------------------------------------------------------------------
-- Email templates (merge fields: {{candidate_name}} {{job_title}} {{client}}
-- {{recruiter_name}} {{stage}} {{interview_date}})
-- ----------------------------------------------------------------------------

insert into public.email_templates (id, name, category, subject, body, created_by) values
  ('ffffffff-0000-4000-a000-000000000001', 'Interview Invitation', 'interview',
   'Interview Invitation – {{job_title}} at {{client}}',
   E'Hi {{candidate_name}},\n\nThank you for your interest in the {{job_title}} role with {{client}}. We would like to invite you to an interview.\n\nProposed date: {{interview_date}}\n\nPlease confirm your availability.\n\nBest regards,\n{{recruiter_name}}\nJeniMcRich Recruitment',
   'aaaaaaaa-0000-4000-a000-000000000001'),
  ('ffffffff-0000-4000-a000-000000000002', 'Rejection – After Review', 'rejection',
   'Update on your application – {{job_title}}',
   E'Hi {{candidate_name}},\n\nThank you for applying for the {{job_title}} position. After careful review, we have decided to move forward with other candidates at this time.\n\nWe will keep your profile in our talent pipeline for future roles.\n\nKind regards,\n{{recruiter_name}}\nJeniMcRich Recruitment',
   'aaaaaaaa-0000-4000-a000-000000000001'),
  ('ffffffff-0000-4000-a000-000000000003', 'Offer Letter Cover', 'offer',
   'Offer of Employment – {{job_title}}',
   E'Dear {{candidate_name}},\n\nCongratulations! {{client}} is pleased to extend an offer for the position of {{job_title}}.\n\nPlease find the formal offer attached. Kindly confirm receipt and respond within 5 business days.\n\nWarm regards,\n{{recruiter_name}}\nJeniMcRich Recruitment',
   'aaaaaaaa-0000-4000-a000-000000000001'),
  ('ffffffff-0000-4000-a000-000000000004', 'Status Update – In Progress', 'update',
   'Your application status – {{job_title}}',
   E'Hi {{candidate_name}},\n\nA quick update: your application for {{job_title}} is currently at the {{stage}} stage. We will reach out with next steps shortly.\n\nThanks for your patience,\n{{recruiter_name}}',
   'aaaaaaaa-0000-4000-a000-000000000001'),
  ('ffffffff-0000-4000-a000-000000000005', 'Missing Documents Reminder', 'update',
   'Action needed – documents for your application',
   E'Hi {{candidate_name}},\n\nWe noticed your profile for {{job_title}} is missing required documents. Please upload them at your earliest convenience so we can keep your application moving.\n\nThank you,\n{{recruiter_name}}',
   'aaaaaaaa-0000-4000-a000-000000000001')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Email log + matching activity entries (domain rule #6: sends are logged to
-- email_log AND the candidate's activity_log)
-- ----------------------------------------------------------------------------

insert into public.email_log (id, candidate_id, template_id, to_email, subject, status, resend_id, created_at) values
  ('aeaeaeae-0000-4000-a000-000000000001', 'dddddddd-0000-4000-a000-000000000001', 'ffffffff-0000-4000-a000-000000000001',
   'alex.miller@gmail.com', 'Interview Invitation – Plant Manager – Cement at Helix Cement Corp',
   'delivered', 're_demo_0001', now() - interval '2 days'),
  ('aeaeaeae-0000-4000-a000-000000000002', 'dddddddd-0000-4000-a000-000000000015', 'ffffffff-0000-4000-a000-000000000003',
   'miguel.bautista@gmail.com', 'Offer of Employment – Quarry Supervisor – Aggregates',
   'opened', 're_demo_0002', now() - interval '1 day')
on conflict (id) do nothing;

insert into public.activity_log (candidate_id, actor_id, type, body, created_at, updated_at) values
  ('dddddddd-0000-4000-a000-000000000001', 'aaaaaaaa-0000-4000-a000-000000000001', 'email',
   'Email sent: Interview Invitation – Plant Manager – Cement at Helix Cement Corp', now() - interval '2 days', now() - interval '2 days'),
  ('dddddddd-0000-4000-a000-000000000015', 'aaaaaaaa-0000-4000-a000-000000000001', 'email',
   'Email sent: Offer of Employment – Quarry Supervisor – Aggregates', now() - interval '1 day', now() - interval '1 day');

-- ----------------------------------------------------------------------------
-- Settings (singleton)
-- ----------------------------------------------------------------------------

insert into public.settings (id, singleton, stalled_days, stalled_enabled)
values ('adadadad-0000-4000-a000-000000000001', true, 5, true)
on conflict (singleton) do nothing;

commit;
