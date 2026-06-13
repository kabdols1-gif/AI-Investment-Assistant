"""KB Securities B2C OpenAPI adapter."""

from backend.brokers.models import AuthStatus, BrokerCapabilities
from backend.brokers.not_configured import NotConfiguredBrokerAdapter
from backend.services import secure_config
from backend.services.kb_openapi_service import issue_kb_b2c_token, test_kb_connection


class KBBrokerAdapter(NotConfiguredBrokerAdapter):
    broker_id = "kb"
    broker_name = "KB Securities"

    async def get_capabilities(self) -> BrokerCapabilities:
        kb_config = secure_config.load_config()["kb"]
        configured = bool((kb_config.get("api_key") or "").strip() and (kb_config.get("api_secret") or "").strip())
        return BrokerCapabilities(
            broker=self.broker_id,
            broker_name=self.broker_name,
            configured=configured,
            message=(
                "KB B2C OpenAPI token/proxy integration is configured."
                if configured
                else "KB B2C OpenAPI clientId/App Key and clientSecret/Secret are required."
            ),
        )

    async def test_connection(self) -> AuthStatus:
        result = await test_kb_connection()
        status = "success" if result.status == "success" else "missing" if result.status == "missing" else "failed"
        return AuthStatus(
            broker=self.broker_id,
            status=status,
            message=result.message,
            token_received=result.token_received,
            raw=result.raw_response_masked or {},
        )

    async def get_access_token(self, force_refresh: bool = False) -> AuthStatus:
        try:
            result = await issue_kb_b2c_token()
            return AuthStatus(
                broker=self.broker_id,
                status="success",
                message="KB B2C OpenAPI OAuth2 token issued.",
                token_received=True,
                raw=result["raw_response_masked"],
            )
        except Exception as exc:
            return AuthStatus(
                broker=self.broker_id,
                status="failed",
                message=f"KB B2C OpenAPI token issue failed: {exc.__class__.__name__}",
            )
