-- Normalize stored outcome wording across the app.
-- Old: "Rischio Accettabile" / "Rischio Non Accettabile"
-- New: "Rischio Trascurabile" / "Rischio Non Trascurabile"

update public.assessment_sessions
set final_outcome = 'Rischio Non Trascurabile'
where lower(final_outcome) = 'rischio non accettabile';

update public.assessment_sessions
set final_outcome = 'Rischio Trascurabile'
where lower(final_outcome) = 'rischio accettabile';

