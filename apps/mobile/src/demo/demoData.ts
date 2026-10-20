import type { ClassDetails, ClassDraft, ClassUpdate, ClassAccess } from "../services/api/classes";
import type { EnrollmentAccess, ClassPreview, Membership, Confirmation } from "../services/api/enrollment";
import type { AssignmentDraft, AssignmentItem, AssignmentSummary, PublishedAssignment, LessonContext, AssignmentAccess, AssignmentPage } from "../services/api/assignments";
import type { Attempt, CaptureAccess, CaptureItem, Progress, RevealedBack } from "../services/api/capture";
import type { AssessmentResult, ResultsAccess, Submission, Evaluation } from "../services/api/results";
import type { ProgressSummary, ProgressClass, ProgressAccess, HistoryItem, LearningHistory } from "../services/api/progress";
import type { MonitoringAccess, Overview, MonitoredStudent, MonitoredAssignment, StudentDetail, AssignmentDetail, ContextOption } from "../services/api/monitoring";
import type { CommunicationAccess, CommunicationContext, Message, Person, CommunicationClass } from "../services/api/communications";
import type { LearningPathway, PathwayAccess } from "../services/api/pathways";
import type { MaterialPage, MaterialsAccess, NotificationPage, NotificationsAccess, NotificationItem } from "../services/api/materials";
import type {
  PronunciationActivityView,
  PronunciationActivitiesResponse,
  PronunciationAttemptSubmission,
  PronunciationAttemptHistoryItem,
  PronunciationAccess,
  AudioUploadPayload,
} from "../services/api/pronunciation";
import type {
  ResearchAccess,
  ResearchStudy,
  AvailableStudiesResponse,
  ConsentDocument,
  ParticipantEligibility,
  EnrollmentReceipt,
  WithdrawalReceipt,
  ParticipantStatus,
  BlindedExperimentStatus,
  GroupAllocationReceipt,
  ResearchAssessmentListItem,
  ResearchAssessmentDetail,
  StartAssessmentReceipt,
  SubmitAssessmentReceipt,
} from "../services/api/research";
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
    experience: "some_words",
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

export function createDemoPathwayApi(): PathwayAccess {
  return {
    async pathway(classId?: string): Promise<LearningPathway> {
      const now = new Date().toISOString();
      return {
        availability: "available",
        as_of: now,
        policy_version: "deterministic-curriculum-v1",
        student_role: classId ? "school_student" : "personal_student",
        class_id: classId ?? "demo-class-1",
        class_name: classId ? "Baitang 7 - Mabini" : null,
        current_position: {
          curriculum_version_id: "demo-edition-matatag",
          curriculum_version_name: "DepEd MATATAG Curriculum 2024",
          grade_number: 7,
          subject_id: "demo-subject-filipino",
          subject_name: "Filipino",
          topic_id: "demo-topic-panitikan",
          topic_name: "Panitikan sa Panahon ng Katutubo",
          lesson_id: "demo-lesson-kuwentong-bayan",
          lesson_name: "Kuwentong Bayan at Pabula",
          position_index: 1,
          total_lessons_in_topic: 4,
        },
        eligible_activities: [
          {
            activity_type: "assignment",
            id: "demo-assign-1",
            title: "Pagsusuri sa Kuwentong Bayan (Baitang 7)",
            topic_name: "Panitikan sa Panahon ng Katutubo",
            position: 1,
            prerequisites: { total_required: 0, fulfilled: 0, all_met: true },
            is_required: true,
            status: "in_progress",
            class_id: "demo-class-1",
            lesson_id: "demo-lesson-kuwentong-bayan",
          },
          {
            activity_type: "lesson",
            id: "demo-lesson-2",
            title: "Mga Elemento ng Pabula at Aral",
            topic_name: "Panitikan sa Panahon ng Katutubo",
            position: 2,
            prerequisites: { total_required: 1, fulfilled: 0, all_met: false },
            is_required: true,
            status: "locked",
            class_id: "demo-class-1",
            lesson_id: "demo-lesson-pabula",
          },
          {
            activity_type: "flashcard_practice",
            id: "demo-flashcard-1",
            title: "Talasalitaan: Mga Katutubong Salita",
            topic_name: "Panitikan sa Panahon ng Katutubo",
            position: 3,
            prerequisites: { total_required: 0, fulfilled: 0, all_met: true },
            is_required: false,
            status: "available",
            class_id: null,
            lesson_id: "demo-lesson-kuwentong-bayan",
          },
        ],
        completed_milestones: [
          {
            kind: "lesson",
            id: "demo-milestone-0",
            title: "Oryentasyon sa Aralin at Panimulang Pagbasa",
            completed_at: new Date(Date.now() - 3 * 86400000).toISOString(),
            class_id: "demo-class-1",
            topic_name: "Panitikan sa Panahon ng Katutubo",
          },
        ],
        recommendations: [
          {
            id: "rec-assign-1",
            recommendation_type: "classroom_assignment",
            title: "Continue: Pagsusuri sa Kuwentong Bayan (Baitang 7)",
            reason: "Active assignment in progress for Baitang 7 - Mabini.",
            target_id: "demo-assign-1",
            is_required: true,
            class_id: "demo-class-1",
          },
          {
            id: "rec-flash-1",
            recommendation_type: "self_study_practice",
            title: "Self-Study: Talasalitaan: Mga Katutubong Salita",
            reason: "Reinforce key terms from Kuwentong Bayan at your own pace.",
            target_id: "demo-flashcard-1",
            is_required: false,
            class_id: null,
          },
        ],
      };
    },
  };
}

