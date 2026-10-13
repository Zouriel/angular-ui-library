import type { UiFbOptionSourceDef, UiFbSourceItem, UiFbSourceQuery } from '@zouriel/ui/form-builder';

/*
 * Demo option sources for the showcase. A real app's `search` calls its API;
 * these answer from memory after a short pause so paging, searching,
 * cancelling and the loading states behave as they would over a network.
 */

const FIRST = ['Aminath', 'Ibrahim', 'Mariyam', 'Ahmed', 'Fathimath', 'Mohamed', 'Aishath', 'Hassan', 'Hawwa', 'Ali', 'Khadheeja', 'Hussain', 'Zaha', 'Ismail', 'Shifa', 'Yoosuf', 'Nashwa', 'Adam', 'Raufa', 'Saeed'];
const LAST = ['Shareef', 'Rasheed', 'Naseem', 'Waheed', 'Hameed', 'Latheef', 'Zahir', 'Manik', 'Didi', 'Fulhu', 'Moosa', 'Saleem', 'Habeeb', 'Riyaz', 'Shakir', 'Nizar', 'Faiz', 'Jaleel', 'Adnan', 'Shiham'];
const FACULTIES: Record<string, string> = { stem: 'Science and engineering', arts: 'Arts and humanities', health: 'Health and medicine', vocational: 'Vocational training' };
const FACULTY_KEYS = Object.keys(FACULTIES);

const STUDENTS: (UiFbSourceItem & { faculty: string })[] = Array.from({ length: 600 }, (_, i) => {
  const faculty = FACULTY_KEYS[(i * 7 + Math.floor(i / 20)) % FACULTY_KEYS.length];
  const id = `S${String(240117 + i * 13).padStart(6, '0')}`;
  return { value: id, label: `${FIRST[i % FIRST.length]} ${LAST[(i * 3 + Math.floor(i / 20)) % LAST.length]}`, description: `${id} · ${FACULTIES[faculty]}`, faculty };
});

const COURSES: Record<string, string[]> = {
  stem: ['Calculus I', 'Linear algebra', 'Programming fundamentals', 'Data structures', 'Physics for engineers', 'Marine biology', 'Renewable energy systems', 'Statistics', 'Chemistry I', 'Databases', 'Computer networks', 'Environmental science'],
  arts: ['Dhivehi literature', 'World history', 'Creative writing', 'Philosophy of mind', 'Art history', 'Linguistics', 'Media studies', 'Music theory', 'Islamic studies', 'Translation practice'],
  health: ['Anatomy', 'Physiology', 'Community health', 'Pharmacology', 'Nursing practice I', 'Nursing practice II', 'Public health nutrition', 'Medical ethics', 'Microbiology', 'First aid and emergency care', 'Mental health care'],
  vocational: ['Hospitality operations', 'Diving instruction', 'Electrical installation', 'Boat building', 'Culinary arts', 'Tourism management', 'Plumbing', 'Air conditioning and refrigeration'],
};

function page<T extends UiFbSourceItem>(list: T[], q: UiFbSourceQuery): Promise<{ items: UiFbSourceItem[]; total: number }> {
  const needle = q.query.toLowerCase();
  const hits = needle ? list.filter((x) => x.label.toLowerCase().includes(needle) || String(x.value).toLowerCase().includes(needle)) : list;
  const items = hits.slice((q.page - 1) * q.pageSize, q.page * q.pageSize).map(({ value, label, description }) => ({ value, label, description }));
  // A real request is cancelled through `signal`; this one stops waiting the same way.
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => resolve({ items, total: hits.length }), 220 + Math.random() * 260);
    q.signal.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); });
  });
}

export const STUDENTS_SOURCE: UiFbOptionSourceDef = {
  type: 'students',
  label: 'Students',
  description: 'Everyone in the student records (600 in this demo), searched by name or ID.',
  params: [{ key: 'faculty', label: 'Faculty', kind: 'select', options: FACULTY_KEYS.map((k) => ({ value: k, label: FACULTIES[k] })), hint: 'Leave on “Any” to search every student.' }],
  pageSize: 20,
  search: (q) => page(q.params['faculty'] ? STUDENTS.filter((s) => s.faculty === q.params['faculty']) : STUDENTS, q),
};

export const COURSES_SOURCE: UiFbOptionSourceDef = {
  type: 'courses',
  label: 'Courses',
  description: 'Courses offered by one programme.',
  params: [{ key: 'programme', label: 'Programme', kind: 'select', required: true, options: FACULTY_KEYS.map((k) => ({ value: k, label: FACULTIES[k] })), hint: 'Usually “the answer to” the Programme question, so the list follows it.' }],
  pageSize: 8,
  search: (q) => page((COURSES[String(q.params['programme'] ?? '')] ?? []).map((c, i) => ({ value: `${q.params['programme']}-${i + 1}`, label: c })), q),
};

export const DEMO_SOURCES = [STUDENTS_SOURCE, COURSES_SOURCE];
