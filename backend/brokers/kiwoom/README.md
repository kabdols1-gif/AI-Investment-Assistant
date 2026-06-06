# Kiwoom Broker Adapter

기본 대상은 REST API입니다. OCX/COM 방식은 `ocx_adapter.py`에 격리하고,
FastAPI 기본 프로세스에서 자동 import하지 않습니다.
