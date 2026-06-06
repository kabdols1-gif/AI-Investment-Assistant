"""KB Securities adapter skeleton.

Official endpoint/TR mapping must be supplied in config/brokers/kb/endpoints.yaml
before this adapter can call KB OpenAPI.
"""

from backend.brokers.not_configured import NotConfiguredBrokerAdapter


class KBBrokerAdapter(NotConfiguredBrokerAdapter):
    broker_id = "kb"
    broker_name = "KB증권"
