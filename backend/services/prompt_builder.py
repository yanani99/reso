import json
import os

import anthropic

from services.analyzer import TasteProfile

SYSTEM_PROMPT = """You are a music prompt engineer specializing in AI music generation. 
You will receive a structured taste profile derived from a user's Spotify listening history.
Your job is to generate two music generation prompts that describe a song this user would love.

Rules:
- DO NOT reference the user's actual tracks or artists by name in the prompts
- Write prompts that describe the SOUND, not the source material
- Suno prompt: comma-separated style tags + mood words + instrumentation + tempo feel + vocal direction. Max 120 words.
- Lyria prompt: descriptive prose focused on sonic texture, arrangement, production techniques, and instrumentation. Max 120 words.
- Both prompts should describe the SAME song concept, just formatted differently

Return ONLY valid JSON in this format:
{
  "suno_prompt": "...",
  "lyria_prompt": "...",
  "song_concept": "One sentence describing the song concept in plain English",
  "mood": "one word",
  "tempo_feel": "one of: slow / midtempo / uptempo / driving",
  "energy_estimate": 0.0 to 1.0,
  "valence_estimate": 0.0 to 1.0
}"""


async def generate_prompts(profile: TasteProfile, novelty_level: float = 0.2) -> dict:
    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    user_message = (
        f"Here is the user's musical taste profile (JSON). "
        f"Novelty dial is at {novelty_level:.1f} (0 = pure comfort zone, 1 = maximum exploration).\n\n"
        f"{profile.model_dump_json(indent=2)}"
    )

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    text = response.content[0].text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
        if text.endswith("```"):
            text = text[:-3]

    return json.loads(text)
