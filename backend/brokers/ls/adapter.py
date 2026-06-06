"""LS Securities adapter skeleton."""

from backend.brokers.not_configured import NotConfiguredBrokerAdapter


class LSBrokerAdapter(NotConfiguredBrokerAdapter):
    broker_id = "ls"
    broker_name = "LS증권"
