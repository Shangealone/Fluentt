# Fluentt learning materials: source coverage

Working outline, 2026-11-01. The user requested original Fluentt lessons based on the previously collected sources. Book/video topics are references, not a requirement to reproduce source text or mirror each chapter. This is an authoring map, not a claim that the lessons below are published or have been reviewed. `CONTENT_SOURCE_REGISTER.md` records the source links, permission notes and known access limitations.

## Already published

The local administrator database contains the English Grammar Pilot: **Can, Could, and Be Able To** (Grade 7), **Has, Have, and Had** (Grade 5), and **A Friendly Way to Ask** (Grade 7), plus 37 associated question revisions. Their existing versions must not be overwritten.

## Imported for administrator review: clubs and future ideas

On 2026-11-01 the user supplied ten screenshots from SRC-02 covering school clubs and dream jobs and authorized using their ideas to create Fluentt lessons. The following six **original** Grade 4 English lessons were imported as drafts, with their reading materials and 48 original practice questions (18 multiple-choice, 12 word-arrangement, and 18 flashcards):

1. Finding a Club You Enjoy
2. What Do You Like to Do?
3. Reading a Club Invitation
4. Exploring Different Jobs
5. Talking About Future Plans
6. A Story About Future Ideas

They are in the administrator curriculum edition **English: Clubs and Future Ideas** (`092a32f4-e335-5884-8ef2-83e35d1f9d74`). They are not yet published or visible to learners. Each lesson has an original reading, competency, source reference, and private answer keys. The screenshots informed topics and learning targets; the new content uses different characters, wording and examples. Source audio and images were not imported. Placement is Grade 4 English, consistent with the source register's Grades 4–5 suggestion.

Authoring source: `services/api/app/modules/questions/school_clubs_content.py`; administrator draft importer: `services/api/app/modules/questions/school_clubs_import.py`. The importer validates question contracts before its atomic transaction, checks live editor privileges, records source provenance and refuses to overwrite a different pack fingerprint. A private local database backup was saved before import. The administrator browser was unavailable in this session; curriculum publication and question publication remain outstanding.

This batch covers the supplied SRC-02 screenshots; it does not complete the remaining books, video topics, or the whole coverage map below.

## Imported for administrator review: grammar follow-up

On 2026-11-01, at the user's request to add material from other sources, four original Grade 7 English lessons were imported as drafts, with readings and 32 questions (12 multiple-choice, 8 word-arrangement, and 12 flashcards): **Talking About Pairs** (VID-04), **Find the Main Subject** (VID-05), **Choosing a Verb with Or and Nor** (VID-06), and **Using Each and Each Of** (VID-07).

The edition is **English: Grammar Follow-up** (`1eb0019a-c316-5832-8005-9759b84327e3`). The referenced video URLs were not retrievable during authoring; these lessons use the previously recorded user-supplied topic summaries and original examples. No video transcript or audio was copied. They use the existing English Grammar Pilot subject to retain compatibility with classes already bound to that subject. A private backup was saved before importing. Lessons and questions are drafts and need administrator review and publication before students can access them.

Authoring source: `services/api/app/modules/questions/grammar_followup_content.py`; import with `school_clubs_import.py --pack grammar-followup`. The remaining book-derived groups and optional VID-08 resource-orientation material are still outstanding.

## Imported for administrator review: first letters

Nine original Grade 1 printed-letter lessons, with 70 practice questions, are saved in **English: First Letters** (`8ed152be-b91a-574e-9a0a-526288f05026`). They cover letters A–Z and finding beginning sounds, using original examples informed by the accessible SRC-03 description and contents. No book audio or images were imported. The lessons and questions are drafts and require review and publication. Authoring source: `services/api/app/modules/questions/first_letters_content.py`.

## Imported for administrator review: school, food and homes

