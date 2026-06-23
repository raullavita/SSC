"""Auto-translation route — disabled by default (Engine 1.2)."""
from fastapi import APIRouter, Depends, HTTPException

from core.auth import get_current_user
from core.models import TranslateIn
from core.translation import translate_text
from core.translation_access import TRANSLATION_DISABLED_DETAIL, is_translation_allowed

router = APIRouter()


@router.post("")
async def translate(body: TranslateIn, current=Depends(get_current_user)):
    if not is_translation_allowed():
        raise HTTPException(403, TRANSLATION_DISABLED_DETAIL)
    if not body.text or not body.target_language:
        raise HTTPException(400, "Missing text or target_language")

    translated, provider, note = translate_text(
        body.text.strip(),
        body.target_language,
        body.source_language,
    )
    out = {"translated": translated, "target_language": body.target_language.lower(), "provider": provider}
    if note:
        out["note"] = note
    return out