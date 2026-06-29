"""RFC 9116 security.txt — Q.58."""
from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from core.disclosure_policy import render_security_txt, API_ORIGIN

router = APIRouter()


@router.get("/.well-known/security.txt", include_in_schema=False)
async def security_txt():
    body = render_security_txt(canonical_origin=API_ORIGIN)
    return PlainTextResponse(content=body, media_type="text/plain; charset=utf-8")