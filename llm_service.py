import os
from google import genai
from google.genai import types

# 환경 변수에서 Gemini API Key를 가져와 최신 Client를 초기화합니다.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if GEMINI_API_KEY:
    client = genai.Client(api_key=GEMINI_API_KEY)
else:
    client = None
    print("⚠️ WARNING: GEMINI_API_KEY가 환경 변수에 설정되지 않았습니다.")

def generate_summary(text: str, custom_prompt: str = "", model_name: str = "") -> str:
    """
    최신 Gemini 모델을 사용하여 텍스트를 요약합니다. (404 에러 방지)
    """
    if not client:
        return "AI 서비스가 설정되지 않았습니다. API Key를 확인해 주세요."
        
    if not text.strip():
        return "요약할 텍스트가 비어 있습니다."

    # [수정] 1.5 대신 무료 플랜 표준 모델인 'gemini-2.5-flash'를 기본값으로 사용합니다.
    selected_model = model_name if model_name else "gemini-2.5-flash"
    
    base_prompt = "주어진 본문 내용을 명확하고 가독성 좋게 요약해 주세요. 중요한 포인트는 불릿 포인트로 정리해 주시고, 필요하다면 출처나 핵심 키워드도 포함해 주세요."
    if custom_prompt:
        base_prompt += f"\n\n[추가 요청 사항]\n{custom_prompt}"

    try:
        response = client.models.generate_content(
            model=selected_model,
            contents=[f"{base_prompt}\n\n[본문 내용]\n{text}"]
        )
        return response.text
    except Exception as e:
        print(f"Gemini API Error: {e}")
        return f"AI 요약 중 오류가 발생했습니다: {str(e)}"

def answer_document_question(document_text: str, question: str, model_name: str = "") -> str:
    """
    요약된 문서 내용을 기반으로 Q&A 피드백을 제공합니다.
    """
    if not client:
        return "AI 서비스가 설정되지 않았습니다."
        
    # [수정] 여기도 마찬가지로 최신 모델명으로 적용합니다.
    selected_model = model_name if model_name else "gemini-2.5-flash"
    
    prompt = f"""
    당신은 문서 기반 질의응답 전문가입니다. 아래 제공된 [문서 내용]만을 바탕으로 [사용자 질문]에 친절하게 답해 주세요. 
    문서에 없는 내용이라면 추측하지 말고 "문서에서 해당 내용을 찾을 수 없습니다"라고 답해 주세요.
    
    [문서 내용]
    {document_text}
    
    [사용자 질문]
    {question}
    """
    
    try:
        response = client.models.generate_content(
            model=selected_model,
            contents=[prompt]
        )
        return response.text
    except Exception as e:
        print(f"Gemini Q&A Error: {e}")
        return f"AI 답변 중 오류가 발생했습니다: {str(e)}"