export function createDemoMaterialsApi(): MaterialsAccess {
  return {
    async getLessonMaterials(lessonId: string): Promise<MaterialPage> {
      return {
        items: [
          {
            id: `demo-mat-1-${lessonId}`,
            lesson_id: lessonId,
            title: "Gabay sa Pagbasa: Kuwentong Bayan at Panitikan",
            description: "Pangunahing babasahin at pagsusuri para sa Baitang 7 Panitikan.",
            resource_type: "reading",
            content_text: "Ang kuwentong-bayan ay mga salaysay hinggil sa mga likhang-isip na mga tauhan na kumakatawan sa mga uri ng mamamayan na kapupulutan ng aral.",
            reference_url: null,
            media_url: null,
            is_required: true,
            source_metadata: { grade: 7, language: "tagalog" },
          },
          {
            id: `demo-mat-2-${lessonId}`,
            lesson_id: lessonId,
            title: "Talaan ng Katutubong Talasalitaan",
            description: "Listahan ng mga salitang ginamit sa akda at ang kahulugan ng bawat isa.",
            resource_type: "vocabulary_list",
            content_text: "1. Bathala - Ang kataas-taasang diyos ng mga sinaunang Tagalog.\n2. Diwata - Espiritu o tagapangalaga ng kalikasan.",
            reference_url: null,
            media_url: null,
            is_required: false,
            source_metadata: { vocabulary_count: 2 },
          },
        ],
        lesson_id: lessonId,
        lesson_name: "Kuwentong Bayan at Pabula",
        total_count: 2,
        as_of: new Date().toISOString(),
      };
    },
  };
}

export function createDemoNotificationsApi(): NotificationsAccess {
  const notifications: NotificationItem[] = [
    {
      id: "demo-notif-1",
      event_type: "assignment_published",
      title: "Bagong Takdang-Aralin sa Baitang 7",
      message: "Inilathala ni Guro Santos ang 'Pagsusuri sa Kuwentong Bayan'.",
      related_resource_type: "assignment",
      related_resource_id: "demo-assign-1",
      read_at: null,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "demo-notif-2",
      event_type: "class_announcement",
      title: "Paunawa para sa Klase",
      message: "Maghanda para sa talakayan bukas ukol sa mga Katutubong Panitikan.",
      related_resource_type: "message",
      related_resource_id: "demo-msg-1",
      read_at: new Date(Date.now() - 7200000).toISOString(),
      created_at: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "demo-notif-3",
      event_type: "learning_material_available",
      title: "Bagong Gabay sa Pag-aaral",
      message: "Mababasa na ang Talaan ng Katutubong Talasalitaan sa inyong aralin.",
      related_resource_type: "material",
      related_resource_id: null,
      read_at: null,
      created_at: new Date(Date.now() - 10800000).toISOString(),
    },
  ];

  return {
    async list(limit = 20, offset = 0): Promise<NotificationPage> {
      const unread_count = notifications.filter((n) => n.read_at === null).length;
      return {
        items: notifications.slice(offset, offset + limit),
        limit,
        offset,
        has_more: offset + limit < notifications.length,
        unread_count,
        as_of: new Date().toISOString(),
      };
    },
    async read(notificationId: string): Promise<NotificationItem> {
      const found = notifications.find((n) => n.id === notificationId);
      if (found && !found.read_at) {
        found.read_at = new Date().toISOString();
      }
      return found ?? notifications[0];
    },
    async readAll(): Promise<{ read_count: number }> {
      let count = 0;
      for (const n of notifications) {
        if (!n.read_at) {
          n.read_at = new Date().toISOString();
          count++;
        }
      }
      return { read_count: count };
    },
  };
}

