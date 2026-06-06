"""
二쇰Ц ?ㅽ뻾 紐⑤뱢

Applied Skills: skills/investment-strategy-framework.md
- Signal ???ㅼ젣 二쇰Ц 蹂??
- 二쇰Ц ??寃利??섑뻾
- 二쇰Ц 援щ텇 留ㅽ븨
"""

import logging
import math

import pandas as pd

import kb_auth as ka
from core import data_fetcher
from core.position_manager import PositionManager
from core.risk_manager import RiskManager
from core.signal import Action, Signal

logging.basicConfig(level=logging.INFO)


class OrderExecutor:
    """
    二쇰Ц ?ㅽ뻾 ?대옒??
    """

    def __init__(self, env_dv: str = "demo", allow_duplicate_buy: bool = True):
        """
        Args:
            env_dv: ?섍꼍 援щ텇 (real/demo, prod/vps)
            allow_duplicate_buy: 以묐났 留ㅼ닔 ?덉슜 ?щ? (湲곕낯媛? True)
                - True: ?대? 蹂댁쑀 以묒씤 醫낅ぉ??異붽? 留ㅼ닔 媛??
                - False: ?대? 蹂댁쑀 以묒씤 醫낅ぉ 留ㅼ닔 遺덇? (湲곗〈 ?숈옉)
        """
        self.env_dv = env_dv
        self.allow_duplicate_buy = allow_duplicate_buy
        self.position_manager = PositionManager(env_dv)
        self.risk_manager = RiskManager()

    def execute_signal(self, signal: Signal) -> pd.DataFrame:
        """
        ?쒓렇?먯쓣 ?ㅼ젣 二쇰Ц?쇰줈 ?ㅽ뻾

        Args:
            signal: ?ъ옄 ?쒓렇??

        Returns:
            二쇰Ц 寃곌낵 DataFrame (?ㅽ뙣 ??鍮?DataFrame)

        ?먮쫫:
            1. HOLD ?쒓렇????臾댁떆
            2. ?쒓렇??媛뺣룄 泥댄겕
            3. 以묐났 二쇰Ц 泥댄겕 (留ㅼ닔)
            4. 蹂댁쑀 ?щ? 泥댄겕 (留ㅻ룄)
            5. 二쇰Ц ?뚮씪誘명꽣 寃곗젙
            6. order_cash() ?몄텧
        """
        # 1. HOLD ?쒓렇??臾댁떆
        if signal.action == Action.HOLD:
            logging.info(f"HOLD ?쒓렇??- 二쇰Ц ?앸왂: {signal.stock_name}")
            return pd.DataFrame()

        # 2. ?쒓렇??媛뺣룄 泥댄겕
        if not signal.is_actionable():
            logging.info(f"?쏀븳 ?쒓렇??- 二쇰Ц ?앸왂: {signal} (strength < 0.5)")
            return pd.DataFrame()

        # 3. 留ㅼ닔: 以묐났 蹂댁쑀 泥댄겕 (allow_duplicate_buy媛 False???뚮쭔)
        if signal.action == Action.BUY and not self.allow_duplicate_buy:
            if self.position_manager.check_duplicate(signal.stock_code):
                logging.warning(f"?대? 蹂댁쑀 以?- 留ㅼ닔 ?앸왂: {signal.stock_name}")
                return pd.DataFrame()

        # 4. 留ㅻ룄: 蹂댁쑀 ?щ? 泥댄겕
        if signal.action == Action.SELL:
            quantity = self.position_manager.get_holding_quantity(signal.stock_code)
            if quantity <= 0:
                logging.warning(f"誘몃낫??醫낅ぉ - 留ㅻ룄 ?앸왂: {signal.stock_name}")
                return pd.DataFrame()

        # 5. 二쇰Ц ?뚮씪誘명꽣 寃곗젙
        ord_dvsn, ord_unpr = self._determine_order_type(signal)
        ord_qty = self._calculate_quantity(signal)

        if ord_qty <= 0:
            logging.warning(f"二쇰Ц ?섎웾 0 - 二쇰Ц ?앸왂: {signal.stock_name}")
            return pd.DataFrame()

        # 6. 二쇰Ц ?ㅽ뻾
        return self._execute_order(
            signal=signal,
            ord_dvsn=ord_dvsn,
            ord_unpr=ord_unpr,
            ord_qty=ord_qty
        )

    @staticmethod
    def _get_tick_size(price: int) -> int:
        """?쒓뎅 二쇱떇?쒖옣 ?멸??⑥쐞 (2023??湲곗?)"""
        if price < 2000:
            return 1
        elif price < 5000:
            return 5
        elif price < 20000:
            return 10
        elif price < 50000:
            return 50
        elif price < 200000:
            return 100
        elif price < 500000:
            return 500
        else:
            return 1000

    @staticmethod
    def _round_to_tick(price: int) -> int:
        """媛寃⑹쓣 ?멸??⑥쐞濡??대┝ (留ㅼ닔 ???좊━??諛⑺뼢)"""
        tick = OrderExecutor._get_tick_size(price)
        return int(math.floor(price / tick) * tick)

    def _determine_order_type(self, signal: Signal) -> tuple:
        """
        ?쒓렇??媛뺣룄???곕Ⅸ 二쇰Ц 援щ텇 寃곗젙

        skill:
            0.8 ?댁긽: ?쒖옣媛 (ord_dvsn="01", ord_unpr="0")
            洹??? 吏?뺢? (ord_dvsn="00", ord_unpr=?꾩옱媛)

        Returns:
            (ord_dvsn, ord_unpr)
        """
        if signal.is_strong():
            return ("01", "0")

        # 吏?뺢?
        if signal.target_price:
            adjusted = self._round_to_tick(int(signal.target_price))
            if adjusted != int(signal.target_price):
                logging.info(
                    f"[?멸??⑥쐞 議곗젙] {signal.target_price} ??{adjusted} "
                    f"(tick={self._get_tick_size(int(signal.target_price))})"
                )
            return ("00", str(adjusted))

        # ?꾩옱媛濡?吏?뺢?
        price_info = data_fetcher.get_current_price(signal.stock_code, self.env_dv)
        current_price = price_info.get("price", 0)

        if current_price <= 0:
            return ("01", "0")

        adjusted = self._round_to_tick(int(current_price))
        return ("00", str(adjusted))

    def _calculate_quantity(self, signal: Signal) -> int:
        """
        二쇰Ц ?섎웾 怨꾩궛

        Args:
            signal: ?ъ옄 ?쒓렇??

        Returns:
            二쇰Ц ?섎웾
        """
        # ?쒓렇?먯뿉 ?섎웾??吏?뺣맂 寃쎌슦
        if signal.quantity:
            return signal.quantity

        # 留ㅻ룄: ?꾨웾 留ㅻ룄
        if signal.action == Action.SELL:
            return self.position_manager.get_holding_quantity(signal.stock_code)

        # 留ㅼ닔: 湲곕낯 1二?(?ㅼ젣濡쒕뒗 ?ъ옄湲덉븸 湲곕컲 怨꾩궛 ?꾩슂)
        return 1

    def _execute_order(
        self,
        signal: Signal,
        ord_dvsn: str,
        ord_unpr: str,
        ord_qty: int
    ) -> pd.DataFrame:
        """
        ?ㅼ젣 二쇰Ц ?ㅽ뻾

        Args:
            signal: ?ъ옄 ?쒓렇??
            ord_dvsn: 二쇰Ц援щ텇
            ord_unpr: 二쇰Ц?④?
            ord_qty: 二쇰Ц?섎웾

        Returns:
            二쇰Ц 寃곌낵 DataFrame
        """
        try:
            trenv = ka.getTREnv()

            # TR_ID ?ㅼ젙
            if self.env_dv == "real":
                tr_id = "TTTC0802U" if signal.action == Action.BUY else "TTTC0801U"
            else:
                tr_id = "VTTC0802U" if signal.action == Action.BUY else "VTTC0801U"

            params = {
                "CANO": trenv.my_acct,
                "ACNT_PRDT_CD": trenv.my_prod,
                "PDNO": signal.stock_code,
                "ORD_DVSN": ord_dvsn,
                "ORD_QTY": str(ord_qty),
                "ORD_UNPR": ord_unpr,
            }

            ord_type_name = "?쒖옣媛" if ord_dvsn == "01" else "吏?뺢?"
            logging.info(
                f"二쇰Ц ?ㅽ뻾: {signal.stock_name} "
                f"{signal.action.value.upper()} "
                f"{ord_qty}二?@ {ord_unpr}??({ord_type_name}, ord_dvsn={ord_dvsn})"
            )
            logging.info(f"[DEBUG] tr_id={tr_id}, CANO={trenv.my_acct}, ACNT_PRDT_CD={trenv.my_prod}, PDNO={signal.stock_code}, env_dv={self.env_dv}")

            res = ka._url_fetch(
                "/uapi/domestic-stock/v1/trading/order-cash",
                tr_id, "", params, postFlag=True
            )

            if res.isOK():
                result = pd.DataFrame([res.getBody().output])
                logging.info(f"二쇰Ц ?깃났: {result.to_dict()}")

                # ?ъ???罹먯떆 媛깆떊
                self.position_manager.refresh()

                return result
            else:
                logging.error(f"二쇰Ц ?ㅽ뙣: {signal.stock_name}")
                res.printError("/uapi/domestic-stock/v1/trading/order-cash")
                return pd.DataFrame()

        except Exception as e:
            logging.error(f"二쇰Ц ?ㅽ뻾 ?먮윭: {e}")
            return pd.DataFrame()


