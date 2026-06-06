"""Kiwoom REST adapter skeleton.

OpenAPI+ OCX/COM integration should remain isolated from the FastAPI process.
"""

from backend.brokers.not_configured import NotConfiguredBrokerAdapter


class KiwoomBrokerAdapter(NotConfiguredBrokerAdapter):
    broker_id = "kiwoom"
    broker_name = "키움증권"
