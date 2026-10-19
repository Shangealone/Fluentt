import type { ClassDetails, ClassDraft, ClassUpdate, ClassAccess } from "../services/api/classes";
import type { EnrollmentAccess, ClassPreview, Membership, Confirmation } from "../services/api/enrollment";
import type { AssignmentDraft, AssignmentItem, AssignmentSummary, PublishedAssignment, LessonContext, AssignmentAccess, AssignmentPage } from "../services/api/assignments";
import type { Attempt, CaptureAccess, CaptureItem, Progress, RevealedBack } from "../services/api/capture";
import type { AssessmentResult, ResultsAccess, Submission, Evaluation } from "../services/api/results";
import type { ProgressSummary, ProgressClass, ProgressAccess, HistoryItem, LearningHistory } from "../services/api/progress";
import type { MonitoringAccess, Overview, MonitoredStudent, MonitoredAssignment, StudentDetail, AssignmentDetail, ContextOption } from "../services/api/monitoring";
import type { CommunicationAccess, CommunicationContext, Message, Person, CommunicationClass } from "../services/api/communications";
import type { Profile } from "../services/api/identity";

// Stable 64-character hex revision strings
export const DEMO_REVISION = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
export const DEMO_REVISION_2 = "b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1";

// Demo Profiles
export const DEMO_PROFILES: Record<"instructor" | "student" | "personal", Profile> = {
  instructor: {
    id: "demo-user-instructor-01",
    username: "guro_santos",
    canonical_username: "guro_santos",
    role: "instructor",
    profile_status: "active",
    onboarding_step: null,
    grade: null,
    language: null,
  },
  student: {
    id: "demo-user-student-01",
    username: "juan_delacruz",
    canonical_username: "juan_delacruz",
    role: "school_student",
    profile_status: "active",
    onboarding_step: null,
    grade: null,
    language: null,
  },
  personal: {
    id: "demo-user-personal-01",
    username: "maria_clara",
    canonical_username: "maria_clara",
    role: "personal_student",
    profile_status: "active",
    onboarding_step: null,
    grade: 7,
    language: "tagalog",
    learning_focus: { topics: ["Vocabulary", "Reading comprehension"], lessons: ["Writing a paragraph"] },
  },
};

