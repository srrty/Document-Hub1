import os
import google.generativeai as genai

def generate_summary(text: str, additional_prompt: str = "", requested_model: str = "") -> str:
    """
    Generate a summary of the provided text using Google Gemini models.
    If GEMINI_API_KEY is not set, it returns a mock summary for local testing.
    Requirements covered: FR-02 (additional prompt), FR-05 (sources at the bottom).
    """
    # .env 파일이 존재하는 경우 환경변수 수동 로드
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(env_path):
        env_path = ".env"
        
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if "=" in line and not line.strip().startswith("#"):
                        k, v = line.split("=", 1)
                        os.environ[k.strip()] = v.strip().strip("'").strip('"')
        except Exception as e:
            print(f"Warning: Failed to load .env file manually: {e}")

    # GEMINI_API_KEY 또는 GOOGLE_API_KEY 환경변수 로드
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    
    if not api_key:
        print("Warning: GEMINI_API_KEY or GOOGLE_API_KEY not found. Returning mock summary.")
        mock_summary = f"""[Mock Summary - API Key가 설정되지 않았습니다]
배경: 입력된 문서는 테스트용 가상 텍스트로 간주됩니다.
목표: 로컬 환경에서의 백엔드 기능 정상 작동 확인.
추가 조건 반영: '{additional_prompt}'

---
출처: 
• 사용자 제공 텍스트 기반 자동 생성 (Mock)"""
        return mock_summary

    # API 키 양 끝의 따옴표나 공백이 윈도우 환경설정 중 유입되었을 수 있으므로 정제
    api_key = api_key.strip().strip("'").strip('"')

    # Gemini SDK 설정
    genai.configure(api_key=api_key)
    
    system_instruction = (
        "당신은 전문적인 문서 요약 AI입니다. "
        "사용자가 제공한 텍스트를 구조적으로 요약해주세요. "
        "이때, 마크다운 형식의 볼드 기호(예: **)나 에스터리스크(글머리 기호 *)는 절대 사용하지 마세요. "
        "대신 문단 구분, 줄바꿈, 그리고 번호(예: 1., 2.) 또는 원 기호(•) 등을 사용하여 깔끔한 일반 텍스트 형식으로 작성해주세요. "
        "반드시 요약문 맨 밑 부분에 '출처:' 항목을 만들어, 요약한 내용이 어디서 발췌되었는지 명시해야 합니다."
    )
    
    user_prompt = f"다음 텍스트를 요약해주세요:\n\n{text}\n\n"
    if additional_prompt:
        user_prompt += f"요약 시 다음 추가 조건을 반드시 지켜주세요: {additional_prompt}"

    # 1. 사용 가능한 모델 탐색 시도
    available_models = []
    try:
        models = genai.list_models()
        for m in models:
            if 'generateContent' in m.supported_generation_methods:
                model_short_name = m.name.replace("models/", "")
                available_models.append(model_short_name)
    except Exception as list_err:
        print(f"Warning: Could not list models ({list_err}). Using default fallback list.")

    # 2. 순차적으로 시도할 우선순위 모델 리스트 정의
    preferred_models = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-2.0-flash",
        "gemini-2.0-flash-exp",
        "gemini-1.5-pro",
        "gemini-pro"
    ]
    
    # list_models()에 잡히는 모델이 있다면 해당 모델들을 우선적으로 후보군에 매핑
    models_to_try = []
    for model_name in available_models:
        if any(pref in model_name for pref in ["flash", "pro"]):
            models_to_try.append(model_name)
            
    # 선호하는 핵심 모델군이 시도 리스트에 없다면 뒷단에 순서대로 추가
    for pref in preferred_models:
        if pref not in models_to_try:
            models_to_try.append(pref)
            
    # 최소한 기본값으로 gemini-1.5-flash 가 가장 앞에 오도록 보장
    if "gemini-1.5-flash" in models_to_try:
        models_to_try.remove("gemini-1.5-flash")
    models_to_try.insert(0, "gemini-1.5-flash")

    # 사용자가 선호하는 특정 모델을 요청했을 경우 해당 모델을 최우선 순위로 지정
    if requested_model:
        requested_model = requested_model.strip()
        if requested_model in models_to_try:
            models_to_try.remove(requested_model)
        models_to_try.insert(0, requested_model)

    last_error = None
    # 3. 모델 리스트를 순회하며 정상 요약 시도 (자가 치유 로직)
    for model_name in models_to_try:
        try:
            print(f"Attempting to generate summary using model: {model_name}...")
            model = genai.GenerativeModel(
                model_name=model_name,
                system_instruction=system_instruction
            )
            response = model.generate_content(user_prompt)
            print(f"Successfully generated summary using model: {model_name}")
            return response.text.strip()
        except Exception as e:
            print(f"Failed with model {model_name}: {e}")
            last_error = e
            # 404 에러나 다른 일시적인 에러가 날 경우 다음 모델로 즉시 폴백
            continue

    # 모든 후보 모델 시도가 실패한 경우
    print("All models failed to generate content.")
    return f"요약 중 오류가 발생했습니다: {str(last_error or 'No available models could be loaded')}"


