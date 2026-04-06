# MCP 도구 - 국회 API 매핑

> 최종 검증일: 2026-04-04
> 31개 API 코드 검증 완료, 전체 정상 작동 확인

---

## Lite 프로필 도구 (7개)

Lite 프로필은 7개의 통합 도구로 전체 API를 효율적으로 활용합니다.

### 1. search_members -- 의원 검색/상세

| API 코드 | API명 | 비고 |
|----------|-------|------|
| `nwvrqwxyaytdsfvhu` | 국회의원 인적사항 | 295건, AGE 불필요 |

- **파라미터**: `HG_NM`(이름), `POLY_NM`(정당), `ORIG_NM`(선거구)
- **응답 필드**: HG_NM, HJ_NM, ENG_NM, BTH_DATE, POLY_NM, ORIG_NM, REELE_GBN_NM, ELECT_GBN_NM, CMITS, TEL_NO, E_MAIL, HOMEPAGE, 사진(`https://www.assembly.go.kr/photo/{MONA_CD}.jpg`), 의원코드(MONA_CD)
- **참고**: `UNIT_CD` 파라미터 미사용 (현재 의원만 반환, 형식 오류 방지)

### 2. search_bills -- 의안 검색/상세/상태 필터

| API 코드 | API명 | 용도 | 비고 |
|----------|-------|------|------|
| `nzmimeepazxkubdpn` | 의원 발의법률안 | 기본 검색 | AGE 필요 |
| `nwbqublzajtcqpdae` | 계류의안 | status=pending | 13,006건, AGE 불필요 |
| `nzpltgfqabtcpsmai` | 처리의안 | status=processed | 4,620건, AGE 필요 |
| `nxjuyqnxadtotdrbw` | 최근 본회의 처리 | status=recent | 1,201건, AGE 필요 |
| `BILLINFODETAIL` | 의안 상세정보 | bill_id 지정 시 | BILL_ID 필요, 주요 필드 누락 시 MEMBER_BILLS로 자동 보완 |

### 3. search_records -- 일정/회의록/표결

| API 코드 | API명 | 용도 | 비고 |
|----------|-------|------|------|
| `ALLSCHEDULE` | 국회일정 통합 | 일정 조회 | 90,201건, AGE 불필요 |
| `ncwgseseafwbuheph` | 위원회 회의록 | 위원회 회의 | DAE_NUM + CONF_DATE 필요 |
| `nzbyfwhwaoanttzje` | 본회의 회의록 | 본회의 회의 | DAE_NUM + CONF_DATE 필요 |
| `VCONFAPIGCONFLIST` | 국정감사 회의록 | 국감 회의 | ERACO 필요 |
| `VCONFCFRMCONFLIST` | 인사청문회 회의록 | 인사청문 회의 | ERACO 필요 |
| `VCONFPHCONFLIST` | 공청회 회의록 | 공청회 회의 | ERACO 필요 |
| `ncocpgfiaoituanbr` | 의안별 표결현황 | 표결 조회 | 1,352건, AGE 필요 |

### 4. analyze_legislator -- 의원 종합분석 (체인)

3개 API를 병렬 호출하여 의원의 의정활동을 종합 분석합니다.

| API 코드 | API명 | 용도 |
|----------|-------|------|
| `nwvrqwxyaytdsfvhu` | 국회의원 인적사항 | 인적사항 조회 |
| `nzmimeepazxkubdpn` | 의원 발의법률안 | 발의 법안 목록 |
| `nwbpacrgavhjryiph` | 본회의 표결정보 | 표결 참여 현황 |

### 5. track_legislation -- 주제별 법안 추적 (체인)

키워드로 관련 법안을 검색하고 심사 이력을 조회합니다.

| API 코드 | API명 | 용도 |
|----------|-------|------|
| `nzmimeepazxkubdpn` | 의원 발의법률안 | 키워드별 법안 검색 |
| `BILLJUDGE` | 의안 심사정보 | 심사 이력 조회 (옵션) |

### 6. discover_apis -- API 탐색

| API 코드 | API명 | 비고 |
|----------|-------|------|
| `OPENSRVAPI` | OPEN API 전체 현황 | 276건 |

### 7. query_assembly -- 범용 API 호출

임의의 API 코드를 직접 호출할 수 있는 범용 도구입니다.

- 31개 검증 코드 및 미등록 코드 모두 호출 가능

---

## Full 프로필 추가 도구 (16개)

Full 프로필은 Lite 7개 도구에 아래 16개 도구를 추가로 제공합니다.

| # | 도구명 | 설명 | 사용 API 코드 |
|---|--------|------|---------------|
| 1 | get_members | 국회의원 검색 | `nwvrqwxyaytdsfvhu` |
| 2 | get_member_detail | 의원 상세 정보 | `nwvrqwxyaytdsfvhu` |
| 3 | search_bills (full) | 의안 검색 | `nzmimeepazxkubdpn` |
| 4 | get_bill_detail | 의안 상세 | `BILLINFODETAIL` |
| 5 | get_vote_results | 표결 정보 | `ncocpgfiaoituanbr` |
| 6 | get_schedule | 국회 일정 | `ALLSCHEDULE`, `nekcaiymatialqlxr`, `nrsldhjpaemrmolla` |
| 7 | search_meeting_records | 회의록 검색 | `nzbyfwhwaoanttzje`, `ncwgseseafwbuheph`, `VCONFAPIGCONFLIST`, `VCONFCFRMCONFLIST`, `VCONFPHCONFLIST` |
| 8 | get_committees | 위원회 목록 | `nxrvzonlafugpqjuh`, `nktulghcadyhmiqxi` |
| 9 | search_petitions | 청원 검색 | `nvqbafvaajdiqhehi`, `PTTRCP`, `PTTINFODETAIL` |
| 10 | get_legislation_notices | 입법예고 | `nknalejkafmvgzmpt`, `nohgwtzsamojdozky` |
| 11 | get_bill_extras | 의안 부가정보 | `nwbqublzajtcqpdae`, `nzpltgfqabtcpsmai`, `nxjuyqnxadtotdrbw` 등 |
| 12 | get_speeches | 의원 발언 | 회의록 API 활용 |
| 13 | search_library | 국회도서관 | 별도 API |
| 14 | get_budget_analysis | 예산정책처 | 별도 API |
| 15 | search_research_reports | 입법조사처 | 별도 API |
| 16 | discover_apis | API 탐색 | `OPENSRVAPI` |

