@isTest
public class SettlementUtilTest {
  
    @isTest
    public static void settlementTest(){
       Set<String> CompletedSettlements =  SettlementUtil.SETTLEMENT_STATUSES_COLLECTED;
        Set<String> scheduleSettlements =    SettlementUtil.SETTLEMENT_STATUSES_IN_SCHEDULE;
        String settlementRecordType =    SettlementUtil.RT_SETTLEMENTS;
         String offeredSettlementRecordType =    SettlementUtil.RT_OFFERED_SETTLEMENTS;
       Id RecId =  SettlementUtil.getRecordTypeId(settlementRecordType);
    }
}