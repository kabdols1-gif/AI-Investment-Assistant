"""Korea Investment Securities adapter skeleton."""

from backend.brokers.not_configured import NotConfiguredBrokerAdapter


class KISBrokerAdapter(NotConfiguredBrokerAdapter):
    broker_id = "kis"
    broker_name = "한국투자증권"