---

## 검증 완료 API 코드 총정리 (31개)

모든 코드는 실제 API 호출로 정상 작동을 확인했습니다.

### 국회의원 (2개)

| # | API 코드 | API명 | 데이터 수 | AGE |
|---|----------|-------|----------|-----|
| 1 | `nwvrqwxyaytdsfvhu` | 국회의원 인적사항 | 295건 | 불필요 |
| 2 | `ALLNAMEMBER` | 국회의원 정보 통합 | 3,286건 | 불필요 |

### 의안/법률안 (11개)

| # | API 코드 | API명 | 데이터 수 | AGE |
|---|----------|-------|----------|-----|
| 3 | `nzmimeepazxkubdpn` | 의원 발의법률안 | - | 필요 |
| 4 | `TVBPMBILL11` | 의안 통합검색 | 17,626건 | 필요 |
| 5 | `BILLRCP` | 의안 접수목록 | 118,682건 | 불필요 |
| 6 | `BILLJUDGE` | 의안 심사정보 | 35,329건 | 불필요 |
| 7 | `BILLINFODETAIL` | 의안 상세정보 | BILL_ID 필요 | 불필요 |
| 8 | `nwbqublzajtcqpdae` | 계류의안 | 13,006건 | 불필요 |
| 9 | `nzpltgfqabtcpsmai` | 처리의안 | 4,620건 | 필요 |
| 10 | `nayjnliqaexiioauy` | 본회의부의안건 | 139건 | 불필요 |
| 11 | `BILLCNTMAIN` | 처리 의안통계 총괄 | - | - |
| 12 | `BILLCNTCMIT` | 처리 의안통계 위원회별 | - | - |
| 13 | `BILLCNTLAWCMIT` | 처리 의안통계 위원회별 법률안 | - | - |

### 표결 (2개)

| # | API 코드 | API명 | 데이터 수 | AGE |
|---|----------|-------|----------|-----|
| 14 | `ncocpgfiaoituanbr` | 의안별 표결현황 | 1,352건 | 필요 |
| 15 | `nwbpacrgavhjryiph` | 본회의 표결정보 | 1,315건 | 필요 |

### 일정 (3개)

| # | API 코드 | API명 | 데이터 수 | AGE |
|---|----------|-------|----------|-----|
| 16 | `ALLSCHEDULE` | 국회일정 통합 | 90,201건 | 불필요 |
| 17 | `nekcaiymatialqlxr` | 본회의 일정 | - | UNIT_CD 필요 |
| 18 | `nrsldhjpaemrmolla` | 위원회별 일정 | - | UNIT_CD 필요 |

### 회의록 (5개)

| # | API 코드 | API명 | 데이터 수 | 필수 파라미터 |
|---|----------|-------|----------|-------------|
| 19 | `nzbyfwhwaoanttzje` | 본회의 회의록 | - | DAE_NUM + CONF_DATE |
| 20 | `ncwgseseafwbuheph` | 위원회 회의록 | - | DAE_NUM + CONF_DATE |
| 21 | `VCONFAPIGCONFLIST` | 국정감사 회의록 | - | ERACO |
| 22 | `VCONFCFRMCONFLIST` | 인사청문회 회의록 | - | ERACO |
| 23 | `VCONFPHCONFLIST` | 공청회 회의록 | - | ERACO |

### 위원회 (2개)

| # | API 코드 | API명 | 데이터 수 | AGE |
|---|----------|-------|----------|-----|
| 24 | `nxrvzonlafugpqjuh` | 위원회 현황 정보 | 356건 | 불필요 |
| 25 | `nktulghcadyhmiqxi` | 위원회 위원 명단 | 524건 | 불필요 |

### 청원 (3개)

| # | API 코드 | API명 | 데이터 수 | 필수 파라미터 |
|---|----------|-------|----------|-------------|
| 26 | `nvqbafvaajdiqhehi` | 청원 계류현황 | 276건 | AGE 불필요 |
| 27 | `PTTRCP` | 청원 접수목록 | - | ERACO 필요 |
| 28 | `PTTINFODETAIL` | 청원 상세정보 | - | PTT_ID 필요 |

### 입법예고 (2개)

| # | API 코드 | API명 | 데이터 수 | AGE |
|---|----------|-------|----------|-----|
| 29 | `nknalejkafmvgzmpt` | 진행중 입법예고 | 265건 | 불필요 |
| 30 | `nohgwtzsamojdozky` | 종료된 입법예고 | 16,565건 | 필요 |

### 메타/기타 (2개)

| # | API 코드 | API명 | 데이터 수 | AGE |
|---|----------|-------|----------|-----|
| 31 | `OPENSRVAPI` | OPEN API 전체 현황 | 276건 | 불필요 |
| - | `BILLSESSPROD` | 회기정보 | - | - |
