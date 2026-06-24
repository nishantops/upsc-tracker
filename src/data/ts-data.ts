/** Test-series data — mirrors old app's dataTS_* arrays. */

export interface TSPaper {
  key: string;
  label: string;
  prefix: string;
  items: string[];
}

export const TS_PRELIMS: TSPaper[] = [
  {
    key: 'p1',
    label: 'GS Paper I',
    prefix: 'tp1',
    items: ['Prelims GS1 Mock Test 01', 'Prelims GS1 Mock Test 02'],
  },
  {
    key: 'p2',
    label: 'CSAT Paper II',
    prefix: 'tp2',
    items: ['Prelims CSAT Mock Test 01', 'Prelims CSAT Mock Test 02'],
  },
];

export const TS_MAINS: TSPaper[] = [
  { key: 'gs1', label: 'GS-I', prefix: 'tg1', items: ['Mains GS-I Sectional Test 01'] },
  { key: 'gs2', label: 'GS-II', prefix: 'tg2', items: ['Mains GS-II Sectional Test 01'] },
  { key: 'gs3', label: 'GS-III', prefix: 'tg3', items: ['Mains GS-III Sectional Test 01'] },
  { key: 'gs4', label: 'GS-IV', prefix: 'tg4', items: ['Mains GS-IV Sectional Test 01'] },
  { key: 'essay', label: 'Essay', prefix: 'te1', items: ['Mains Essay Test 01'] },
  { key: 'a1', label: 'Anthro P1', prefix: 'ta1', items: ['Anthro P1 Sectional Test 01'] },
  { key: 'a2', label: 'Anthro P2', prefix: 'ta2', items: ['Anthro P2 Sectional Test 01'] },
];
