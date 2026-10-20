"""AI conversation provider: Safety guards, dialogue state engine, and external LLM abstraction."""

import os
import re
from typing import Any
from app.modules.conversation.schemas import FormativeLanguageFeedbackDTO


class SafetyGuard:
    """Detects prompt injection attempts, out-of-bounds queries, and sensitive data disclosures."""

    INJECTION_PATTERNS = [
        re.compile(r"ignore\s+(?:all\s+)?previous\s+instructions", re.IGNORECASE),
        re.compile(r"disregard\s+(?:all\s+)?prior", re.IGNORECASE),
        re.compile(r"system\s+prompt", re.IGNORECASE),
        re.compile(r"reveal\s+(?:your\s+)?instructions", re.IGNORECASE),
        re.compile(r"jailbreak", re.IGNORECASE),
        re.compile(r"\bDAN\b", re.IGNORECASE),
        re.compile(r"developer\s+mode", re.IGNORECASE),
        re.compile(r"exec\s*\(", re.IGNORECASE),
        re.compile(r"<\s*script", re.IGNORECASE),
        re.compile(r"DROP\s+TABLE", re.IGNORECASE),
        re.compile(r"rm\s+-rf", re.IGNORECASE),
    ]

    SENSITIVE_PATTERNS = [
        re.compile(r"\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b"),  # Credit card
        re.compile(r"\b(?:09|\+639)\d{9}\b"),  # PH mobile phone
        re.compile(r"\bpassword\s*[:=]", re.IGNORECASE),
    ]

    @classmethod
    def inspect_input(cls, text: str) -> tuple[bool, str | None]:
        """Returns (is_safe, refusal_reason)."""
        if not text or not text.strip():
            return False, "Empty or whitespace-only message."

        for pattern in cls.INJECTION_PATTERNS:
            if pattern.search(text):
                return False, "Prompt injection or boundary override attempt detected."

        for pattern in cls.SENSITIVE_PATTERNS:
            if pattern.search(text):
                return False, "Potential personally identifiable or sensitive data detected."

        return True, None


class ProviderTurnResponse:
    def __init__(
        self,
        assistant_text: str,
        feedback: FormativeLanguageFeedbackDTO,
        safety_flag: bool = False,
        model_version: str = "fluentt-dialogue-v1.0",
        simulated: bool = True,
    ):
        self.assistant_text = assistant_text
        self.feedback = feedback
        self.safety_flag = safety_flag
        self.model_version = model_version
        self.simulated = simulated