export function createDemoPronunciationApi(): PronunciationAccess {
  const activities: PronunciationActivityView[] = [
    {
      id: "demo-pron-act-1",
      lesson_id: "demo-lesson-1",
      target_text: "Magandang umaga sa inyong lahat.",
      language: "tagalog",
      instructions: "Bigkasin nang malinaw at may magalang na intonasyon.",
      reference_audio_metadata: { syllables: 10, pace: "natural" },
      version: 1,
    },
    {
      id: "demo-pron-act-2",
      lesson_id: "demo-lesson-1",
      target_text: "Ang wika ay salamin ng kultura ng isang bansa.",
      language: "tagalog",
      instructions: "Pansinin ang diin sa mga salitang 'wika' at 'kultura'.",
      reference_audio_metadata: { syllables: 17, pace: "moderate" },
      version: 1,
    },
    {
      id: "demo-pron-act-3",
      lesson_id: null,
      target_text: "Good morning, welcome to our language practice lesson.",
      language: "english",
      instructions: "Focus on clear consonant articulation and natural sentence rhythm.",
      reference_audio_metadata: { syllables: 16, pace: "moderate" },
      version: 1,
    },
  ];

  const attempts: PronunciationAttemptHistoryItem[] = [];

  return {
    async activities(language?: string): Promise<PronunciationActivitiesResponse> {
      const filtered = language
        ? activities.filter((a) => a.language === language.toLowerCase())
        : activities;
      return { activities: filtered, total: filtered.length };
    },
    async activity(activityId: string): Promise<PronunciationActivityView> {
      const found = activities.find((a) => a.id === activityId);
      if (!found) throw new Error("Pronunciation activity not found.");
      return found;
    },
    async submitAttempt(
      activityId: string,
      audio: AudioUploadPayload,
      durationMs: number
    ): Promise<PronunciationAttemptSubmission> {
      const act = activities.find((a) => a.id === activityId) || activities[0];
      const attemptId = `demo-attempt-${Date.now()}`;
      const size = typeof Blob !== "undefined" && audio instanceof Blob ? audio.size : 12400;
      const rawTranscription = act.target_text;
      attempts.unshift({
        attempt_id: attemptId,
        activity_id: act.id,
        target_text: act.target_text,
        language: act.language,
        attempted_at: new Date().toISOString(),
        scoring_status: "pending",
        file_size_bytes: size,
        duration_ms: durationMs,
        transcription: rawTranscription,
      });
      return {
        attempt_id: attemptId,
        activity_id: act.id,
        target_text: act.target_text,
        language: act.language,
        attempted_at: new Date().toISOString(),
        scoring_status: "pending",
        file_size_bytes: size,
        duration_ms: durationMs,
        mime_type: "audio/webm",
        simulated: true,
        message: "Audio recorded and transcribed successfully. Pronunciation scoring pending Section 34.",
        transcription: rawTranscription,
        transcription_metadata: {
          model_id: "whisper-multilingual-v1",
          model_version: "openai/whisper-base",
          detected_language: act.language === "tagalog" ? "tl" : "en",
          prompt_language: act.language === "tagalog" ? "tl" : "en",
          confidence: 0.95,
          silence_detected: false,
        },
      };
    },
    async attempts(activityId?: string): Promise<PronunciationAttemptHistoryItem[]> {
      if (activityId) {
        return attempts.filter((a) => a.activity_id === activityId);
      }
      return attempts;
    },
    async transcribe(attemptId: string): Promise<any> {
      const att = attempts.find(a => a.attempt_id === attemptId) || attempts[0];
      return {
        attempt_id: attemptId,
        activity_id: att?.activity_id || "demo-act",
        transcription: att?.transcription || "Magandang umaga sa inyong lahat.",
        raw_transcript: att?.transcription || "Magandang umaga sa inyong lahat.",
        normalized_transcript: (att?.transcription || "magandang umaga sa inyong lahat").toLowerCase(),
        detected_language: att?.language === "tagalog" ? "tl" : "en",
        prompt_language: att?.language === "tagalog" ? "tl" : "en",
        confidence: 0.95,
        duration_ms: att?.duration_ms || 3000,
        processing_time_ms: 120,
        model_id: "whisper-multilingual-v1",
        model_version: "openai/whisper-base",
        simulated: true,
        silence_detected: false,
        words: [],
        scoring_status: "pending",
        message: "Demo speech transcribed successfully.",
      };
    },
    async getTranscription(attemptId: string): Promise<any> {
      const att = attempts.find(a => a.attempt_id === attemptId);
      return {
        attempt_id: attemptId,
        status: att?.transcription ? "completed" : "pending",
        has_transcription: !!att?.transcription,
        transcription: att?.transcription || null,
        detected_language: att?.language === "tagalog" ? "tl" : "en",
        prompt_language: att?.language === "tagalog" ? "tl" : "en",
        silence_detected: false,
        simulated: true,
      };
    },
    async evaluate(attemptId: string): Promise<any> {
      const att = attempts.find(a => a.attempt_id === attemptId) || attempts[0];
      const act = activities.find(a => a.id === att?.activity_id) || activities[0];
      const isTl = act.language === "tagalog";
      return {
        attempt_id: attemptId,
        activity_id: act.id,
        scoring_status: "scored",
        score: 88.5,
        feedback: isTl ? "Mahusay! Malinaw ang iyong pagbigkas." : "Great job! Your pronunciation is clear.",
        assessment: {
          overall_score: 88.5,
          accuracy_score: 90.0,
          fluency_score: 86.0,
          completeness_score: 100.0,
          prosody_score: 85.0,
          words: [
            {
              word: isTl ? "Magandang" : "Good",
              target_phonemes: isTl ? ["M", "AA", "G", "AA", "N", "D", "AA", "NG"] : ["G", "UH", "D"],
              accuracy_score: 92.0,
              error_type: "none",
              phonemes: [
                { phoneme: isTl ? "M" : "G", accuracy_score: 95.0, status: "correct" },
                { phoneme: isTl ? "AA" : "UH", accuracy_score: 90.0, status: "correct" },
              ],
            },
            {
              word: isTl ? "umaga" : "morning",
              target_phonemes: isTl ? ["UW", "M", "AA", "G", "AA"] : ["M", "AO", "R", "N", "IH", "NG"],
              accuracy_score: 87.0,
              error_type: "none",
              phonemes: [
                { phoneme: isTl ? "UW" : "M", accuracy_score: 88.0, status: "correct" },
                { phoneme: isTl ? "M" : "AO", accuracy_score: 86.0, status: "correct" },
              ],
            },
          ],
          target_language: act.language,
          summary_feedback: isTl ? "Mahusay! Malinaw ang iyong pagbigkas." : "Great job! Your pronunciation is clear.",
          actionable_tips: isTl
            ? ["Bigkasin ang bawat patinig nang bukas at matatag.", "Tandaan ang diin sa mga salita."]
            : ["Enunciate ending consonants clearly.", "Maintain a steady speech rhythm."],
          model_id: "fluentt-multilingual-gop-evaluator",
          model_version: "1.0.0",
          simulated: true,
          speech_rate_wpm: 120.0,
          confidence: 0.95,
        },
        transcription: att?.transcription || act.target_text,
        evaluator_configuration_id: "demo-eval-config-1",
        simulated: true,
        message: "Demo pronunciation assessment completed successfully.",
      };
    },
    async getAssessment(attemptId: string): Promise<any> {
      return this.evaluate(attemptId);
    },
  };
}

