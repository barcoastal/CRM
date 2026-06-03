public inherited sharing class SetupFeeMappingData {

    public static Decimal getSetupFee(String legalNetworkType, Boolean legalPlanRequired) {
        String networkType = String.isBlank(legalNetworkType) ? FileUtil.CITADEL_LEGAL_PLAN : legalNetworkType;
        List<SetupFee__mdt> records = [
            SELECT Fee__c FROM SetupFee__mdt
            WHERE Type__c = :networkType AND Legal_Plan_Required__c = :legalPlanRequired
            LIMIT 1
        ];
        return records.isEmpty() ? 0 : records[0].Fee__c;
    }
}