def answer_document_question(text: str, question: str, requested_model: str = "") -> str:
    """
    문서 내용을 기반으로 사용자의 질문에 답하는 Q&A 함수
    """
    # .env 파일이 존재하는 경우 환경변수 수동 로드
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if not os.path.exists(env_path):
        env_path = ".env"
        
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    if "=" in line and not line.strip().startswith("#"):
                        k, v = line.split("=", 1)
                        os.environ[k.strip()] = v.strip().strip("'").strip('"')
        except Exception as e:
            print(f"Warning: Failed to load .env file manually: {e}")

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("Warning: GEMINI_API_KEY or GOOGLE_API_KEY not found. Returning mock Q&A response.")
        return f"[Mock Q&A 답변 - API Key 없음]\n질문하신 '{question}'에 대해 답변드립니다. 본 대답은 로컬 개발용 모의(Mock) 기능입니다. 원격 API 키가 등록되면 문서의 내용을 심층 분석하여 정확하게 보충 설명해 줍니다."
        
    api_key = api_key.strip().strip("'").strip('"')
    genai.configure(api_key=api_key)
    
    system_instruction = (
        "당신은 전문적인 문서 분석 AI 비서입니다. "
        "제시된 문서(원문 또는 요약본)의 내용을 철저히 파악하고, 오직 제공된 문서 내용에 기반하여 사용자의 질문에 친절하고 명확하게 답변해 주세요."
    )
    
    user_prompt = (
        f"제시된 문서 내용:\n{text}\n\n"
        f"사용자 질문: {question}\n\n"
        "위 문서의 내용을 기반으로 질문에 대한 명쾌한 답변을 2~3줄 내외로 간결하게 작성해 주세요."
    )
    
    # 1. 사용 가능한 모델 탐색 시도
    available_models = []
    try:
        models = genai.list_models()
        for m in models:
            if 'generateContent' in m.supported_generation_methods:
                model_short_name = m.name.replace("models/", "")
                available_models.append(model_short_name)
    except Exception as list_err:
        print(f"Warning: Could not list models ({list_err}). Using default fallback list.")

    preferred_models = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-latest",
        "gemini-2.0-flash",
        "gemini-2.0-flash-exp",
        "gemini-1.5-pro",
        "gemini-pro"
    ]
    
    models_to_try = []
    for model_name in available_models:
        if any(pref in model_name for pref in ["flash", "pro"]):
            models_to_try.append(model_name)
            
    for pref in preferred_models:
        if pref not in models_to_try:
            models_to_try.append(pref)
            
    if "gemini-1.5-flash" in models_to_try:
        models_to_try.remove("gemini-1.5-flash")
    models_to_try.insert(0, "gemini-1.5-flash")
    
    if requested_model:
        requested_model = requested_model.strip()
        if requested_model in models_to_try:
            models_to_try.remove(requested_model)
        models_to_try.insert(0, requested_model)
        
    last_error = None
    for model_name in models_to_try:
        try:
            print(f"QA: Attempting with model: {model_name}...")
            model = genai.GenerativeModel(model_name=model_name, system_instruction=system_instruction)
            response = model.generate_content(user_prompt)
            print(f"QA: Successfully answered using model: {model_name}")
            return response.text.strip()
        except Exception as e:
            print(f"QA: Failed with model {model_name}: {e}")
            last_error = e
            continue
            
    return f"답변 생성 중 오류가 발생했습니다: {str(last_error or 'No available models could be loaded')}"