export const DEMO_CONVERSATION_TOPICS: any[] = [
  {
    id: "demo-topic-1",
    title: "Pagpapakilala sa Sarili (Introducing Oneself)",
    language: "tagalog",
    scenario_description: "Kumustahan at pagpapakilala sa bagong kaklase sa paaralan.",
    persona: "Juan (Bagong Kaklase)",
    target_level: "Grade 7 (Panimula)",
    goal: "Ipakilala ang sarili gamit ang magagalang na pananalita tulad ng 'po' at 'opo'.",
    vocabulary_hints: ["pangalan", "taga-saan", "edad", "kinagagalak", "salamat po"],
    starter_prompt: "Magandang araw! Ako si Juan, isang mag-aaral dito. Kumusta ka? Ano ang iyong pangalan?",
    status: "published",
    version: 1,
  },
  {
    id: "demo-topic-2",
    title: "Pamimili sa Pamilihan (Market Bargaining)",
    language: "tagalog",
    scenario_description: "Pamimili ng sariwang prutas at gulay sa palengke.",
    persona: "Aling Nena (Tindera)",
    target_level: "Grade 8 (Panggitna)",
    goal: "Magtanong ng presyo, pumili ng mga prutas, at magbayad nang magalang.",
    vocabulary_hints: ["magkano", "kilo", "tawad", "sukli", "sariwa", "bayad po"],
    starter_prompt: "Magandang umaga! Sariwa ang mga mangga at saging ngayon. Ano po ang bibilhin ninyo?",
    status: "published",
    version: 1,
  },
  {
    id: "demo-topic-3",
    title: "School Orientation & Friends (Campus Life)",
    language: "english",
    scenario_description: "Meeting a student buddy and discussing favorite classes and campus activities.",
    persona: "Alex (Peer Buddy)",
    target_level: "Grade 7 (Beginner)",
    goal: "Introduce yourself in English and talk about favorite subjects and activities.",
    vocabulary_hints: ["schedule", "library", "science lab", "favorite subject", "nice to meet you"],
    starter_prompt: "Hi there! Welcome to our campus. I'm Alex from Grade 7. Which class are you heading to today?",
    status: "published",
    version: 1,
  },
  {
    id: "demo-topic-4",
    title: "Ordering at a Local Cafe (Everyday English)",
    language: "english",
    scenario_description: "Placing a beverage order and asking questions at a coffee shop.",
    persona: "Chris (Friendly Barista)",
    target_level: "Grade 9 (Conversational)",
    goal: "Order beverages and snacks, ask for dietary options, and complete transactions politely.",
    vocabulary_hints: ["iced coffee", "pastry", "takeout", "how much", "thank you"],
    starter_prompt: "Good morning! Welcome to Fluentt Cafe. What can I get started for you today?",
    status: "published",
    version: 1,
  },
];

