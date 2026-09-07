"""
Thin wrapper around the real Mistral AI API. No mocked responses:
every function here makes an actual HTTPS call to api.mistral.ai using
MISTRAL_API_KEY from the environment (see app/config.py). If the key
is missing or a call fails, we raise MistralError with a message that
the routers turn into a clean user-facing error instead of a stack trace.
"""
import base64
import json
from typing import Optional
LANGUAGE_NAMES = {
    "en": "English",
    "hi": "Hindi",
    "te": "Telugu",
    "ta": "Tamil",
    "kn": "Kannada",
}

import httpx

from app.config import settings

MISTRAL_BASE_URL = "https://api.mistral.ai/v1"
OCR_MODEL = "mistral-ocr-latest"
CHAT_MODEL = "mistral-small-latest"


class MistralError(Exception):
    pass


def _require_key():
    if not settings.mistral_configured:
        raise MistralError(
            "Mistral API key is not configured. Set MISTRAL_API_KEY in the backend .env file."
        )


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {settings.mistral_api_key}",
        "Content-Type": "application/json",
    }


def _image_to_data_url(image_path: str) -> str:
    ext = image_path.rsplit(".", 1)[-1].lower()
    mime = "image/png" if ext == "png" else "image/jpeg"
    with open(image_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")
    return f"data:{mime};base64,{b64}"


async def ocr_image(image_path: str) -> dict:
    """
    Calls Mistral's OCR endpoint on a single preprocessed page image.
    Returns {"markdown": str, "confidence": Optional[int]}.
    """
    _require_key()
    data_url = _image_to_data_url(image_path)

    payload = {
        "model": OCR_MODEL,
        "document": {"type": "image_url", "image_url": data_url},
        "include_image_base64": False,
    }

    async with httpx.AsyncClient(timeout=90) as client:
        try:
            resp = await client.post(f"{MISTRAL_BASE_URL}/ocr", headers=_headers(), json=payload)
        except httpx.RequestError as e:
            raise MistralError(f"Could not reach Mistral OCR API: {e}")

    if resp.status_code == 401:
        raise MistralError("Mistral API key was rejected (invalid key).")
    if resp.status_code == 429:
        raise MistralError("Mistral API rate limit reached. Please try again shortly.")
    if resp.status_code >= 400:
        raise MistralError(f"Mistral OCR API error ({resp.status_code}): {resp.text[:300]}")

    body = resp.json()
    pages = body.get("pages", [])
    markdown = "\n\n".join(p.get("markdown", "") for p in pages) if pages else body.get("text", "")
    return {"markdown": markdown or "", "confidence": None}


async def _chat(system: str, user: str, json_mode: bool = False, temperature: float = 0.2) -> str:
    _require_key()

    completion_args = {
        "temperature": temperature,
        "max_tokens": 4096,
        "top_p": 1,
    }

    if json_mode:
        completion_args["response_format"] = {"type": "json_object"}

    payload = {
        "model": CHAT_MODEL,
        "instructions": system,
        "inputs": [
            {"role": "user", "content": user}
        ],
        "completion_args": completion_args,
        "store": False,
    }

    async with httpx.AsyncClient(timeout=90) as client:
        try:
            resp = await client.post(
                f"{MISTRAL_BASE_URL}/conversations",
                headers=_headers(),
                json=payload,
            )
        except httpx.RequestError as e:
            raise MistralError(f"Could not reach Mistral API: {e}")

    if resp.status_code == 401:
        raise MistralError("Mistral API key was rejected (invalid key).")
    if resp.status_code == 429:
        raise MistralError("Mistral API rate limit reached. Please try again shortly.")
    if resp.status_code >= 400:
        raise MistralError(
            f"Mistral API error ({resp.status_code}): {resp.text[:300]}"
        )

    body = resp.json()

    try:
        outputs = body["outputs"]
        for output in outputs:
            if output.get("type") == "message.output":
                content = output.get("content", "")
                if isinstance(content, str):
                    return content

        raise KeyError("message.output content not found")
    except (KeyError, IndexError, TypeError):
        raise MistralError("Unexpected response shape from Mistral API.")

async def clean_and_structure(raw_ocr_markdown: str, language: str) -> dict:
    """
    Sends raw OCR text to Mistral for OCR correction, translation,
    and structuring into clean Markdown, with equations and tables
    pulled out separately.
    """

    # Convert language code into the actual target language name.
    target_language = LANGUAGE_NAMES.get(language, language)

    system = (
        "You are an expert note editor, OCR correction assistant, "
        "and professional translator.\n\n"

        f"SELECTED TARGET LANGUAGE: {target_language}\n\n"

        "TRANSLATION REQUIREMENTS:\n"
        "- The OCR text may be written in a language different from "
        "the selected target language.\n"
        "- The selected target language is the language the FINAL "
        "DIGITAL NOTES must be written in.\n"
        "- Translate ALL readable textual content into the selected "
        "target language.\n"
        "- Translate the title, headings, paragraphs, sentences, "
        "lists, and other explanatory text.\n"
        "- Do NOT leave sentences in the original language.\n"
        "- Do NOT produce mixed-language output.\n"
        "- If the target language is Tamil, write the final textual "
        "content in Tamil.\n"
        "- If the target language is English, write the final textual "
        "content in English.\n"
        "- If the target language is Telugu, write the final textual "
        "content in Telugu.\n"
        "- If the target language is Hindi, write the final textual "
        "content in Hindi.\n"
        "- If the target language is Kannada, write the final textual "
        "content in Kannada.\n"
        "- Preserve proper nouns, formulas, numbers, URLs, and "
        "technical terms when translation would be inappropriate.\n"
        "- Before returning the result, verify that the Markdown "
        "content is written in the selected target language.\n\n"

        "OCR CLEANUP REQUIREMENTS:\n"
        "- Fix obvious OCR spelling, spacing, and punctuation errors.\n"
        "- Correct OCR mistakes using the context of the handwritten notes.\n"
        "- NEVER change the original meaning.\n"
        "- NEVER invent information that is not present or clearly "
        "implied by the OCR text.\n"
        "- Remove OCR noise, repeated artifacts, and meaningless characters.\n"
        "- Preserve important facts, numbers, technical terms, and formulas.\n\n"

        "STRUCTURING REQUIREMENTS:\n"
        "- Create a meaningful title based only on the provided notes.\n"
        "- The title MUST be written in the selected target language.\n"
        "- Format the title as a Markdown H1 using '#'.\n"
        "- Identify the major topics or sections in the notes.\n"
        "- Use Markdown H2 headings ('##') for major sections.\n"
        "- Use Markdown H3 headings ('###') for relevant subsections.\n"
        "- Do not omit headings when the content contains distinct topics "
        "or sections.\n"
        "- Convert list-like content into Markdown bullet or numbered lists.\n"
        "- Keep paragraphs readable and logically organized.\n"
        "- Represent mathematical expressions in LaTeX, wrapped in "
        "$...$ or $$...$$.\n"
        "- Represent tables using Markdown table syntax.\n\n"

        "OUTPUT REQUIREMENTS:\n"
        "- Return ONLY a valid JSON object.\n"
        "- Do not return explanations outside the JSON object.\n"
        "- The markdown field must contain the complete translated and "
        "structured notes.\n\n"

        '{"markdown": "...", '
        '"equations": [{"raw": "...", "latex": "..."}], '
        '"tables": [{"rows": [["cell","cell"],["cell","cell"]]}]}'
    )

    user = (
        f"TARGET LANGUAGE: {target_language}\n\n"
        "Convert the following OCR text into clean, structured "
        f"{target_language} digital notes.\n\n"
        "IMPORTANT: Translate every readable sentence and piece of "
        "explanatory text into the target language. Do not leave the "
        "original language in the final Markdown unless it is a proper "
        "noun, formula, number, URL, or necessary technical term.\n\n"
        "OCR TEXT:\n\n"
        f"{raw_ocr_markdown}"
    )

    content = await _chat(
        system,
        user,
        json_mode=True,
        temperature=0.0,
    )

    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        # Fall back to treating the whole reply as markdown if the model
        # did not return valid JSON for some reason.
        data = {
            "markdown": content,
            "equations": [],
            "tables": [],
        }

    return {
        "markdown": data.get("markdown", ""),
        "equations": data.get("equations", []),
        "tables": data.get("tables", []),
    }


async def explain_topic(text: str, mode: str) -> str:
    mode_instructions = {
        "simple": "Explain this simply, in plain everyday language.",
        "detailed": "Explain this in full technical detail, thoroughly.",
        "exam": "Explain this the way a student should understand it for an exam answer, with key points to remember.",
        "example": "Explain this primarily through a clear worked example.",
        "beginner": "Explain this as if to a complete beginner with no background.",
    }
    instruction = mode_instructions.get(mode, mode_instructions["simple"])
    system = (
        "You are a study assistant explaining a topic taken from a student's own handwritten "
        "notes. Base your explanation on the given text; you may add well-established general "
        "knowledge to clarify it, but do not contradict the notes."
    )
    user = f"{instruction}\n\nTopic/content from the notes:\n\n{text}"
    return await _chat(system, user, temperature=0.4)


async def ask_notes(question: str, context: str) -> str:
    system = (
        "You are 'Ask My Notes', an assistant that answers questions using ONLY the provided "
        "notes content as context. If the answer is not present in the notes, clearly say so "
        "instead of guessing. Do not hallucinate facts not supported by the notes."
    )
    user = f"Notes content:\n\n{context}\n\nQuestion: {question}"
    return await _chat(system, user, temperature=0.2)


async def summarize(text: str, style: str) -> str:
    style_instructions = {
        "short": (
            "Write a clear, concise summary (3-5 bullet points or short paragraphs). "
            "Use '## Key Summary' as a heading, bullet points for key concepts, and bold (**term**) for vital terminology."
        ),
        "detailed": (
            "Write a comprehensive, well-structured summary. "
            "Organize with clear Markdown section headings (## Main Topic, ## Core Mechanisms, ## Important Takeaways), "
            "bullet points for lists and details, and bold (**term**) for key definitions and concepts."
        ),
        "exam_revision": (
            "Write a high-yield exam revision cheat sheet. "
            "Include: \n"
            "## Key Definitions & Formulas\n"
            "- List essential formulas and definitions with bold terms.\n"
            "## Critical Concepts to Remember\n"
            "- Bullet points of likely exam questions/concepts.\n"
            "## Quick Review Points\n"
            "- Fast recall bullet items."
        ),
    }
    instruction = style_instructions.get(style, style_instructions["short"])
    system = (
        "You are an expert study assistant. You summarize student notes faithfully and clearly without adding "
        "unsupported information. Always format your output directly in clean, structured Markdown using '##' for section "
        "headings, '-' for bullet points, and '**' for key terms. "
        "CRITICAL: Do NOT enclose the entire response in triple backtick code fences (e.g. do NOT use ```markdown or ```). "
        "Output the markdown text directly."
    )
    user = f"{instruction}\n\nNotes:\n\n{text}"
    raw = await _chat(system, user, temperature=0.3)
    cleaned = raw.strip()
    if cleaned.startswith("```markdown") and cleaned.endswith("```"):
        cleaned = cleaned[11:-3].strip()
    elif cleaned.startswith("```md") and cleaned.endswith("```"):
        cleaned = cleaned[5:-3].strip()
    elif cleaned.startswith("```") and cleaned.endswith("```") and len(cleaned) > 6:
        cleaned = cleaned[3:-3].strip()
    return cleaned


async def generate_questions(text: str, question_types: list, count: int, difficulty: str) -> str:
    system = (
        "You generate high quality study questions strictly from the given notes content. "
        "Respond ONLY with a JSON object: {\"questions\": [{\"type\": \"mcq\", \"question\": \"...\", "
        '"options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"], '
        '"answer": "A. Option 1", "explanation": "Detailed explanation of why this is correct and why other options are wrong."}, ...]}. '
        "For non-MCQ types (short_answer, long_answer, viva), omit 'options' and provide a comprehensive model 'answer' "
        "and 'explanation'. Types requested: "
        f"{', '.join(question_types)}. Difficulty: {difficulty}."
    )
    user = f"Generate {count} questions from these notes:\n\n{text}"
    return await _chat(system, user, json_mode=True, temperature=0.5)


async def explain_equation(latex: str, raw: Optional[str]) -> str:
    system = "You explain mathematical expressions clearly and concisely, step by step."
    user = f"Explain this equation.\nLaTeX: {latex}\nOriginal handwritten form (if available): {raw or 'n/a'}"
    return await _chat(system, user, temperature=0.3)
