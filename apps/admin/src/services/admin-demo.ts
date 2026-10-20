import type { AdminProfile } from "./admin-contract";
import type { CurriculumNode } from "./curriculum-contract";

export const DEMO_ADMIN_COOKIE = "fluentt_demo_admin";

export const DEMO_ADMIN_PROFILE: AdminProfile = {
  username: "admin_demo",
  role: "administrator",
  permissions: [
    "dashboard.view",
    "curriculum.read",
    "curriculum.write",
    "curriculum.publish",
    "questions.read",
    "questions.write",
    "questions.publish",
    "grading.read",
    "grading.run",
    "research.read",
    "research.manage",
  ],
  csrf_token: "c".repeat(43),
  expires_at: new Date(Date.now() + 86400000).toISOString(),
  absolute_expires_at: new Date(Date.now() + 86400000).toISOString(),
};

const DEMO_REV = "a".repeat(64);

export const DEMO_CURRICULUM_NODES: CurriculumNode[] = [
  {
    id: "a1111111-1111-4111-8111-111111111111",
    kind: "versions",
    parent_id: null,
    version_id: "a1111111-1111-4111-8111-111111111111",
    revision: DEMO_REV,
    frozen: true,
    values: {
      code: "deped-matatag-2026",
      name: "DepEd MATATAG Curriculum (2026–2027 Edition)",
      description: "National curriculum for bilingual English and Filipino learning tracks.",
    },
  },
  {
    id: "b2222222-2222-4222-8222-222222222222",
    kind: "grades",
    parent_id: "a1111111-1111-4111-8111-111111111111",
    version_id: "a1111111-1111-4111-8111-111111111111",
    revision: DEMO_REV,
    frozen: true,
    values: {
      number: 7,
      name: "Baitang 7 (Grade 7)",
    },
  },
  {
    id: "b3333333-3333-4333-8333-333333333333",
    kind: "grades",
    parent_id: "a1111111-1111-4111-8111-111111111111",
    version_id: "a1111111-1111-4111-8111-111111111111",
    revision: DEMO_REV,
    frozen: true,
    values: {
      number: 8,
      name: "Baitang 8 (Grade 8)",
    },
  },
  {
    id: "c3333333-3333-4333-8333-333333333333",
    kind: "subjects",
    parent_id: "b2222222-2222-4222-8222-222222222222",
    version_id: "a1111111-1111-4111-8111-111111111111",
    revision: DEMO_REV,
    frozen: true,
    values: {
      subject_id: "sub-filipino",
      name: "Filipino 7: Panitikang Pilipino at Gramatika",
    },
  },
  {
    id: "c4444444-4444-4444-8444-444444444444",
    kind: "subjects",
    parent_id: "b2222222-2222-4222-8222-222222222222",
    version_id: "a1111111-1111-4111-8111-111111111111",
    revision: DEMO_REV,
    frozen: true,
    values: {
      subject_id: "sub-english",
      name: "English 7: Philippine Literature in English",
    },
  },
  {
    id: "d4444444-4444-4444-8444-444444444444",
    kind: "quarters",
    parent_id: "c3333333-3333-4333-8333-333333333333",
    version_id: "a1111111-1111-4111-8111-111111111111",
    revision: DEMO_REV,
    frozen: true,
    values: {
      number: 1,
      name: "Unang Markahan: Mga Akdang Pampanitikan ng Mindanao",
    },
  },
  {
    id: "d5555555-5555-4555-8555-555555555555",
    kind: "quarters",
    parent_id: "c3333333-3333-4333-8333-333333333333",
    version_id: "a1111111-1111-4111-8111-111111111111",
    revision: DEMO_REV,
    frozen: true,
    values: {
      number: 2,
      name: "Ikalawang Markahan: Panitikan ng Kabisayaan",
    },
  },
  {
    id: "e5555555-5555-4555-8555-555555555555",
    kind: "topics",
    parent_id: "d4444444-4444-4444-8444-444444444444",
    version_id: "a1111111-1111-4111-8111-111111111111",
    revision: DEMO_REV,
    frozen: true,
    values: {
      name: "Paksa: Mga Kuwentong-Bayan, Alamat, at Epiko ng Mindanao",
      description: "Pagsusuri sa mga sinaunang panitikan ng Mindanao at ang kultura ng mga katutubo.",
      position: 1,
    },
  },
  {
    id: "f6666666-6666-4666-8666-666666666666",
    kind: "lessons",
    parent_id: "e5555555-5555-4555-8555-555555555555",
    version_id: "a1111111-1111-4111-8111-111111111111",
    revision: DEMO_REV,
    frozen: true,
    values: {
      name: "Aralin 1: Ang Epikong Darangan at si Prinsipe Bantugan",
      description: "Pagtukoy sa mga katangian ng epiko at ang kabayanihan ni Prinsipe Bantugan.",
      position: 1,
    },
  },
  {
    id: "f7777777-7777-4777-8777-777777777777",
    kind: "lessons",
    parent_id: "e5555555-5555-4555-8555-555555555555",
    version_id: "a1111111-1111-4111-8111-111111111111",
    revision: DEMO_REV,
    frozen: true,
    values: {
      name: "Aralin 2: Mga Salawikain, Sawikain, at Kasabihan",
      description: "Pagkilala at pagpapahalaga sa mga butil ng karunungang minana sa ating mga ninuno.",
      position: 2,
    },
  },
  {
    id: "g7777777-7777-4777-8777-777777777777",
    kind: "competencies",
    parent_id: "f6666666-6666-4666-8666-666666666666",
    version_id: "a1111111-1111-4111-8111-111111111111",
    revision: DEMO_REV,
    frozen: true,
    values: {
      code: "F7PN-Ia-1",
      name: "Nahihinuha ang kaugalian at kalagayang panlipunan",
      description: "F7PN-Ia-1: Nahihinuha ang kaugalian at kalagayang panlipunan ng lugar na pinagmulan ng kuwentong-bayan.",
      position: 1,
    },
  },
  {
    id: "g8888888-8888-4888-8888-888888888888",
    kind: "competencies",
    parent_id: "f6666666-6666-4666-8666-666666666666",
    version_id: "a1111111-1111-4111-8111-111111111111",
    revision: DEMO_REV,
    frozen: true,
    values: {
      code: "F7WG-Ia-1",
      name: "Nagagamit nang wasto ang mga pahayag sa paghahambing",
      description: "F7WG-Ia-1: Nagagamit nang wasto ang mga pahayag sa paghahambing (higit, mas, di-gaano).",
      position: 2,
    },
  },
  {
    id: "sub-filipino",
    kind: "global-subjects",
    parent_id: null,
    version_id: null,
    revision: DEMO_REV,
    frozen: true,
    values: {
      code: "filipino",
      name: "Filipino",
      description: "Pambansang wika at asignaturang pangwika at pampanitikan ng Pilipinas.",
    },
  },
  {
    id: "sub-english",
    kind: "global-subjects",
    parent_id: null,
    version_id: null,
    revision: DEMO_REV,
    frozen: true,
    values: {
      code: "english",
      name: "English",
      description: "Language arts, reading comprehension, and communication skills.",
    },
  },
];