export function createDemoConversationApi() {
  const sessions: Map<string, any> = new Map();

  return {
    async topics(language?: string): Promise<any> {
      let filtered = [...DEMO_CONVERSATION_TOPICS];
      if (language) {
        const lang = language.toLowerCase();
        if (lang === "tl" || lang === "tagalog") {
          filtered = filtered.filter(t => t.language === "tagalog");
        } else if (lang === "en" || lang === "english") {
          filtered = filtered.filter(t => t.language === "english");
        }
      }
      return { topics: filtered, total: filtered.length };
    },

    async topic(topicId: string): Promise<any> {
      const top = DEMO_CONVERSATION_TOPICS.find(t => t.id === topicId) || DEMO_CONVERSATION_TOPICS[0];
      return top;
    },

    async startSession(topicId: string, _classId?: string | null): Promise<any> {
      const top = DEMO_CONVERSATION_TOPICS.find(t => t.id === topicId) || DEMO_CONVERSATION_TOPICS[0];
      const sessionId = `demo-session-${Date.now()}`;
      const now = new Date().toISOString();
      const session = {
        session_id: sessionId,
        topic_id: top.id,
        topic_title: top.title,
        language: top.language,
        persona: top.persona,
        started_at: now,
        ended_at: null,
        status: "active",
        simulated: true,
        model_version: "fluentt-dialogue-v1.0",
        turns_count: 1,
        max_turns: 15,
        messages: [
          {
            id: `demo-msg-1`,
            sequence: 1,
            role: "assistant",
            content: top.starter_prompt,
            sent_at: now,
          },
        ],
      };
      sessions.set(sessionId, session);
      return session;
    },

    async getSession(sessionId: string): Promise<any> {
      if (sessions.has(sessionId)) return sessions.get(sessionId);
      return this.startSession(DEMO_CONVERSATION_TOPICS[0].id);
    },

    async sendMessage(sessionId: string, content?: string | null, audioAttemptId?: string | null): Promise<any> {
      const session = await this.getSession(sessionId);
      const isTl = session.language === "tagalog";
      const userText = content || (audioAttemptId ? "Magandang araw po ako si Maria" : "Hello");
      const userSeq = session.messages.length + 1;
      const asstSeq = userSeq + 1;
      const now = new Date().toISOString();

      const userMsg = {
        id: `demo-msg-${userSeq}`,
        sequence: userSeq,
        role: "user",
        content: userText,
        sent_at: now,
        pronunciation_score: audioAttemptId ? 92.5 : null,
        transcription: audioAttemptId ? userText : null,
        audio_attempt_id: audioAttemptId ?? null,
      };

      let assistantText = "";
      if (isTl) {
        assistantText = "Ikinagagalak kitang makilala! Taga-saan ka naman? At ano ang paborito mong libangan?";
      } else {
        assistantText = "Nice to meet you! Where are you from, and what is your favorite subject here at school?";
      }

      const asstMsg = {
        id: `demo-msg-${asstSeq}`,
        sequence: asstSeq,
        role: "assistant",
        content: assistantText,
        sent_at: now,
        feedback: {
          summary: isTl ? "Maganda ang iyong sagot! Mahusay ang paggamit ng magagalang na pananalita." : "Clear and engaging answer! Good vocabulary usage.",
          corrections: [],
          suggestions: isTl ? ["Maaari ding sabihin: 'Ikinagagalak ko rin po kayong makilala.'"] : ["You can also add: 'Nice to meet you too!'"],
          politeness_marker_detected: true,
          topic_relevance_score: 0.95,
          confidence: 0.94,
          uncertainty_notice: "Formative feedback provides practice guidance based on educational heuristics.",
        },
      };

      session.messages.push(userMsg, asstMsg);
      session.turns_count = session.messages.length;

      return {
        session_id: sessionId,
        user_message: userMsg,
        assistant_message: asstMsg,
        turns_count: session.turns_count,
        max_turns: session.max_turns,
        is_session_complete: session.turns_count >= session.max_turns,
        simulated: true,
      };
    },

    async endSession(sessionId: string): Promise<any> {
      const session = await this.getSession(sessionId);
      session.status = "ended";
      session.ended_at = new Date().toISOString();
      return {
        session_id: sessionId,
        status: "ended",
        turns_completed: session.messages.length,
        overall_feedback: session.language === "tagalog"
          ? "Mahusay na pagtatapos ng pagsasanay sa pakikipag-usap! Patuloy na linangin ang tiwala sa pagpapahayag."
          : "Great job completing your conversation practice session! Keep building your spontaneous speaking confidence.",
        strengths: [
          "Active turn-taking within the scenario",
          "Polite and responsive dialogue phrasing",
        ],
        recommendations: [
          "Practice expanding answers with more descriptive details",
          "Review vocabulary hints before starting the next conversation",
        ],
        ended_at: session.ended_at,
      };
    },
  };
}

