# Master Files

사용자가 증권사 공식 마스터파일을 내려받아 broker별 `raw/` 폴더에 두고,
파싱 결과는 `parsed/` 아래에 저장하는 구조를 목표로 합니다.

```text
master/
  kb/raw/
  kb/parsed/
  kis/raw/
  kis/parsed/
  ls/raw/
  ls/parsed/
  kiwoom/raw/
  kiwoom/parsed/
```

공식 마스터파일이 없으면 실제 주문 검증은 통과시키지 않습니다.