Twelve original Grade 2 lessons, with 96 practice questions, are saved in **English: School, Food and Homes** (`a0aa3948-3cfb-51c2-bd20-6db042ad174f`). They cover school supplies and places, shapes, learning spaces, food and quantities, ownership and sequence, homes and habitats, and an original reading story. The user-supplied SRC-05 chapter notes informed the topics; the linked reader was unavailable. No source text, images or audio were imported. A private database backup preceded import. The lessons and questions are drafts and require review and publication. Authoring source: `services/api/app/modules/questions/school_food_homes_content.py`.

## Imported for administrator review: everyday conversations

Seven original Grade 3 lessons, with 56 practice questions, are saved in **English: Everyday Conversations** (`95badfa5-d3ec-5596-aeeb-8e207c73fa4a`). They cover greetings, food choices, polite shopping, time, routines, actions happening now, and asking for directions. The SRC-01 reader exposed no machine-readable page text, so its registered topic guide informed the collection and all dialogues, examples, and activities were independently written. No source audio or images were used. A private database backup preceded import. All content remains draft for administrator review and publication. Authoring source: `services/api/app/modules/questions/everyday_english_content.py`.

## Imported for administrator review: reading skills

Four original Grade 3 reading lessons, with 32 practice questions, are saved in **English: Reading Skills** (`417107e9-f217-5e2a-9171-a5be06c96c98`). Each uses a new short passage to teach main idea, stated details, context clues, or sequencing and retelling. SRC-04's registered reading-skills use informed the targets; the linked reader exposed no machine-readable passage text. No source text or images were copied. A private database backup preceded import. All content remains draft for administrator review and publication. Authoring source: `services/api/app/modules/questions/reading_skills_content.py`.

## Original lesson coverage map

| Group | Proposed lesson topics | Reference | Proposed placement |
|---|---|---|---|
| First sounds | Letters A–Z and finding beginning sounds | SRC-03 | Nine Grade 1 drafts imported; review/publication pending |
| School and home | School supplies; places at school; shapes in the classroom; different schools; rooms and things at home; different kinds of homes; animal homes | SRC-05 | Grade 2 drafts imported; review/publication pending |
| Food and quantities | Counting food; describing food; ingredients and ownership; following simple instructions | SRC-05 | Grade 2 drafts imported; review/publication pending |
| Everyday conversations | Greetings and introductions; asking about food; shopping politely; telling the time; daily routines; actions; asking about places | SRC-01 | Seven Grade 3 drafts imported; review/publication pending |
| Reading skills | Finding the main idea; finding a detail; learning words from context; retelling in order | SRC-04 | Four Grade 3 drafts with original passages imported; review/publication pending |
| Community and interests | Joining a school club; talking about future jobs; places in town; festivals; vacation plans; healthy habits; everyday habits; telling a short story | SRC-02 | Grades 4–5 |
| Grammar follow-up | Plural-only nouns and pairs; the main subject with together with / along with / as well as; agreement with or / nor; each of and singular verbs | VID-04–VID-07 | Four Grade 7 drafts imported; review/publication pending |
| Learning resources | Finding useful and trustworthy language resources | VID-08 | Optional, Grade 7+ |

Placements are proposed starting points. Use English for these English source-derived lessons. No Tagalog translation, external audio, image, video, transcript text, or source passage is assumed. The source register's screen-supplied SRC-05 chapter map may inform original topics; it does not establish that the linked pages were retrieved. SRC-01 and SRC-04 readers had no machine-readable text in the source lookup; SRC-05 was inaccessible. SRC-02's accessible outline names topics, and SRC-03's accessible description and contents identify the early phonics progression. Preserve these distinctions in provenance.

## Requirements before each lesson is added

Create original age-appropriate explanations, examples and exercises; record source ID and what was actually verified. Specify the grade, English subject and difficulty. Validate question definitions and answer keys against the existing methods. Keep each published curriculum version and assigned question revision immutable. Follow the existing administrator permission, audit, content lock and retry rules. Review lesson text, intended placement and answer keys before publishing. Do not enable listening activities unless the app has a supported audio source.

Each batch needs a concrete inventory and a result record showing authored, imported, published or blocked status. Never call a source covered simply because a topic appears in this outline.