export const DEMO_QUESTIONS = [
  {
    id: "11111111-aaaa-4111-8111-111111111111",
    code: "q-mc-epiko",
    title: "Katangian ng Epiko bilang Akdang Pampanitikan",
    method: "multiple_choice",
    status: "published",
    verification_status: "verified",
    definition: {
      lesson_id: "f6666666-6666-4666-8666-666666666666",
      method: "multiple_choice",
      prompt: "Ano ang pangunahing katangian ng isang epiko bilang akdang pampanitikan?",
      instructions: "Piliin ang pinakatamang sagot mula sa mga opsyon.",
      content: {
        options: [
          { id: "opt-1", text: "Naglalaman ng maikling kuwento tungkol sa hayop na nagbibigay-aral" },
          { id: "opt-2", text: "Mahabang tulang pasalaysay tungkol sa kabayanihan at supernatural na kapangyarihan" },
          { id: "opt-3", text: "Awiting-bayan na inaawit tuwing may kasalan at kapistahan" },
          { id: "opt-4", text: "Dula na itinatanghal sa entablado na may musika at sayaw" },
        ],
      },
    },
    latest_revision: {
      id: "rev-q-mc-1",
      revision: "rev-q-mc-1",
      status: "published",
      created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
  },
  {
    id: "22222222-bbbb-4222-8222-222222222222",
    code: "q-tf-darangan",
    title: "Pinagmulan ng Epikong Darangan",
    method: "true_false",
    status: "published",
    verification_status: "verified",
    definition: {
      lesson_id: "f6666666-6666-4666-8666-666666666666",
      method: "true_false",
      prompt: "Ang epikong 'Darangan' ay nagmula sa mga Maranao sa pulo ng Mindanao.",
      instructions: "Tukuyin kung tama o mali ang pahayag.",
      content: {
        options: [
          { id: "opt-t", text: "Tama" },
          { id: "opt-f", text: "Mali" },
        ],
      },
    },
    latest_revision: {
      id: "rev-q-tf-1",
      revision: "rev-q-tf-1",
      status: "published",
      created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
  },
  {
    id: "33333333-cccc-4333-8333-333333333333",
    code: "q-ms-elemento",
    title: "Mga Elemento ng Kuwentong-Bayan",
    method: "multiple_select",
    status: "published",
    verification_status: "verified",
    definition: {
      lesson_id: "f6666666-6666-4666-8666-666666666666",
      method: "multiple_select",
      prompt: "Alin sa mga sumusunod ang mga elemento ng kuwentong-bayan? (Piliin ang lahat ng angkop)",
      instructions: "Pumili ng isa o higit pang tamang sagot.",
      content: {
        options: [
          { id: "opt-ms-1", text: "Tauhan at Tagpuan" },
          { id: "opt-ms-2", text: "Banghay at Tunggalian" },
          { id: "opt-ms-3", text: "Sukat at Tugma sa Saknong" },
          { id: "opt-ms-4", text: "Aral o Mensahe" },
        ],
      },
    },
    latest_revision: {
      id: "rev-q-ms-1",
      revision: "rev-q-ms-1",
      status: "published",
      created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
  },
  {
    id: "44444444-dddd-4444-8444-444444444444",
    code: "q-err-gramatika",
    title: "Pagwawasto ng Gramatika sa Pangungusap",
    method: "error_identification",
    status: "published",
    verification_status: "verified",
    definition: {
      lesson_id: "f6666666-6666-4666-8666-666666666666",
      method: "error_identification",
      prompt: "Piliin ang bahaging naglalaman ng maling gramatika:",
      instructions: "Pindutin ang maling token sa pangungusap.",
      content: {
        tokens: [
          { id: "tok-1", text: "Sina" },
          { id: "tok-2", text: "Guro Maria" },
          { id: "tok-3", text: "at" },
          { id: "tok-4", text: "ang kaniyang mga mag-aaral" },
          { id: "tok-5", text: "ay" },
          { id: "tok-6", text: "pumupunta" },
          { id: "tok-7", text: "sa silid-aklatan" },
          { id: "tok-8", text: "kahapon nang umaga." },
        ],
      },
    },
    latest_revision: {
      id: "rev-q-err-1",
      revision: "rev-q-err-1",
      status: "published",
      created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
    },
  },
  {
    id: "55555555-eeee-4555-8555-555555555555",
    code: "q-word-salawikain",
    title: "Pagsasaayos ng mga Salita sa Salawikain",
    method: "word_arrangement",
    status: "published",
    verification_status: "verified",
    definition: {
      lesson_id: "f7777777-7777-4777-8777-777777777777",
      method: "word_arrangement",
      prompt: "Ayusin ang mga salita upang mabuo ang tamang salawikain:",
      instructions: "I-ayos ayon sa tamang pagkakasunod-sunod.",
      content: {
        items: [
          { id: "w-1", text: "Ang" },
          { id: "w-2", text: "karunungan" },
          { id: "w-3", text: "ay" },
          { id: "w-4", text: "tunay" },
          { id: "w-5", text: "na" },
          { id: "w-6", text: "kayamanan." },
        ],
      },
    },
    latest_revision: {
      id: "rev-q-word-1",
      revision: "rev-q-word-1",
      status: "published",
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
  },
  {
    id: "66666666-ffff-4666-8666-666666666666",
    code: "q-sent-banghay",
    title: "Pagsasaayos ng mga Pangungusap sa Banghay",
    method: "sentence_arrangement",
    status: "published",
    verification_status: "verified",
    definition: {
      lesson_id: "f6666666-6666-4666-8666-666666666666",
      method: "sentence_arrangement",
      prompt: "Ayusin ang mga pangyayari ayon sa tamang pagkakasunod-sunod sa kuwento:",
      instructions: "I-ayos mula simula hanggang wakas.",
      content: {
        items: [
          { id: "s-1", text: "Unang nakita ni Prinsipe Bantugan ang panganib sa kaharian ng Bumbaran." },
          { id: "s-2", text: "Buong tapang niyang hinarap ang mga kaaway gamit ang kaniyang mahiwagang kalasag." },
          { id: "s-3", text: "Nagbalik ang kapayapaan at sinalubong siya ng buong pamayanan nang may pagdiriwang." },
        ],
      },
    },
    latest_revision: {
      id: "rev-q-sent-1",
      revision: "rev-q-sent-1",
      status: "published",
      created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
  },
  {
    id: "77777777-aaaa-4777-8777-777777777777",
    code: "q-match-epiko",
    title: "Pagtutugma ng mga Epiko sa Rehiyon",
    method: "matching_type",
    status: "published",
    verification_status: "verified",
    definition: {
      lesson_id: "f6666666-6666-4666-8666-666666666666",
      method: "matching_type",
      prompt: "Itugma ang mga epiko sa kanilang pinagmulan:",
      instructions: "Pumili sa kaliwa at itugma sa kanan.",
      content: {
        left: [
          { id: "l-1", text: "Biag ni Lam-ang" },
          { id: "l-2", text: "Hudhud at Alim" },
          { id: "l-3", text: "Darangan" },
          { id: "l-4", text: "Hinilawod" },
        ],
        right: [
          { id: "r-1", text: "Ilokos" },
          { id: "r-2", text: "Cordillera" },
          { id: "r-3", text: "Mindanao" },
          { id: "r-4", text: "Panay" },
        ],
      },
    },
    latest_revision: {
      id: "rev-q-match-1",
      revision: "rev-q-match-1",
      status: "published",
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  },
  {
    id: "88888888-bbbb-4888-8888-888888888888",
    code: "q-ident-tayutay",
    title: "Pagtukoy sa Tayutay na Pagsasatao",
    method: "identification",
    status: "published",
    verification_status: "verified",
    definition: {
      lesson_id: "f7777777-7777-4777-8777-777777777777",
      method: "identification",
      prompt: "Ano ang tawag sa tayutay na nagbibigay ng katangian o gawi ng tao sa mga bagay na walang buhay?",
      instructions: "Isulat ang tamang sagot sa patlang.",
      content: {
        input_max_length: 60,
      },
    },
    latest_revision: {
      id: "rev-q-ident-1",
      revision: "rev-q-ident-1",
      status: "published",
      created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  },
  {
    id: "99999999-cccc-4999-8999-999999999999",
    code: "q-blank-tradisyon",
    title: "Pagpuno sa Patlang: Pasalitang Tradisyon",
    method: "fill_in_the_blank",
    status: "published",
    verification_status: "verified",
    definition: {
      lesson_id: "f6666666-6666-4666-8666-666666666666",
      method: "fill_in_the_blank",
      prompt: "Ang panitikan bago ang pananakop ay nagpapasalin-salin sa pamamagitan ng {{pasalitang_tradisyon}} mula sa mga ninuno.",
      instructions: "Punan ang patlang.",
      content: {
        blanks: [{ id: "pasalitang_tradisyon", prompt_label: "Uri ng tradisyon" }],
      },
    },
    latest_revision: {
      id: "rev-q-blank-1",
      revision: "rev-q-blank-1",
      status: "published",
      created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
  },
  {
    id: "00000000-dddd-4000-8000-000000000000",
    code: "q-flash-marikit",
    title: "Flashcard: Talasalitaan Marikit",
    method: "flashcards",
    status: "published",
    verification_status: "verified",
    definition: {
      lesson_id: "f7777777-7777-4777-8777-777777777777",
      method: "flashcards",
      prompt: "Talasalitaan: 'Marikit'",
      instructions: "Pindutin ang card upang makita ang kahulugan.",
      content: {
        cue: "Marikit",
      },
    },
    latest_revision: {
      id: "rev-q-flash-1",
      revision: "rev-q-flash-1",
      status: "published",
      created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    },
  },
];

export const DEMO_RESEARCH_STUDIES = [
  {
    id: "56ebb7d6-e282-4e96-9638-74beb3cccc22",
    code: "FLUENTT-EXP-TAG-2026",
    title: "Tagalog Vocabulary Acquisition & Retention via Spaced Repetition (SM-2 vs ESR)",
    target_language: "tagalog",
    protocol_version: "v1.2-irb-approved",
    status: "active",
    target_participants: 30,
    enrolled_count: 24,
    active_count: 22,
    withdrawn_count: 2,
    starts_at: "2026-09-01T00:00:00Z",
    ends_at: "2026-11-30T23:59:59Z",
    created_at: "2026-08-15T08:00:00Z",
  },
  {
    id: "88fbb7d6-e282-4e96-9638-74beb3cccc44",
    code: "FLUENTT-EXP-ENG-2026",
    title: "English Academic Vocabulary Acquisition & Pronunciation Fluency (SM-2 vs ESR)",
    target_language: "english",
    protocol_version: "v1.0-irb-approved",
    status: "approved",
    target_participants: 30,
    enrolled_count: 18,
    active_count: 17,
    withdrawn_count: 1,
    starts_at: "2026-10-01T00:00:00Z",
    ends_at: "2026-12-15T23:59:59Z",
    created_at: "2026-09-10T10:00:00Z",
  },
];

export const DEMO_RESEARCH_ANALYTICS = {
  study_id: "56ebb7d6-e282-4e96-9638-74beb3cccc22",
  study_code: "FLUENTT-EXP-TAG-2026",
  study_title: "Tagalog Vocabulary Acquisition & Retention via Spaced Repetition (SM-2 vs ESR)",
  target_language: "tagalog",
  protocol_version: "v1.2-irb-approved",
  flow: {
    target_participants: 30,
    total_enrolled: 24,
    allocated_control: 12,
    allocated_experimental: 12,
    active_in_progress: 22,
    completed_study: 16,
    total_withdrawn: 2,
    withdrawn_by_reason: {
      voluntary_withdrawal: 1,
      scheduling_conflict: 1,
    },
    completion_rate_pct: 66.67,
    dropout_rate_pct: 8.33,
  },
  assessments: [
    {
      assessment_id: "a1010101-1111-4111-8111-111111111111",
      kind: "pre_test",
      title: "Pre-Intervention Baseline Vocabulary Assessment",
      instrument_version: "tag-baseline-v1.0",
      maximum_possible: 10.0,
      control_stats: { count: 12, mean: 4.8, median: 5.0, std_dev: 1.35, min_value: 3.0, max_value: 7.0, mean_percentage: 48.0, is_small_cell: false },
      experimental_stats: { count: 12, mean: 4.75, median: 4.5, std_dev: 1.4, min_value: 2.0, max_value: 7.0, mean_percentage: 47.5, is_small_cell: false },
      overall_stats: { count: 24, mean: 4.78, median: 5.0, std_dev: 1.35, min_value: 2.0, max_value: 7.0, mean_percentage: 47.8, is_small_cell: false },
    },
    {
      assessment_id: "a2020202-2222-4222-8222-222222222222",
      kind: "learning_level",
      title: "Curriculum Progression Assessment (Level 2)",
      instrument_version: "tag-lvl2-v1.0",
      maximum_possible: 10.0,
      control_stats: { count: 10, mean: 7.1, median: 7.0, std_dev: 1.1, min_value: 5.0, max_value: 9.0, mean_percentage: 71.0, is_small_cell: false },
      experimental_stats: { count: 11, mean: 8.0, median: 8.0, std_dev: 0.95, min_value: 6.0, max_value: 10.0, mean_percentage: 80.0, is_small_cell: false },
      overall_stats: { count: 21, mean: 7.57, median: 7.5, std_dev: 1.12, min_value: 5.0, max_value: 10.0, mean_percentage: 75.7, is_small_cell: false },
    },
    {
      assessment_id: "a3030303-3333-4333-8333-333333333333",
      kind: "post_test",
      title: "Immediate Post-Intervention Assessment",
      instrument_version: "tag-post-v1.0",
      maximum_possible: 10.0,
      control_stats: { count: 8, mean: 7.9, median: 8.0, std_dev: 1.15, min_value: 6.0, max_value: 9.5, mean_percentage: 79.0, is_small_cell: false },
      experimental_stats: { count: 8, mean: 8.85, median: 9.0, std_dev: 0.95, min_value: 7.0, max_value: 10.0, mean_percentage: 88.5, is_small_cell: false },
      overall_stats: { count: 16, mean: 8.38, median: 8.5, std_dev: 1.15, min_value: 6.0, max_value: 10.0, mean_percentage: 83.8, is_small_cell: false },
    },
    {
      assessment_id: "a4040404-4444-4444-8444-444444444444",
      kind: "delayed_retention",
      title: "Delayed Retention Evaluation (14 Days Post-Study)",
      instrument_version: "tag-ret-v1.0",
      maximum_possible: 10.0,
      control_stats: { count: 4, mean: 6.8, median: 7.0, std_dev: 1.25, min_value: 5.0, max_value: 8.0, mean_percentage: 68.0, is_small_cell: true },
      experimental_stats: { count: 4, mean: 8.4, median: 8.5, std_dev: 1.05, min_value: 7.0, max_value: 9.5, mean_percentage: 84.0, is_small_cell: true },
      overall_stats: { count: 8, mean: 7.6, median: 7.5, std_dev: 1.4, min_value: 5.0, max_value: 9.5, mean_percentage: 76.0, is_small_cell: false },
    },
    {
      assessment_id: "a5050505-5555-4555-8555-555555555555",
      kind: "pronunciation",
      title: "Automated Pronunciation & Acoustic Assessment",
      instrument_version: "tag-pron-v1.0",
      maximum_possible: 10.0,
      control_stats: { count: 6, mean: 7.2, median: 7.0, std_dev: 1.1, min_value: 5.5, max_value: 8.5, mean_percentage: 72.0, is_small_cell: false },
      experimental_stats: { count: 7, mean: 8.1, median: 8.0, std_dev: 0.9, min_value: 6.8, max_value: 9.4, mean_percentage: 81.0, is_small_cell: false },
      overall_stats: { count: 13, mean: 7.68, median: 7.8, std_dev: 1.08, min_value: 5.5, max_value: 9.4, mean_percentage: 76.8, is_small_cell: false },
    },
  ],
  paired: {
    absolute_gain_control: { count: 8, mean: 3.1, median: 3.0, std_dev: 0.95, min_value: 1.5, max_value: 4.5, is_small_cell: false },
    absolute_gain_experimental: { count: 8, mean: 4.1, median: 4.0, std_dev: 0.85, min_value: 2.5, max_value: 5.5, is_small_cell: false },
    normalized_gain_control: { count: 8, mean: 0.6, median: 0.58, std_dev: 0.16, min_value: 0.35, max_value: 0.85, is_small_cell: false },
    normalized_gain_experimental: { count: 8, mean: 0.78, median: 0.79, std_dev: 0.12, min_value: 0.55, max_value: 0.95, is_small_cell: false },
    retention_loss_control: { count: 4, mean: 1.1, median: 1.0, std_dev: 0.35, min_value: 0.5, max_value: 1.5, is_small_cell: true },
    retention_loss_experimental: { count: 4, mean: 0.45, median: 0.5, std_dev: 0.25, min_value: 0.0, max_value: 0.8, is_small_cell: true },
  },
  engagement_control: {
    total_review_events: 340,
    active_learners: 12,
    mean_reviews_per_learner: 28.3,
    retention_accuracy_pct: 78.5,
    mean_duration_ms: 2950,
    total_lapses: 42,
    rating_counts: { again: 42, hard: 68, good: 160, easy: 70 },
  },
  engagement_experimental: {
    total_review_events: 365,
    active_learners: 12,
    mean_reviews_per_learner: 30.4,
    retention_accuracy_pct: 88.2,
    mean_duration_ms: 2400,
    total_lapses: 18,
    rating_counts: { again: 18, hard: 45, good: 192, easy: 110 },
  },
  data_integrity_notice: "Descriptive reporting directly reflects actual participant records. No unverified inferential claims (p-values, effect sizes) or artificial conclusions are asserted. Cells with N < 5 are flagged for privacy protection per educational research standards.",
  ethics_disclaimer: "All participants enrolled under institutional ethics protocol IRB-2026-FL-001. Consent and assent records are strictly tracked; identity links are pseudonymized and isolated from learning telemetry.",
};

export const DEMO_PARTICIPANTS_CSV = `participant_code,study_code,condition,enrollment_status,enrolled_at,withdrawn_at,withdrawal_reason,pre_test_score,level_tests_completed,post_test_score,delayed_retention_score,pronunciation_score,absolute_learning_gain,normalized_learning_gain,retention_loss
P-TAG-001001,FLUENTT-EXP-TAG-2026,esr_experimental,enrolled,2026-09-02T08:00:00Z,,,4.5,2,9.0,8.5,8.8,4.5,0.82,0.5
P-TAG-001002,FLUENTT-EXP-TAG-2026,sm2_control,enrolled,2026-09-02T08:15:00Z,,,5.0,2,8.0,7.0,7.2,3.0,0.60,1.0
P-TAG-001003,FLUENTT-EXP-TAG-2026,esr_experimental,enrolled,2026-09-02T08:30:00Z,,,4.0,2,8.5,8.0,8.2,4.5,0.75,0.5
P-TAG-001004,FLUENTT-EXP-TAG-2026,sm2_control,enrolled,2026-09-02T08:45:00Z,,,5.5,2,7.5,6.5,7.0,2.0,0.44,1.0
`;

export const DEMO_ASSESSMENTS_CSV = `result_id,participant_code,study_code,condition,assessment_kind,assessment_title,instrument_version,attempt_number,status,score,maximum_score,percentage,response_duration_ms,completed_at
res-001,P-TAG-001001,FLUENTT-EXP-TAG-2026,esr_experimental,pre_test,Pre-Intervention Baseline Vocabulary Assessment,tag-baseline-v1.0,1,completed,4.5,10.0,45.0,32000,2026-09-03T09:00:00Z
res-002,P-TAG-001001,FLUENTT-EXP-TAG-2026,esr_experimental,post_test,Immediate Post-Intervention Assessment,tag-post-v1.0,1,completed,9.0,10.0,90.0,28000,2026-09-28T14:00:00Z
res-003,P-TAG-001002,FLUENTT-EXP-TAG-2026,sm2_control,pre_test,Pre-Intervention Baseline Vocabulary Assessment,tag-baseline-v1.0,1,completed,5.0,10.0,50.0,35000,2026-09-03T09:15:00Z
res-004,P-TAG-001002,FLUENTT-EXP-TAG-2026,sm2_control,post_test,Immediate Post-Intervention Assessment,tag-post-v1.0,1,completed,8.0,10.0,80.0,31000,2026-09-28T14:30:00Z
`;

export const DEMO_REVIEWS_CSV = `event_id,participant_code,study_code,condition,vocabulary_term,vocabulary_language,recall_rating,is_correct,response_duration_ms,previous_interval_days,resulting_interval_days,reviewed_at
rev-001,P-TAG-001001,FLUENTT-EXP-TAG-2026,esr_experimental,aklat,tagalog,good,true,2200,1.0,3.5,2026-09-04T10:00:00Z
rev-002,P-TAG-001001,FLUENTT-EXP-TAG-2026,esr_experimental,mesa,tagalog,easy,true,1800,2.0,6.0,2026-09-04T10:01:00Z
rev-003,P-TAG-001002,FLUENTT-EXP-TAG-2026,sm2_control,aklat,tagalog,hard,true,3400,1.0,2.2,2026-09-04T10:15:00Z
rev-004,P-TAG-001002,FLUENTT-EXP-TAG-2026,sm2_control,mesa,tagalog,again,false,4100,2.0,1.0,2026-09-04T10:16:00Z
`;

