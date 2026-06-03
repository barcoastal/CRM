public inherited sharing class SettlementUtil {
    public static final Set<String> SETTLEMENT_STATUSES_COLLECTED = new Set<String> {'Completed'};
    public static final Set<String> SETTLEMENT_STATUSES_IN_SCHEDULE = new Set<String> {'Pending', 'Scheduled', 'Processing', null};
    public static final String RT_SETTLEMENTS = 'Settlements';
    public static final String RT_OFFERED_SETTLEMENTS = 'Offered_Settlements';
    public static final String SAS_API_CREATE_SETTLEMENT_SCHEDULE = 'SetSettlementSchedule';
    public static final String SAS_API_UPDATE_PAYOUTS = 'UpdatePayouts';
    public static final String SAS_API_CANCEL_PAYOUTS = 'CancelPayouts';
    public static final String STATUS_CANCELLED = 'Cancelled';

    private static final Schema.DescribeSObjectResult SETTLEMENT_DESCRIBE = Schema.SObjectType.Settlement__c;

    //Retrieve the record type Id based on the record type developer name
    public static Id getRecordTypeId(String recordTypeName) {
        Id recordTypeId;
        Map<String, Schema.RecordTypeInfo> recordTypeMap = SETTLEMENT_DESCRIBE.getRecordTypeInfosByDeveloperName();
        if (recordTypeMap.containsKey(recordTypeName)) {
            recordTypeId = recordTypeMap.get(recordTypeName).getRecordTypeId();
        }
        return recordTypeId;
    }
}