export const DEMO_RESEARCH_STUDIES: ResearchStudy[] = [
  {
    id: "demo-study-tag-01",
    code: "FLUENTT-EXP-TAG-2026",
    title: "FLUENTT Adaptive Learning & Spaced Repetition Evaluation (Tagalog)",
    status: "active",
    target_language: "tagalog",
    protocol_version: "thesis-protocol-tag-v1.0",
    target_participants: 30,
    enrolled_count: 14,
    withdrawn_count: 1,
    conditions: {
      consent_document_version: "consent-tag-v1.0",
      retention_policy_version: "research-retention-v1",
      purpose: "Evaluate learning gains and retention stability in Tagalog vocabulary and grammar using adaptive spaced repetition (SM-2 baseline vs. Enhanced Spaced Repetition with FIFAKT knowledge tracing).",
      procedures: "Participants complete pre-test assessments, daily 10-15 minute vocabulary and grammar review sessions across 5 structured curriculum levels, followed by post-test and delayed retention evaluations.",
      voluntary_nature: "Participation is completely voluntary. You may decline or withdraw at any point without penalty or impact on your regular classroom standing.",
      confidentiality: "All experimental data is pseudonymized using a generated research participant code. Your student account identity is stored in a separate, access-restricted database schema accessible only to authorized research personnel.",
      withdrawal_rights: "You may withdraw from the study at any time through the research interface. Upon withdrawal, future experimental sessions will cease immediately. Previously collected records are retained in pseudonymized form to maintain scientific integrity.",
      ethics_statement: "NOTICE: Software consent recording captures technical participant affirmation under the specified protocol version and does NOT constitute independent Institutional Review Board (IRB) or Research Ethics Committee (REC) approval.",
      required_affirmation: "I have read and understood the study information, voluntarily agree to participate, and understand that I may withdraw at any time.",
    },
    locked_at: null,
  },
  {
    id: "demo-study-eng-01",
    code: "FLUENTT-EXP-ENG-2026",
    title: "FLUENTT Adaptive Learning & Pronunciation Evaluation (English)",
    status: "active",
    target_language: "english",
    protocol_version: "thesis-protocol-eng-v1.0",
    target_participants: 30,
    enrolled_count: 12,
    withdrawn_count: 0,
    conditions: {
      consent_document_version: "consent-eng-v1.0",
      retention_policy_version: "research-retention-v1",
      purpose: "Evaluate pronunciation accuracy, intelligibility, and oral fluency gains in English using multimodal speech recognition and NLP-driven phonetic scoring.",
      procedures: "Participants complete baseline pronunciation recordings, guided conversation modules, and targeted phonetic assessment activities across 5 structured curriculum levels.",
      voluntary_nature: "Participation is completely voluntary. You may decline or withdraw at any point without penalty or impact on your regular classroom standing.",
      confidentiality: "All experimental audio and transcripts are pseudonymized under an unlinked participant code. Identifying links are kept in an isolated schema protected by strict research administration permissions.",
      withdrawal_rights: "You may withdraw from the study at any time through the research interface. Upon withdrawal, future experimental sessions will cease immediately. Previously collected records are retained in pseudonymized form to maintain scientific integrity.",
      ethics_statement: "NOTICE: Software consent recording captures technical participant affirmation under the specified protocol version and does NOT constitute independent Institutional Review Board (IRB) or Research Ethics Committee (REC) approval.",
      required_affirmation: "I have read and understood the study information, voluntarily agree to participate, and understand that I may withdraw at any time.",
    },
    locked_at: null,
  },
];

let demoParticipantsStore: ParticipantStatus[] = [];

