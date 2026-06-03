public inherited sharing class CaseUtil {
    private static final Schema.DescribeSObjectResult CASE_DESCRIBE = Schema.SObjectType.Case;
    public static final String CASE_CLOSED_STATUS = 'Closed';
    public static final String CASE_RESOLUTION = 'Client Cancelled/Graduated';
    public static final String RT_CUSTOMER_SERVICE = 'Customer_Support';
    
     public String getSObjName() {
        return CASE_DESCRIBE.getName();
    }

    public String getSObjLabel() {
        return CASE_DESCRIBE.getLabel();
    }
    
     //Retrieve the record type Id based on the record type developer name
    public static Id getRecordTypeId(String recordTypeName) {
        Id recordTypeId;
        Map<String, Schema.RecordTypeInfo> recordTypeMap = CASE_DESCRIBE.getRecordTypeInfosByDeveloperName();
        if (recordTypeMap.containsKey(recordTypeName)) {
            recordTypeId = recordTypeMap.get(recordTypeName).getRecordTypeId();
        }
        return recordTypeId;
    }
}