class EducationalDialogueEngine:
    """Deterministic, local conversational dialogue engine with curriculum-aware linguistic feedback."""

    @classmethod
    def generate_turn(
        cls,
        user_input: str,
        history: list[dict[str, Any]],
        topic_context: dict[str, Any],
        language: str,
        turns_count: int,
        max_turns: int = 15,
    ) -> ProviderTurnResponse:
        is_safe, refusal_reason = SafetyGuard.inspect_input(user_input)
        if not is_safe:
            if language == "tagalog":
                assistant_text = (
                    "Magalang po nating ituon ang ating pagsasanay sa ating paksa. "
                    "Paano mo po gustong ipagpatuloy ang ating usapan?"
                )
                summary = "Ipinapaalala ang pananatili sa itinakdang paksa at magalang na pakikipag-usap."
            else:
                assistant_text = (
                    "Let's keep our focus on our practice scenario and topic. "
                    "How would you like to continue our conversation?"
                )
                summary = "Reminder to stay within the educational scenario boundary."

            return ProviderTurnResponse(
                assistant_text=assistant_text,
                feedback=FormativeLanguageFeedbackDTO(
                    summary=summary,
                    corrections=[f"Puna: {refusal_reason}"] if refusal_reason else [],
                    suggestions=["Panatilihin ang usapan sa itinakdang sitwasyon."],
                    politeness_marker_detected=None,
                    topic_relevance_score=0.1,
                    confidence=0.95,
                ),
                safety_flag=True,
                model_version="fluentt-dialogue-v1.0",
                simulated=True,
            )

        # Check turn completion
        if turns_count >= max_turns:
            if language == "tagalog":
                assistant_text = (
                    "Napakagaling ng iyong pakikipag-usap ngayong araw! Maraming salamat sa oras at "
                    "tiyaga sa pagsasanay. Maaari mo nang tapusin ang sesyon upang makita ang iyong buod."
                )
                summary = "Matagumpay na natapos ang buong sesyon ng usapan."
            else:
                assistant_text = (
                    "Great job completing our conversation practice today! Thank you for participating. "
                    "You may now wrap up the session to review your formative summary."
                )
                summary = "Successfully reached the practice turn milestone."

            return ProviderTurnResponse(
                assistant_text=assistant_text,
                feedback=FormativeLanguageFeedbackDTO(
                    summary=summary,
                    corrections=[],
                    suggestions=["Ipagpatuloy ang regular na pagsasanay sa pakikipag-usap."],
                    politeness_marker_detected=True,
                    topic_relevance_score=1.0,
                    confidence=0.95,
                ),
                safety_flag=False,
                model_version="fluentt-dialogue-v1.0",
                simulated=True,
            )

        # Linguistic heuristics
        lower_input = user_input.lower()
        persona = topic_context.get("persona", "Partner")
        scenario = topic_context.get("scenario_description", "")
        vocab_hints = topic_context.get("vocabulary_hints", [])

        # Check politeness markers
        politeness_detected: bool | None = None
        if language == "tagalog":
            polite_markers = ["po", "opo", "salamat", "maraming salamat", "paki", "pasensya"]
            politeness_detected = any(re.search(r"\b" + m + r"\b", lower_input) for m in polite_markers)
        elif language == "english":
            polite_markers = ["please", "thank you", "thanks", "excuse me", "appreciate"]
            politeness_detected = any(re.search(r"\b" + m + r"\b", lower_input) for m in polite_markers)

        # Check vocabulary relevance
        matched_hints = [v for v in vocab_hints if v.lower() in lower_input]
        relevance_score = min(1.0, 0.4 + (len(matched_hints) * 0.2))

        # Feedback generation
        corrections = []
        suggestions = []

        if language == "tagalog":
            if not politeness_detected and "guro" in persona.lower():
                suggestions.append("Subukang maglagay ng 'po' o 'opo' kapag kausap ang guro o nakatatanda.")
            if len(user_input.split()) < 3:
                suggestions.append("Subukang magbigay ng buong pangungusap upang mas humusay sa pagpapahayag.")
            if matched_hints:
                summary = f"Mahusay! Nagamit mo ang mga angkop na salita: {', '.join(matched_hints)}."
            else:
                summary = "Maganda ang iyong tugon. Ipagpatuloy ang pagpapalawak ng mga pangungusap."

            # Authentic situational replies based on scenario keywords
            if "pangalan" in lower_input or "ako si" in lower_input or "ako po si" in lower_input:
                assistant_text = (
                    "Ikinagagalak kitang makilala! Taga-saan ka naman? "
                    "At ano ang paborito mong aralin dito sa paaralan?"
                )
            elif "taga" in lower_input or "nakatira" in lower_input:
                assistant_text = (
                    "Magandang lugar iyon! Ako naman ay malapit lang din dito. "
                    "Ano ang karaniwan mong ginagawa kapag walang pasok?"
                )
            elif "magkano" in lower_input or "presyo" in lower_input:
                assistant_text = (
                    "Tig-isang daang piso po bawat kilo ang mga ito. "
                    "Ilang kilo po ang nais ninyong timbangin ko?"
                )
            elif "kilo" in lower_input or "kalahati" in lower_input or "pabili" in lower_input:
                assistant_text = (
                    "Sige po, heto na ang sariwang prutas para sa iyo. "
                    "Mayroon pa po ba kayong ibang kailangan?"
                )
            elif "saan" in lower_input or "direksyon" in lower_input or "punta" in lower_input:
                assistant_text = (
                    "Dumiretso ka lang po sa kalyeng ito, pagkatapos ay kumaliwa sa may kanto ng plasa. "
                    "Malapit lang iyon, mga limang minutong lakad. Malinaw po ba?"
                )
            elif "salamat" in lower_input:
                assistant_text = (
                    "Walang anuman po! Masaya akong makatulong. "
                    "Mag-ingat ka sa iyong paglalakad o pag-uwi."
                )
            else:
                assistant_text = (
                    f"Naiintindihan ko. Ayon sa ating sitwasyon ({scenario}), "
                    "ano pa ang nais mong itanong o ibahagi sa akin?"
                )

        else:  # English
            if len(user_input.split()) < 3:
                suggestions.append("Try answering in complete sentences to build confidence.")
            if matched_hints:
                summary = f"Good job! You effectively incorporated key terms: {', '.join(matched_hints)}."
            else:
                summary = "Clear and responsive answer. Keep maintaining active dialogue."

            if "name is" in lower_input or "i'm" in lower_input or "i am" in lower_input:
                assistant_text = (
                    "It's really nice to meet you! Where are you from, "
                    "and what is your favorite subject here at school?"
                )
            elif "subject" in lower_input or "math" in lower_input or "science" in lower_input:
                assistant_text = (
                    "That's an interesting subject! Our teachers are great. "
                    "Have you joined any clubs or campus sports yet?"
                )
            elif "order" in lower_input or "coffee" in lower_input or "like" in lower_input or "want" in lower_input:
                assistant_text = (
                    "Excellent choice! Would you like that hot or iced, "
                    "and would you care for any pastries on the side today?"
                )
            elif "hot" in lower_input or "iced" in lower_input or "pastry" in lower_input:
                assistant_text = (
                    "Got it! That comes to 120 pesos total. "
                    "Will that be cash or card for payment?"
                )
            elif "thank" in lower_input:
                assistant_text = (
                    "You're very welcome! Have a wonderful day, and enjoy your time here!"
                )
            else:
                assistant_text = (
                    f"That's great! Keeping with our scenario, "
                    "what would you like to say or ask next?"
                )

        feedback_dto = FormativeLanguageFeedbackDTO(
            summary=summary,
            corrections=corrections,
            suggestions=suggestions,
            politeness_marker_detected=politeness_detected,
            topic_relevance_score=relevance_score,
            confidence=0.92,
        )

        return ProviderTurnResponse(
            assistant_text=assistant_text,
            feedback=feedback_dto,
            safety_flag=False,
            model_version="fluentt-dialogue-v1.0",
            simulated=True,
        )


class ConversationProviderRegistry:
    """Manages provider selection and execution."""

    @classmethod
    def reply(
        cls,
        user_input: str,
        history: list[dict[str, Any]],
        topic_context: dict[str, Any],
        language: str,
        turns_count: int,
        max_turns: int = 15,
    ) -> ProviderTurnResponse:
        # Default to EducationalDialogueEngine (deterministic, privacy-guaranteed, local)
        return EducationalDialogueEngine.generate_turn(
            user_input=user_input,
            history=history,
            topic_context=topic_context,
            language=language,
            turns_count=turns_count,
            max_turns=max_turns,
        )