export function createDemoResearchApi(): ResearchAccess {
  return {
    async studies(language?: string): Promise<AvailableStudiesResponse> {
      let filtered = DEMO_RESEARCH_STUDIES;
      if (language) {
        filtered = filtered.filter((s) => s.target_language === language);
      }
      return {
        studies: filtered,
        count: filtered.length,
        ethics_disclaimer:
          "NOTICE: Software consent recording captures technical participant affirmation under the specified protocol version and does NOT constitute independent Institutional Review Board (IRB) or Research Ethics Committee (REC) approval.",
      };
    },

    async study(studyId: string): Promise<ResearchStudy> {
      const match = DEMO_RESEARCH_STUDIES.find((s) => s.id === studyId);
      if (!match) throw new Error("Study not found");
      return match;
    },

    async eligibility(studyId: string): Promise<ParticipantEligibility> {
      const match = DEMO_RESEARCH_STUDIES.find((s) => s.id === studyId);
      if (!match) throw new Error("Study not found");
      const existing = demoParticipantsStore.find((p) => p.study_id === studyId);
      const isWithdrawn = existing?.enrollment_status === "withdrawn";
      const isEnrolled = existing?.enrollment_status === "enrolled";

      return {
        study_id: match.id,
        study_code: match.code,
        eligible: !isWithdrawn && !isEnrolled,
        reasons: isWithdrawn
          ? ["Re-enrollment after withdrawal is prohibited under approved research protocol."]
          : isEnrolled
          ? ["Already enrolled in this research study."]
          : [],
        current_status: existing?.enrollment_status || null,
        target_language_match: true,
        recruitment_open: match.status === "active",
        quota_available: match.enrolled_count < match.target_participants,
        protocol_version: match.protocol_version,
      };
    },

    async consentDocument(studyId: string): Promise<ConsentDocument> {
      const match = DEMO_RESEARCH_STUDIES.find((s) => s.id === studyId);
      if (!match) throw new Error("Study not found");
      return {
        study_id: match.id,
        study_code: match.code,
        study_title: match.title,
        target_language: match.target_language,
        protocol_version: match.protocol_version,
        consent_document_version: match.conditions.consent_document_version,
        purpose: match.conditions.purpose,
        procedures: match.conditions.procedures,
        voluntary_nature: match.conditions.voluntary_nature,
        confidentiality_and_pseudonymization: match.conditions.confidentiality,
        data_retention_policy: "Pre-withdrawal records are permanently retained in tamper-evident research audit storage.",
        withdrawal_rights: match.conditions.withdrawal_rights,
        ethics_statement: match.conditions.ethics_statement,
        required_affirmation: match.conditions.required_affirmation,
        retention_notice:
          "In accordance with research integrity standards and the approved thesis data retention policy (research-retention-v1), historical pre-withdrawal records remain preserved in pseudonymized form and are not destroyed upon withdrawal.",
      };
    },

    async enroll(studyId: string, payload: any): Promise<EnrollmentReceipt> {
      const match = DEMO_RESEARCH_STUDIES.find((s) => s.id === studyId);
      if (!match) throw new Error("Study not found");
      if (payload.protocol_version !== match.protocol_version) {
        throw new Error("Protocol version mismatch");
      }
      if (!payload.affirmation_confirmed) {
        throw new Error("Consent affirmation must be confirmed");
      }
      const existing = demoParticipantsStore.find((p) => p.study_id === studyId);
      if (existing && existing.enrollment_status === "withdrawn") {
        throw new Error("Re-enrollment prohibited after withdrawal");
      }
      if (existing && existing.enrollment_status === "enrolled") {
        throw new Error("Already enrolled");
      }

      const participantCode = `P-${match.target_language === "tagalog" ? "TAG" : "ENG"}-DEMO${Math.floor(100 + Math.random() * 900)}`;
      const statusRecord: ParticipantStatus = {
        participant_id: `part-${Date.now()}`,
        participant_code: participantCode,
        study_id: match.id,
        study_code: match.code,
        study_title: match.title,
        target_language: match.target_language,
        protocol_version: match.protocol_version,
        enrollment_status: "enrolled",
        eligibility_status: "eligible",
        enrolled_at: new Date().toISOString(),
        withdrawn_at: null,
        ethics_disclaimer:
          "NOTICE: Software consent recording captures technical participant affirmation under the specified protocol version and does NOT constitute independent Institutional Review Board (IRB) or Research Ethics Committee (REC) approval.",
        retention_notice:
          "Pre-withdrawal research records are permanently retained in tamper-evident storage for scientific integrity.",
      };
      demoParticipantsStore.push(statusRecord);
      match.enrolled_count += 1;

      return {
        participant_id: statusRecord.participant_id,
        participant_code: statusRecord.participant_code,
        study_id: statusRecord.study_id,
        study_code: statusRecord.study_code,
        protocol_version: statusRecord.protocol_version,
        enrollment_status: "enrolled",
        enrolled_at: statusRecord.enrolled_at!,
        ethics_disclaimer: statusRecord.ethics_disclaimer,
        retention_notice: statusRecord.retention_notice,
      };
    },

    async myStatus(): Promise<ParticipantStatus[]> {
      return [...demoParticipantsStore];
    },

    async withdraw(studyId: string, payload?: any): Promise<WithdrawalReceipt> {
      const match = DEMO_RESEARCH_STUDIES.find((s) => s.id === studyId);
      if (!match) throw new Error("Study not found");
      const record = demoParticipantsStore.find((p) => p.study_id === studyId);
      if (!record) throw new Error("No enrollment found");
      if (record.enrollment_status === "withdrawn") {
        throw new Error("Already withdrawn");
      }

      record.enrollment_status = "withdrawn";
      record.withdrawn_at = new Date().toISOString();
      match.enrolled_count = Math.max(0, match.enrolled_count - 1);
      match.withdrawn_count += 1;

      return {
        participant_id: record.participant_id,
        study_code: match.code,
        enrollment_status: "withdrawn",
        withdrawn_at: record.withdrawn_at,
        retention_notice:
          "In accordance with research integrity standards, pre-withdrawal audit and interaction logs remain permanently retained and are not destroyed.",
      };
    },

    async experimentStatus(studyId: string): Promise<BlindedExperimentStatus> {
      const match = DEMO_RESEARCH_STUDIES.find((s) => s.id === studyId);
      const participant = demoParticipantsStore.find((p) => p.study_id === studyId);
      return {
        study_id: studyId,
        study_code: match?.code || "DEMO-EXP",
        study_title: match?.title || "Demo Spaced Repetition Study",
        target_language: match?.target_language || "tagalog",
        protocol_version: match?.protocol_version || "thesis-protocol-v1",
        participant_id: participant?.participant_id || "demo-part-1",
        participant_code: participant?.participant_code || "P-TAG-DEMO101",
        is_enrolled: !!participant && participant.enrollment_status === "enrolled",
        is_allocated: true,
        is_withdrawn: participant?.enrollment_status === "withdrawn",
        condition_blinded: "standard_research_track",
        current_level_number: 1,
        next_activity: "Pre-Intervention Baseline Assessment",
        pre_test_completed: false,
        levels_completed: [],
        post_test_completed: false,
        delayed_retention_completed: false,
        pronunciation_completed: false,
        ethics_disclaimer:
          "NOTICE: Software consent recording captures technical participant affirmation under the specified protocol version and does NOT constitute independent Institutional Review Board (IRB) or Research Ethics Committee (REC) approval.",
      };
    },

    async allocate(studyId: string, preferredSeed?: number): Promise<GroupAllocationReceipt> {
      const participant = demoParticipantsStore.find((p) => p.study_id === studyId);
      return {
        assignment_id: `asgn-demo-${Date.now()}`,
        participant_id: participant?.participant_id || "demo-part-1",
        participant_code: participant?.participant_code || "P-TAG-DEMO101",
        study_id: studyId,
        assignment_number: 1,
        assigned_at: new Date().toISOString(),
        allocation_method: "permuted_block",
        condition_blinded: "standard_research_track",
        reproducibility_seed: preferredSeed || 42,
        target_group_size: 15,
        ethics_disclaimer:
          "NOTICE: Software consent recording captures technical participant affirmation under the specified protocol version and does NOT constitute independent Institutional Review Board (IRB) or Research Ethics Committee (REC) approval.",
      };
    },

    async assessments(studyId: string): Promise<ResearchAssessmentListItem[]> {
      return [
        {
          assessment_id: "demo-asm-pre",
          study_id: studyId,
          kind: "pre_test",
          title: "Pre-Intervention Baseline Assessment",
          instrument_version: "tagalog-pretest-v1",
          time_limit_seconds: 600,
          total_points: 10,
          is_unlocked: true,
          attempt_status: "not_started",
        },
        {
          assessment_id: "demo-asm-lvl1",
          study_id: studyId,
          kind: "learning_level",
          level_number: 1,
          title: "Level 1 Milestone: Basic Greetings & Numbers",
          instrument_version: "tagalog-lvl1-v1",
          time_limit_seconds: 300,
          total_points: 6,
          is_unlocked: false,
          attempt_status: "not_started",
        },
        {
          assessment_id: "demo-asm-post",
          study_id: studyId,
          kind: "post_test",
          title: "Post-Intervention Summative Assessment",
          instrument_version: "tagalog-posttest-v1",
          time_limit_seconds: 600,
          total_points: 10,
          is_unlocked: false,
          attempt_status: "not_started",
        },
        {
          assessment_id: "demo-asm-ret",
          study_id: studyId,
          kind: "delayed_retention",
          title: "Delayed Retention Evaluation (14-Day)",
          instrument_version: "tagalog-retention-v1",
          time_limit_seconds: 600,
          total_points: 10,
          is_unlocked: false,
          attempt_status: "not_started",
        },
        {
          assessment_id: "demo-asm-pron",
          study_id: studyId,
          kind: "pronunciation",
          title: "Acoustic Pronunciation Goodness-of-Pronunciation (GOP) Assessment",
          instrument_version: "tagalog-pron-v1",
          time_limit_seconds: 300,
          total_points: 10,
          is_unlocked: false,
          attempt_status: "not_started",
        },
      ];
    },

    async assessmentDetail(studyId: string, assessmentId: string): Promise<ResearchAssessmentDetail> {
      return {
        assessment_id: assessmentId,
        study_id: studyId,
        kind: "pre_test",
        instrument_version: "tagalog-pretest-v1",
        title: "Pre-Intervention Baseline Assessment",
        instructions: "Complete all questions carefully. Each question counts toward your baseline knowledge score.",
        time_limit_seconds: 600,
        total_points: 10,
        attempt_status: "not_started",
        items: [
          {
            item_id: "demo_item_1",
            prompt: "What is the Tagalog word for 'book'?",
            item_type: "multiple_choice",
            options: ["mesa", "aklat", "pluma", "upuan"],
            points: 2,
          },
          {
            item_id: "demo_item_2",
            prompt: "Translate 'to drink' into Tagalog (verb root or infinitive):",
            item_type: "identification",
            points: 2,
          },
          {
            item_id: "demo_item_3",
            prompt: "Select the Tagalog word for 'happy':",
            item_type: "multiple_choice",
            options: ["malungkot", "galit", "maligaya", "takot"],
            points: 2,
          },
          {
            item_id: "demo_item_4",
            prompt: "'Salamat' means 'Thank you' in Tagalog.",
            item_type: "true_false",
            options: ["True", "False"],
            points: 2,
          },
          {
            item_id: "demo_item_5",
            prompt: "Fill in the missing word: Magandang ______ (Morning):",
            item_type: "identification",
            points: 2,
          },
        ],
      };
    },

    async startAssessment(studyId: string, assessmentId: string): Promise<StartAssessmentReceipt> {
      return {
        attempt_id: `demo-att-${Date.now()}`,
        assessment_id: assessmentId,
        participant_id: "demo-part-1",
        attempt_number: 1,
        started_at: new Date().toISOString(),
        time_limit_seconds: 600,
        status: "in_progress",
      };
    },

    async submitAssessment(studyId: string, assessmentId: string, payload: any): Promise<SubmitAssessmentReceipt> {
      return {
        result_id: `demo-res-${Date.now()}`,
        assessment_id: assessmentId,
        participant_id: "demo-part-1",
        participant_code: "P-TAG-DEMO101",
        attempt_number: 1,
        status: "completed",
        score: 10,
        maximum_score: 10,
        percentage: 100,
        feedback_message: "Assessment attempt committed. Result recorded in tamper-evident research audit log.",
        submitted_at: new Date().toISOString(),
        ethics_disclaimer:
          "NOTICE: Software consent recording captures technical participant affirmation under the specified protocol version and does NOT constitute independent Institutional Review Board (IRB) or Research Ethics Committee (REC) approval.",
      };
    },
  };
}



