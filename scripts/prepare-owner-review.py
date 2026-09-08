"""Prepare the owner's September 8 editorial decisions; never changes source values."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
notes = json.loads((root / 'audits/owner-review-2026-09-08.json').read_text())
# Workbook row numbers are retained for traceability, while deployment uses stable IDs.
copy = {
8: ('Fastest GDP growth in {year}', 'Annual growth in economic output after adjusting for inflation, compared with the previous year'),
15: ("Earliest men's FIFA World Cup debut", "First World Cup appearance among countries that have participated; earlier years rank higher"),
16: ('Highest % following other religions', 'Religions other than Christianity, Islam, Hinduism, Buddhism or Judaism; excludes people with no religion'),
18: ('Highest % of bank loans overdue or unlikely to be repaid', 'Loans overdue by at least 90 days or otherwise unlikely to be repaid in full, as a share of all bank loans'),
24: ('Highest % using cooking fuels meeting WHO clean air criteria', 'People mainly cooking with electricity, gas, biogas, solar or alcohol fuels, classified using WHO household air pollution guidelines'),
36: (None, 'Urban households lacking safe water, sanitation, enough living space, durable housing or secure tenure, under the UN definition'),
56: ('Highest percentage of GDP spent on education', 'Government spending on education as a percentage of the country’s economic output'),
85: ('Highest average number of children per woman', 'Children a woman would have over her lifetime if current birth rates at each age stayed the same'),
110: (None, 'Uneven distribution of years of schooling among adults, measured by the Atkinson inequality index; higher percentages mean greater inequality'),
111: ('Highest inflation in {year}', 'Annual percentage increase in consumer prices compared with the previous year'),
112: ('Highest foreign investment received as % of GDP', 'Direct investment received from abroad, after subtracting withdrawals, as a percentage of economic output'),
122: ('Fastest population growth from births minus deaths', 'Annual births minus deaths per 1,000 residents; excludes immigration and emigration'),
123: ('Highest net government borrowing from banks as % of GDP', 'Banks’ loans and other claims on central government minus government deposits, as a percentage of economic output'),
125: ('Highest net immigration per 1,000 residents', 'People moving into the country minus people moving out during the year, per 1,000 residents; excludes moves within the country'),
128: (None, 'Cold winters: coldest month averages 0°C or below and warmest month above 10°C; excludes arid land'),
129: (None, 'Very dry land receiving less than half the rainfall threshold for arid climates; the threshold depends on temperature and seasonal rainfall'),
130: (None, 'A type of temperate climate with dry summers and wetter winters; not limited to countries around the Mediterranean Sea'),
131: (None, 'Land where even the warmest month averages 10°C or below; includes tundra and ice cap climates, excluding arid land'),
132: ('Highest percentage of land with a semiarid steppe climate', 'Dry land with more rain than deserts but below the arid climate rainfall threshold, which varies with temperature and seasonal rainfall'),
133: (None, 'Coldest month averages above 0°C but below 18°C and warmest month above 10°C; excludes arid land and includes Mediterranean climates'),
134: (None, 'Every month averages at least 18°C, with a short dry season; classified using both the driest month and annual rainfall'),
135: (None, 'Every month averages at least 18°C and receives at least 60 mm of rain'),
136: (None, 'Warmest month averages above 0°C but no more than 10°C; excludes arid land and climates cold enough for an ice cap'),
137: (None, 'An umbrella group covering both very dry deserts and less dry steppes, classified using temperature and seasonal rainfall'),
217: ('Largest single lake or reservoir', 'Area of the largest individual lake or reservoir intersecting the country in Natural Earth’s atlas; includes shared water bodies'),
228: (None, 'Mules and hinnies are horse–donkey hybrids; a hinny has a horse father and donkey mother'),
233: (None, 'Business investment across borders with at least 10% ownership, measured net in US dollars; this is investment for a lasting stake, not development aid'),
234: ('Largest development aid received after repayments', 'Official grants and concessional loans for development and welfare, minus repayments, in US dollars'),
259: ('Highest % living in urban areas over one million people', 'Share of the population living in urban agglomerations with more than one million residents'),
273: ('Most freshwater taken from rivers, lakes and groundwater', 'Annual freshwater taken from surface water and underground sources for agriculture, industry and domestic use'),
275: ('Largest central bank reserves', 'Foreign currency, monetary gold, special drawing rights and IMF reserve positions held by monetary authorities, valued in US dollars'),
298: ('Most asylum applications from a country’s citizens', 'New asylum applications grouped by applicants’ country of origin, rather than the country receiving the application'),
374: ('Latest to reach under 50 child deaths per 1,000 births', 'Year deaths before age five first fell below 50 per 1,000 live births; later years rank higher'),
381: (None, 'Pew’s index rises when the population is spread more evenly across seven groups, including people with no religion; it falls when one group dominates'),
385: ('Most mapped river sections', 'Number of river features crossing at least 1 km of the country in Natural Earth’s atlas; sections can belong to the same river'),
405: ('Most publicly trusted website security certificates', 'Distinct TLS/SSL certificates trusted by standard web browsers in Netcraft’s survey, grouped by server hosting country'),
}
# Retire conditional/narrow or redundant categories without pretending a different
# denominator or source definition represents the same statistic.
extra_removals = {
9: 'Retire pending a simpler, useful broad money concept; no automatic restoration',
126: 'Per 1,000 adults is not a business total or growth rate; retain the existing total registrations category instead',
145: 'Redundant account ownership concept; retain global-findex:account-ownership',
232: 'Redundant development aid concept; retain the explicit ODA series DT.ODA.ODAT.CD',
241: 'Retire overlapping goods import concept; retain merchImports customs series without claiming the definitions are identical',
}
for note in notes:
    row = note['row']
    if note['comment'].lower() == 'remove' or row in extra_removals:
        note['action'] = 'retire'
        note['reason'] = extra_removals.get(row, 'Explicit owner removal')
    elif row in copy:
        title, description = copy[row]
        note.update(action='clarify', new_title=title, new_description=description)
    elif row == 14:
        note.update(action='retain', reason='Positive owner feedback; keep category')
    else:
        note.update(action='remove_unnecessary_hyphens', reason='Apply catalog-wide wording cleanup')
(root / 'audits/owner-review-2026-09-08.json').write_text(json.dumps(notes, ensure_ascii=False, indent=2)+'\n')
print({action: sum(n['action']==action for n in notes) for action in sorted({n['action'] for n in notes})})
