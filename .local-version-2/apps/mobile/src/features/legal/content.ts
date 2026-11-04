export const legalSections = {
  "privacy": [
    {
      "title": "Your privacy, in plain words",
      "body": "Fluentt supports your classes and language practice. It uses account and learning information to provide these activities. Ask your teacher or a trusted adult if anything here is unclear. For privacy questions, contact NE Learning Inc. at nelearninginc@outlook.com."
    },
    {
      "title": "Who is responsible",
      "body": "The proposed classroom operator is NE Learning Inc. Fluentt was developed by Fluency, a thesis group from Lyceum of the Philippines University - Cavite. Development credit does not mean the university operates or endorses the service. Any research use has separate information and responsibilities described in the relevant study documents."
    },
    {
      "title": "Information used by Fluentt",
      "body": "Depending on the features you use, records include your username, account role and sign-in/session information; class membership and teacher-recorded language proficiency; assignment answers, saved attempts, submissions and shared results; class announcements and private class messages; and language-practice sessions, responses and available feedback. Settings may be stored on your device."
    },
    {
      "title": "Speaking and conversation practice",
      "body": "Microphone access lets you record or practise speaking. Some supported word practice runs on your device. Submitting a recording sends it to Fluentt for processing; school recording submissions can be stored on the server. Spoken conversation replies can also submit recordings. Optional scoring and other configured processing can have separate service disclosures. Read the notice shown for the activity before recording or sending. Do not assume all practice stays on your device or that closing a page deletes submitted audio."
    },
    {
      "title": "Why information is used",
      "body": "Information supports sign-in, class access, teaching, assignment delivery, saved work, results, messages and requested practice feedback. Teacher-entered proficiency records reflect the client's external assessment. Automated word matches and practice feedback are not certified proficiency assessments or examination grades. The final notice must identify the applicable grounds for each processing activity; reading this notice is not consent to every use."
    },
    {
      "title": "Who can see information",
      "body": "Access depends on account permissions and class membership. Announcements are visible to eligible class members. Private class messages are available to the participating student and instructor through the messaging interface. Authorised personnel with system or database access may process records for approved administration and support. This is not a claim of end-to-end encryption. Final hosting and service-recipient details must be confirmed before publication."
    },
    {
      "title": "Children and research",
      "body": "Students can ask a parent, guardian or teacher for help understanding their information. Classroom enrollment and acceptance of general terms do not authorise research participation. Where research is offered, use the separate study information, eligibility, consent and withdrawal process. A learner's checkbox does not establish guardian permission or institutional approval."
    },
    {
      "title": "Storage and retention",
      "body": "Leaving a class, signing out or closing the app does not automatically erase stored records. Some history remains stored even when classroom access ends. Retention periods, deletion procedures and any required exceptions must be confirmed by NE Learning Inc. and included here before publication. This draft does not promise a deletion schedule that the system does not enforce."
    },
    {
      "title": "Your choices and questions",
      "body": "Contact nelearninginc@outlook.com to ask about access, correction, objection, withdrawal of consent where applicable, or deletion/blocking of information, subject to applicable requirements and limitations. Verification may be needed to protect your information; do not email passwords or recordings. You may also raise privacy concerns with the Philippine National Privacy Commission at privacy.gov.ph. The app currently provides no general self-service account-deletion tool."
    }
  ],
  "terms": [
    {
      "title": "Using Fluentt",
      "body": "Fluentt supports NE Learning Inc.'s classroom learning and available practice activities. Use the account type and class access assigned to you. These terms do not replace separate school arrangements, privacy information, recording permissions or research consent."
    },
    {
      "title": "Keep your account safe",
      "body": "Keep your password private, use your own account and report suspected unauthorised access to NE Learning Inc. Do not share class invitation codes publicly or use another person's account. Ask your teacher for help when needed."
    },
    {
      "title": "Respect other people",
      "body": "Use messages and submitted work respectfully. Do not bully, threaten, impersonate others, upload unlawful material or share someone else's private information without authority. Classroom messaging is for learning and communication with your teacher; it is not an emergency service."
    },
    {
      "title": "Lessons and submitted work",
      "body": "Only upload or share content you are authorised to use. Creating a lesson does not give permission to copy someone else's protected books, pictures or audio. These terms do not transfer ownership of instructor or student work. NE Learning Inc. must approve any permissions needed to deliver and maintain submitted content before the final terms are published."
    },
    {
      "title": "Assignments and feedback",
      "body": "Follow your teacher's instructions and save work explicitly when the activity requires it. Confirm submission carefully: some assignments allow a single attempt and become final after submission. Results are shown according to the activity and teacher-sharing rules. Automated practice feedback can be incomplete or incorrect; ask your teacher when unsure."
    },
    {
      "title": "Service availability and access",
      "body": "Features depend on device support, permissions, connectivity and available services. Fluentt does not guarantee uninterrupted operation or particular learning outcomes. Class membership and account permissions affect access; losing access does not necessarily delete earlier records. Report technical or account problems to NE Learning Inc."
    },
    {
      "title": "Questions and future updates",
      "body": "Contact NE Learning Inc. at nelearninginc@outlook.com about these terms. The published documents should show their actual effective date and version. Material changes should be explained before they apply. This draft does not impose automatic acceptance of future terms or waive statutory rights."
    }
  ]
} as const;
export type LegalKind = keyof typeof legalSections;