// Demo Classrooms
export const DEMO_CLASSES: ClassDetails[] = [
  {
    id: "demo-class-1",
    class_name: "Baitang 7 - Mabini",
    grade_level: 7,
    language: "tagalog",
    description: "Seksyon Mabini para sa Filipino 7 — Panitikan ng Pilipinas at Gramatika",
    join_code: "782041",
    status: "active",
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "demo-class-2",
    class_name: "Grade 8 - Rizal",
    grade_level: 8,
    language: "english",
    description: "English Communication Arts and Afro-Asian Literature",
    join_code: "519302",
    status: "active",
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

// Demo Lesson Context
export const DEMO_LESSON_CONTEXT: LessonContext = {
  lesson_id: "demo-lesson-1",
  lesson_name: "Mga Akdang Pampanitikan: Salamin ng Mindanao",
  curriculum_version_id: "demo-curriculum-v1",
  curriculum_name: "DepEd K to 12 Matatag Curriculum v2026",
  grade: 7,
  subject_id: "demo-subject-filipino",
  subject_name: "Filipino",
};

// Demo 10 Questions Covering ALL 10 Fluentt Assessment Methods
export const DEMO_ASSIGNMENT_ITEMS: AssignmentItem[] = [
  {
    id: "demo-qrev-1",
    question_id: "demo-q-1",
    version: 1,
    eligible: true,
    definition: {
      lesson_id: "demo-lesson-1",
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
  },
  {
    id: "demo-qrev-2",
    question_id: "demo-q-2",
    version: 1,
    eligible: true,
    definition: {
      lesson_id: "demo-lesson-1",
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
  },
  {
    id: "demo-qrev-3",
    question_id: "demo-q-3",
    version: 1,
    eligible: true,
    definition: {
      lesson_id: "demo-lesson-1",
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
  },
  {
    id: "demo-qrev-4",
    question_id: "demo-q-4",
    version: 1,
    eligible: true,
    definition: {
      lesson_id: "demo-lesson-1",
      method: "error_identification",
      prompt: "Piliin ang salita o parirala na naglalaman ng maling gramatika sa pangungusap:",
      instructions: "Pindutin ang maling salita.",
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
  },
  {
    id: "demo-qrev-5",
    question_id: "demo-q-5",
    version: 1,
    eligible: true,
    definition: {
      lesson_id: "demo-lesson-1",
      method: "word_arrangement",
      prompt: "Ayusin ang mga salita upang mabuo ang isang makabuluhang salawikain:",
      instructions: "Pindutin ang mga salita ayon sa wastong pagkakasunod-sunod.",
      content: {
        items: [
          { id: "word-1", text: "Ang" },
          { id: "word-2", text: "karunungan" },
          { id: "word-3", text: "ay" },
          { id: "word-4", text: "tunay" },
          { id: "word-5", text: "na" },
          { id: "word-6", text: "kayamanan." },
        ],
      },
    },
  },
  {
    id: "demo-qrev-6",
    question_id: "demo-q-6",
    version: 1,
    eligible: true,
    definition: {
      lesson_id: "demo-lesson-1",
      method: "sentence_arrangement",
      prompt: "Ayusin ang mga pangyayari ayon sa tamang pagkakasunod-sunod sa kuwento:",
      instructions: "I-ayos ang mga pangungusap mula simula hanggang wakas.",
      content: {
        items: [
          { id: "sent-1", text: "Unang nakita ni Prinsipe Bantugan ang panganib sa kaharian ng Bumbaran." },
          { id: "sent-2", text: "Buong tapang niyang hinarap ang mga kaaway gamit ang kaniyang mahiwagang kalasag." },
          { id: "sent-3", text: "Nagbalik ang kapayapaan at sinalubong siya ng buong pamayanan nang may pagdiriwang." },
        ],
      },
    },
  },
  {
    id: "demo-qrev-7",
    question_id: "demo-q-7",
    version: 1,
    eligible: true,
    definition: {
      lesson_id: "demo-lesson-1",
      method: "matching_type",
      prompt: "Itugma ang mga tanyag na epiko ng Pilipinas sa kanilang rehiyon o pangkat:",
      instructions: "Pumili ng aytem sa kaliwa, pagkatapos ay piliin ang katugma sa kanan.",
      content: {
        left: [
          { id: "m-l-1", text: "Biag ni Lam-ang" },
          { id: "m-l-2", text: "Hudhud at Alim" },
          { id: "m-l-3", text: "Darangan / Bantugan" },
          { id: "m-l-4", text: "Hinilawod" },
        ],
        right: [
          { id: "m-r-1", text: "Ilokos" },
          { id: "m-r-2", text: "Ifugao / Cordillera" },
          { id: "m-r-3", text: "Maranao / Mindanao" },
          { id: "m-r-4", text: "Panay / Visayas" },
        ],
      },
    },
  },
  {
    id: "demo-qrev-8",
    question_id: "demo-q-8",
    version: 1,
    eligible: true,
    definition: {
      lesson_id: "demo-lesson-1",
      method: "identification",
      prompt: "Ano ang tawag sa tayutay na nagbibigay ng katangian o gawi ng tao sa mga bagay na walang buhay?",
      instructions: "Isulat ang tamang sagot sa patlang (Hal. Pagsasatao o Personipikasyon).",
      content: {
        input_max_length: 50,
      },
    },
  },
  {
    id: "demo-qrev-9",
    question_id: "demo-q-9",
    version: 1,
    eligible: true,
    definition: {
      lesson_id: "demo-lesson-1",
      method: "fill_in_the_blank",
      prompt: "Ang panitikang Pilipino bago dumating ang mga Espanyol ay kadalasang nagpapasalin-salin sa pamamagitan ng {{pasalitang_tradisyon}} mula sa mga ninuno.",
      instructions: "Punan ang patlang upang mabuo ang diwa ng pahayag.",
      content: {
        blanks: [
          { id: "pasalitang_tradisyon", prompt_label: "Uri ng tradisyon" },
        ],
      },
    },
  },
  {
    id: "demo-qrev-10",
    question_id: "demo-q-10",
    version: 1,
    eligible: true,
    definition: {
      lesson_id: "demo-lesson-1",
      method: "flashcards",
      prompt: "Talasalitaan: 'Marikit'",
      instructions: "Pindutin ang card upang makita ang kahulugan.",
      content: {
        cue: "Marikit",
      },
    },
  },
];

// Capture questions representation for student attempt
export const DEMO_CAPTURE_ITEMS: CaptureItem[] = DEMO_ASSIGNMENT_ITEMS.map((item, idx) => ({
  ...item,
  assignment_question_id: `demo-aq-${idx + 1}`,
}));

// Published Assignment
export const DEMO_PUBLISHED_ASSIGNMENT: PublishedAssignment = {
  id: "demo-pub-1",
  class_id: "demo-class-1",
  version_id: "demo-pub-ver-1",
  title: "Pagsusulit sa Panitikan at Gramatika (Unang Markahan)",
  instructions: "Sagutan ang lahat ng 10 aytem. Suriin nang mabuti ang bawat tanong bago magpasa.",
  context: DEMO_LESSON_CONTEXT,
  status: "published",
  published_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  question_count: 10,
  methods: [
    "multiple_choice",
    "true_false",
    "multiple_select",
    "error_identification",
    "word_arrangement",
    "sentence_arrangement",
    "matching_type",
    "identification",
    "fill_in_the_blank",
    "flashcards",
  ],
};

// Draft Assignment
export const DEMO_DRAFT_ASSIGNMENT: AssignmentDraft = {
  id: "demo-draft-1",
  class_id: "demo-class-1",
  version_id: "demo-draft-ver-1",
  revision: DEMO_REVISION,
  status: "draft",
  title: "Bokabularyo at Tayutay (Pagsasanay)",
  instructions: "Maikling pagsasanay ukol sa pagpapalawak ng talasalitaan.",
  context: DEMO_LESSON_CONTEXT,
  questions: DEMO_ASSIGNMENT_ITEMS.slice(0, 5),
  eligible: true,
  editable: true,
  requires_subject: false,
};

// Student Attempt State
export const DEMO_STUDENT_ATTEMPT: Attempt = {
  id: "demo-attempt-1",
  assignment_id: "demo-pub-1",
  class_id: "demo-class-1",
  version_id: "demo-pub-ver-1",
  title: "Pagsusulit sa Panitikan at Gramatika (Unang Markahan)",
  instructions: "Sagutan ang lahat ng 10 aytem. Suriin nang mabuti ang bawat tanong bago magpasa.",
  status: "in_progress",
  revision: DEMO_REVISION,
  started_at: new Date(Date.now() - 3600000).toISOString(),
  submitted_at: null,
  position: 1,
  question_count: 10,
  completed_count: 7,
  questions: DEMO_CAPTURE_ITEMS,
  responses: [
    { assignment_question_id: "demo-aq-1", answer: { selected_option_id: "opt-2" } },
    { assignment_question_id: "demo-aq-2", answer: { selected_option_id: "opt-t" } },
    { assignment_question_id: "demo-aq-3", answer: { selected_ids: ["opt-ms-1", "opt-ms-2", "opt-ms-4"] } },
    { assignment_question_id: "demo-aq-4", answer: { selected_id: "tok-6" } },
    { assignment_question_id: "demo-aq-5", answer: { ordered_ids: ["word-1", "word-2", "word-3", "word-4", "word-5", "word-6"] } },
    { assignment_question_id: "demo-aq-6", answer: { ordered_ids: ["sent-1", "sent-2", "sent-3"] } },
    { assignment_question_id: "demo-aq-7", answer: { pairs: [
      { left_id: "m-l-1", right_id: "m-r-1" },
      { left_id: "m-l-2", right_id: "m-r-2" },
      { left_id: "m-l-3", right_id: "m-r-3" },
      { left_id: "m-l-4", right_id: "m-r-4" },
    ] } },
  ],
  revealed_item_ids: ["demo-aq-10"],
};

// Evaluation
export const DEMO_EVALUATION: Evaluation = {
  id: "demo-eval-1",
  status: "COMPLETE",
  engine_version: "objective-exact-v1",
  policy_version: "pure-objective-v1",
  evaluated_at: new Date(Date.now() - 1800000).toISOString(),
};

// Released Assessment Results for Student Juan dela Cruz
export const DEMO_STUDENT_RESULT: AssessmentResult = {
  assignment_id: "demo-pub-1",
  class_id: "demo-class-1",
  version_id: "demo-pub-ver-1",
  title: "Pagsusulit sa Panitikan at Gramatika (Unang Markahan)",
  attempt_id: "demo-attempt-1",
  student_id: "demo-user-student-01",
  student_username: "juan_delacruz",
  submitted_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  submission_status: "submitted",
  state: "released",
  released: true,
  revision: DEMO_REVISION,
  pinned_run_id: "demo-eval-1",
  evaluation: DEMO_EVALUATION,
  earned_points: "8.00",
  possible_points: "9.00",
  items: DEMO_ASSIGNMENT_ITEMS.map((item, idx) => {
    const isFlashcard = item.definition.method === "flashcards";
    const isErrorIdent = item.definition.method === "error_identification";
    return {
      result_id: `demo-res-item-${idx + 1}`,
      assignment_question_id: `demo-aq-${idx + 1}`,
      question_revision_id: item.id,
      response_id: `demo-resp-${idx + 1}`,
      position: idx + 1,
      question: item,
      answer: { recorded: true },
      state: isFlashcard ? "NOT_APPLICABLE" : "AUTO_GRADABLE",
      correct: isFlashcard ? null : isErrorIdent ? false : true,
      awarded_points: isFlashcard ? "0.00" : isErrorIdent ? "0.00" : "1.00",
      max_points: isFlashcard ? "0.00" : "1.00",
    };
  }),
};

// Submissions for Instructor
export const DEMO_SUBMISSIONS: Submission[] = [
  {
    attempt_id: "demo-attempt-1",
    student_id: "demo-user-student-01",
    student_username: "juan_delacruz",
    submitted_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    attempt_id: "demo-attempt-2",
    student_id: "demo-user-student-02",
    student_username: "maria_clara",
    submitted_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    attempt_id: "demo-attempt-3",
    student_id: "demo-user-student-03",
    student_username: "crisostomo_ibarra",
    submitted_at: new Date(Date.now() - 12 * 3600000).toISOString(),
  },
];

// Progress Summary for Student
export const DEMO_PROGRESS_SUMMARY: ProgressSummary = {
  availability: "available",
  as_of: new Date().toISOString(),
  class_id: "demo-class-1",
  class_name: "Baitang 7 - Mabini",
  class_count: 1,
  counts: {
    available: 2,
    not_started: 0,
    in_progress: 0,
    submitted: 2,
    pending: 0,
  },
  policy_version: "submission-counts-v1",
};

export const DEMO_PROGRESS_CLASSES: ProgressClass[] = [
  {
    id: "demo-class-1",
    class_name: "Baitang 7 - Mabini",
    grade: 7,
    language: "tagalog",
  },
];

// Learning History items
export const DEMO_HISTORY_ITEMS: HistoryItem[] = [
  {
    id: "demo-pub-1",
    version_id: "demo-pub-ver-1",
    title: "Pagsusulit sa Panitikan at Gramatika (Unang Markahan)",
    class_id: "demo-class-1",
    class_name: "Baitang 7 - Mabini",
    language: "tagalog",
    context: DEMO_LESSON_CONTEXT,
    published_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    started_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    last_activity_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    submission_status: "submitted",
    submitted_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    sort_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    result_state: "released",
    attempt_id: "demo-attempt-1",
    released_run_id: "demo-eval-1",
    policy_version: "pure-objective-v1",
    earned_points: "8.00",
    possible_points: "9.00",
  },
];

// Monitoring Overview
export const DEMO_MONITORING_OVERVIEW: Overview = {
  classroom: {
    id: "demo-class-1",
    class_name: "Baitang 7 - Mabini",
    grade: 7,
    language: "tagalog",
  },
  as_of: new Date().toISOString(),
  available_assignments: 2,
  eligible_students: 24,
  counts: {
    available: 48,
    not_started: 6,
    in_progress: 6,
    submitted: 36,
    pending: 12,
  },
  results: {
    awaiting_evaluation: 2,
    awaiting_manual_review: 0,
    withheld: 0,
    released: 34,
    not_applicable: 0,
  },
  progress_policy: "submission-counts-v1",
};

// Monitored Students List
export const DEMO_MONITORED_STUDENTS: MonitoredStudent[] = [
  {
    id: "demo-user-student-01",
    username: "juan_delacruz",
    counts: { available: 2, not_started: 0, in_progress: 0, submitted: 2, pending: 0 },
    results: { awaiting_evaluation: 0, awaiting_manual_review: 0, withheld: 0, released: 2, not_applicable: 0 },
  },
  {
    id: "demo-user-student-02",
    username: "maria_clara",
    counts: { available: 2, not_started: 0, in_progress: 0, submitted: 2, pending: 0 },
    results: { awaiting_evaluation: 0, awaiting_manual_review: 0, withheld: 0, released: 2, not_applicable: 0 },
  },
  {
    id: "demo-user-student-03",
    username: "crisostomo_ibarra",
    counts: { available: 2, not_started: 0, in_progress: 1, submitted: 1, pending: 1 },
    results: { awaiting_evaluation: 1, awaiting_manual_review: 0, withheld: 0, released: 0, not_applicable: 0 },
  },
];

// Monitored Assignments List
export const DEMO_MONITORED_ASSIGNMENTS: MonitoredAssignment[] = [
  {
    id: "demo-pub-1",
    version_id: "demo-pub-ver-1",
    title: "Pagsusulit sa Panitikan at Gramatika (Unang Markahan)",
    context: DEMO_LESSON_CONTEXT,
    published_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    counts: { available: 24, not_started: 2, in_progress: 2, submitted: 20, pending: 4 },
    results: { awaiting_evaluation: 1, awaiting_manual_review: 0, withheld: 0, released: 19, not_applicable: 0 },
    mean: {
      status: "available",
      eligible_results: 19,
      mean_points: "8.25",
      max_points: "9.00",
      engine_version: "objective-exact-v1",
      policy_version: "pure-objective-v1",
      mean_policy: "released-assignment-mean-v1",
    },
  },
];

// Communication Context & Messages
export const DEMO_COMMUNICATION_CONTEXT: CommunicationContext = {
  classroom: { id: "demo-class-1", class_name: "Baitang 7 - Mabini" },
  instructor: { id: "demo-user-instructor-01", username: "guro_santos" },
  viewer: { id: "demo-user-instructor-01", username: "guro_santos" },
  peer: null,
  role: "instructor",
};

export const DEMO_MESSAGES: Message[] = [
  {
    id: "demo-msg-1",
    class_id: "demo-class-1",
    kind: "announcement",
    sender: { id: "demo-user-instructor-01", username: "guro_santos" },
    recipient_id: null,
    content: "Magandang araw sa ating klase! Paalala na ang ating Pagsusulit sa Panitikan at Gramatika ay bukas na. Siguraduhing makapagpasa bago mag-Biyernes.",
    sent_at: new Date(Date.now() - 86400000).toISOString(),
    read: true,
  },
  {
    id: "demo-msg-2",
    class_id: "demo-class-1",
    kind: "announcement",
    sender: { id: "demo-user-instructor-01", username: "guro_santos" },
    recipient_id: null,
    content: "Para sa ating talakayan bukas: basahin ang kuwento ni Prinsipe Bantugan sa pahina 42-48 ng inyong aklat.",
    sent_at: new Date(Date.now() - 43200000).toISOString(),
    read: true,
  },
  {
    id: "demo-msg-3",
    class_id: "demo-class-1",
    kind: "direct",
    sender: { id: "demo-user-student-01", username: "juan_delacruz" },
    recipient_id: "demo-user-instructor-01",
    content: "Magandang hapon po Guro Santos, may tanong po ako tungkol sa ikapitong aytem sa pagtutugma ng mga epiko.",
    sent_at: new Date(Date.now() - 7200000).toISOString(),
    read: true,
  },
  {
    id: "demo-msg-4",
    class_id: "demo-class-1",
    kind: "direct",
    sender: { id: "demo-user-instructor-01", username: "guro_santos" },
    recipient_id: "demo-user-student-01",
    content: "Maaari mong balikan ang talahanayan sa Aralin 1 para sa mga katutubong pangkat ng bawat epiko, Juan.",
    sent_at: new Date(Date.now() - 3600000).toISOString(),
    read: true,
  },
];

// In-Memory mutable store for interactive Demo sessions
class DemoDataStore {
  classes = [...DEMO_CLASSES];
  drafts: AssignmentDraft[] = [DEMO_DRAFT_ASSIGNMENT];
  published: PublishedAssignment[] = [DEMO_PUBLISHED_ASSIGNMENT];
  attempt: Attempt = { ...DEMO_STUDENT_ATTEMPT };
  result: AssessmentResult = { ...DEMO_STUDENT_RESULT };
  messages: Message[] = [...DEMO_MESSAGES];

  reset() {
    this.classes = [...DEMO_CLASSES];
    this.drafts = [DEMO_DRAFT_ASSIGNMENT];
    this.published = [DEMO_PUBLISHED_ASSIGNMENT];
    this.attempt = { ...DEMO_STUDENT_ATTEMPT };
    this.result = { ...DEMO_STUDENT_RESULT };
    this.messages = [...DEMO_MESSAGES];
  }
}

export const demoStore = new DemoDataStore();

// Demo API Access Implementations
export function createDemoClassesApi(): ClassAccess {
  return {
    async create(draft: ClassDraft, _key?: string) {
      const newClass: ClassDetails = {
        id: `demo-class-${Date.now()}`,
        class_name: draft.class_name,
        grade_level: draft.grade_level,
        language: draft.language,
        description: draft.description,
        join_code: String(Math.floor(100000 + Math.random() * 900000)),
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      demoStore.classes.unshift(newClass);
      return newClass;
    },
    async mine() {
      return [...demoStore.classes];
    },
    async get(id: string) {
      const found = demoStore.classes.find(c => c.id === id);
      return found ?? demoStore.classes[0];
    },
    async update(id: string, update: ClassUpdate) {
      const idx = demoStore.classes.findIndex(c => c.id === id);
      if (idx >= 0) {
        demoStore.classes[idx] = {
          ...demoStore.classes[idx],
          ...update,
          updated_at: new Date().toISOString(),
        };
        return demoStore.classes[idx];
      }
      return demoStore.classes[0];
    },
  };
}

export function createDemoEnrollmentApi(): EnrollmentAccess {
  return {
    async preview(code: string): Promise<ClassPreview> {
      return {
        class_name: "Baitang 7 - Mabini",
        grade_level: 7,
        language: "tagalog",
        instructor_display_name: "Guro Santos",
        class_version: DEMO_REVISION,
      };
    },
    async confirm(body: Confirmation): Promise<Membership> {
      return {
        id: "11111111-1111-4111-8111-111111111111",
        class_id: "22222222-2222-4222-8222-222222222222",
        class_name: "Baitang 7 - Mabini",
        grade_level: 7,
        language: "tagalog",
        instructor_display_name: "Guro Santos",
        status: "active",
        joined_at: new Date().toISOString(),
      };
    },
    async mine(offset = 0): Promise<Membership[]> {
      return [
        {
          id: "11111111-1111-4111-8111-111111111111",
          class_id: "22222222-2222-4222-8222-222222222222",
          class_name: "Baitang 7 - Mabini",
          grade_level: 7,
          language: "tagalog",
          instructor_display_name: "Guro Santos",
          status: "active",
          joined_at: new Date().toISOString(),
        },
      ];
    },
  };
}

export function createDemoAssignmentApi(): AssignmentAccess {
  return {
    async list(classId: string) {
      const items: AssignmentSummary[] = [
        {
          id: demoStore.published[0].id,
          class_id: classId,
          title: demoStore.published[0].title,
          status: "published",
          context: demoStore.published[0].context,
          question_count: demoStore.published[0].question_count,
        },
        ...demoStore.drafts.map(d => ({
          id: d.id,
          class_id: classId,
          title: d.title,
          status: d.status,
          context: d.context,
          question_count: d.questions.length,
        })),
      ];
      return { items, has_more: false, offset: 0, limit: 20 };
    },
    async get(id: string) {
      const found = demoStore.drafts.find(d => d.id === id);
      return found ?? demoStore.drafts[0];
    },
    async lessons() {
      return { items: [DEMO_LESSON_CONTEXT], has_more: false, offset: 0, limit: 20 };
    },
    async questions() {
      return { items: DEMO_ASSIGNMENT_ITEMS, has_more: false, offset: 0, limit: 20 };
    },
    async create(classId, body) {
      const created: AssignmentDraft = {
        id: `demo-draft-${Date.now()}`,
        class_id: classId,
        version_id: `demo-ver-${Date.now()}`,
        revision: DEMO_REVISION,
        status: "draft",
        title: body.title,
        instructions: body.instructions,
        context: DEMO_LESSON_CONTEXT,
        questions: DEMO_ASSIGNMENT_ITEMS.slice(0, 3),
        eligible: true,
        editable: true,
        requires_subject: false,
      };
      demoStore.drafts.unshift(created);
      return created;
    },
    async save(row, body) {
      const idx = demoStore.drafts.findIndex(d => d.id === row.id);
      if (idx >= 0) {
        demoStore.drafts[idx] = { ...demoStore.drafts[idx], title: body.title, instructions: body.instructions };
        return demoStore.drafts[idx];
      }
      return row;
    },
    async archive(row) {
      const idx = demoStore.drafts.findIndex(d => d.id === row.id);
      if (idx >= 0) demoStore.drafts[idx].status = "archived";
      return { ...row, status: "archived" };
    },
    async publish(row) {
      const idx = demoStore.drafts.findIndex(d => d.id === row.id);
      if (idx >= 0) demoStore.drafts[idx].status = "published";
      return { ...row, status: "published" };
    },
    async published() {
      return { items: demoStore.published, has_more: false, offset: 0, limit: 20 };
    },
    async publishedDetail(id: string) {
      const found = demoStore.published.find(p => p.id === id);
      return found ?? demoStore.published[0];
    },
  };
}

export function createDemoCaptureApi(): CaptureAccess {
  return {
    async start() {
      return { ...demoStore.attempt };
    },
    async read() {
      return { ...demoStore.attempt };
    },
    async save(row, body: Progress) {
      demoStore.attempt = {
        ...demoStore.attempt,
        position: body.position,
        responses: body.responses,
        completed_count: body.responses.length,
      };
      return { ...demoStore.attempt };
    },
    async submit(row, body: Progress) {
      demoStore.attempt = {
        ...demoStore.attempt,
        status: "submitted",
        submitted_at: new Date().toISOString(),
        position: body.position,
        responses: [],
        questions: [],
      };
      return { ...demoStore.attempt };
    },
    async reveal(row, item) {
      return {
        revision_id: item.id,
        back: "Kahulugan: Maganda, kaakit-akit, o marilag. Halimbawa: 'Ang marikit na paraluman ay hinangaan ng marami.'",
        attempt_revision: DEMO_REVISION_2,
      };
    },
  };
}

export function createDemoResultsApi(): ResultsAccess {
  return {
    async student() {
      return { ...demoStore.result };
    },
    async submissions() {
      return { items: DEMO_SUBMISSIONS, has_more: false, offset: 0, limit: 20 };
    },
    async owner(attemptId: string) {
      return {
        ...demoStore.result,
        attempt_id: attemptId,
      };
    },
    async evaluations() {
      return { items: [DEMO_EVALUATION], has_more: false, offset: 0, limit: 10 };
    },
    async release(row, released) {
      demoStore.result = {
        ...demoStore.result,
        released,
        state: released ? "released" : "withheld",
      };
      return { ...demoStore.result };
    },
  };
}

export function createDemoMonitoringApi(): MonitoringAccess {
  return {
    async classes() {
      return {
        items: [
          {
            id: "demo-class-1",
            class_name: "Baitang 7 - Mabini",
            grade: 7,
            language: "tagalog" as const,
          },
        ],
        has_more: false,
        offset: 0,
        limit: 20,
      };
    },
    async overview() {
      return DEMO_MONITORING_OVERVIEW;
    },
    async contexts(id, kind) {
      return {
        items: [
          { id: "demo-lesson-1", label: "Aralin 1: Panitikan ng Mindanao" },
          { id: "demo-lesson-2", label: "Aralin 2: Epiko at Kuwentong-Bayan" },
        ],
        has_more: false,
        offset: 0,
        limit: 20,
      };
    },
    async students() {
      return { items: DEMO_MONITORED_STUDENTS, has_more: false, offset: 0, limit: 20 };
    },
    async assignments() {
      return { items: DEMO_MONITORED_ASSIGNMENTS, has_more: false, offset: 0, limit: 20 };
    },
    async student() {
      return {
        items: DEMO_HISTORY_ITEMS,
        has_more: false,
        offset: 0,
        limit: 20,
        summary: DEMO_MONITORED_STUDENTS[0],
        overview: DEMO_MONITORING_OVERVIEW,
      };
    },
    async assignment() {
      return {
        items: [
          {
            id: "demo-user-student-01",
            username: "juan_delacruz",
            submission_status: "submitted",
            result_state: "released",
            attempt_id: "demo-attempt-1",
            submitted_at: new Date(Date.now() - 2 * 86400000).toISOString(),
            released_run_id: "demo-eval-1",
            earned_points: "8.00",
            possible_points: "9.00",
          },
        ],
        has_more: false,
        offset: 0,
        limit: 20,
        summary: DEMO_MONITORED_ASSIGNMENTS[0],
        overview: DEMO_MONITORING_OVERVIEW,
      };
    },
  };
}

export function createDemoProgressApi(): ProgressAccess {
  return {
    async summary() {
      return DEMO_PROGRESS_SUMMARY;
    },
    async classes() {
      return {
        items: DEMO_PROGRESS_CLASSES,
        has_more: false,
        offset: 0,
        limit: 20,
      };
    },
    async history() {
      return {
        availability: "available",
        as_of: new Date().toISOString(),
        items: DEMO_HISTORY_ITEMS,
        has_more: false,
        offset: 0,
        limit: 20,
      };
    },
  };
}

export function createDemoCommunicationApi(): CommunicationAccess {
  return {
    async classes() {
      return {
        items: [{ id: "demo-class-1", class_name: "Baitang 7 - Mabini" }],
        has_more: false,
        offset: 0,
        limit: 20,
        as_of: new Date().toISOString(),
      };
    },
    async context() {
      return DEMO_COMMUNICATION_CONTEXT;
    },
    async participants() {
      return {
        items: [
          { id: "demo-user-student-01", username: "juan_delacruz" },
          { id: "demo-user-student-02", username: "maria_clara" },
          { id: "demo-user-student-03", username: "crisostomo_ibarra" },
        ],
        has_more: false,
        offset: 0,
        limit: 20,
        as_of: new Date().toISOString(),
      };
    },
    async history(id, studentId) {
      const items = studentId
        ? demoStore.messages.filter(m => m.kind === "direct")
        : demoStore.messages.filter(m => m.kind === "announcement");
      return { items, has_more: false, offset: 0, limit: 20, as_of: new Date().toISOString() };
    },
    async send(id, studentId, content) {
      const newMsg: Message = {
        id: `demo-msg-${Date.now()}`,
        class_id: id,
        kind: studentId ? "direct" : "announcement",
        sender: { id: "demo-user-instructor-01", username: "guro_santos" },
        recipient_id: studentId ?? null,
        content,
        sent_at: new Date().toISOString(),
        read: true,
      };
      demoStore.messages.unshift(newMsg);
      return newMsg;
    },
    async detail(id, messageId) {
      const found = demoStore.messages.find(m => m.id === messageId);
      return found ?? demoStore.messages[0];
    },
    async read(id, messageId) {
      const found = demoStore.messages.find(m => m.id === messageId);
      return found ?? demoStore.messages[0];
    },
  };
}
