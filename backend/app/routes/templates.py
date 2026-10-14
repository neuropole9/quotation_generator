from fastapi import APIRouter

router = APIRouter(prefix="/templates", tags=["templates"])

@router.get("")
def list_templates():
    return [
        {"id":"classic","name":"Company Classic"},
        {"id":"corporate","name":"Corporate"},
        {"id":"modern","name":"Modern"},
        {"id":"compact","name":"Compact"},
    ]
