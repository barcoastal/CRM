public inherited sharing class FeeUtil {
    public static final String RT_RETAINER_FEE = 'Retainer_Fee';
    public static final String RT_SETUP_FEE = 'Setup_Fee';
    public static final String RT_PROCESSOR_FEE = 'Processor_Fee';
    public static final String RT_SERVICE_FEE = 'Service_Fee';
    public static final String RT_PROGRAM_FEE = 'Program_Fee';
    public static final String RT_PROGRAM_FEE_SETTLEMENTS = 'Program_Fee_Settlements';
    public static final String RT_OFFERED_PROGRAM_FEE_SETTLEMENTS = 'Offered_Program_Fee_Settlements';
    public static final String RT_CITADEL_FEE = 'Citadel_Fee';
    public static final String PRODUCT_CITADEL_FEE = 'CitadelFee';
    public static final String PRODUCT_VICTORY_FEE = 'VictoryFee';

    public static final Set<String> FEE_TYPES = new Set<String> {
        RT_RETAINER_FEE, RT_SETUP_FEE, RT_PROCESSOR_FEE, RT_SERVICE_FEE, RT_PROGRAM_FEE, RT_CITADEL_FEE
    };
    public static Map<String, Id> FEE_TYPE_RT_ID_MAP = new Map<String, Id>();
    public static Map<Id, String> RT_ID_FEE_TYPE_MAP = new Map<Id, String>();
    public static final String FIELD_RETAINER_FEE = 'Retainer_Fee__c';
    public static final String FIELD_SETUP_FEE = 'Setup_Fee__c';
    public static final String FIELD_PROCESSOR_FEE = 'Processor_Fee__c';
    public static final String FIELD_SERVICE_FEE = 'Service_Fee__c';
    public static final String FIELD_PROGRAM_FEE = 'Program_Fee__c';
    public static final String FIELD_CITADEL_FEE = 'Citadel_Fee__c';

    public static final Set<String> FEE_STATUSES_COLLECTED = new Set<String> {'Completed'};
    public static final Set<String> FEE_STATUSES_IN_SCHEDULE = new Set<String> {'Pending', 'Scheduled', 'Processing', null};
    public static final Set<String> FEE_ALL_STATUSES = new Set<String> {'Pending', 'Scheduled', 'Processing', 'Completed',  null};

    
    public static final Set<String> FEES_INTEGRATION_SUPPORTED = new Set<String> {
        RT_RETAINER_FEE, RT_SETUP_FEE, RT_SERVICE_FEE, RT_PROCESSOR_FEE, RT_PROGRAM_FEE, RT_CITADEL_FEE
    };
    public static final Set<String> FEES_INTEGRATION_SUPPORTED_SAS = new Set<String> {
        RT_RETAINER_FEE, RT_SETUP_FEE, RT_SERVICE_FEE, RT_PROGRAM_FEE, RT_CITADEL_FEE
    };

    private static final Schema.DescribeSObjectResult Fee_DESCRIBE = Schema.SObjectType.Fee__c;

    public String getSObjName() {
        return Fee_DESCRIBE.getName();
    }

    public String getSObjLabel() {
        return Fee_DESCRIBE.getLabel();
    }

    public static Id getRecordTypeId(String recordTypeName) {
        Id recordTypeId;
        Map<String, Schema.RecordTypeInfo> recordTypeMap = Fee_DESCRIBE.getRecordTypeInfosByDeveloperName();
        if (recordTypeMap.containsKey(recordTypeName)) {
            recordTypeId = recordTypeMap.get(recordTypeName).getRecordTypeId();
        }
        return recordTypeId;
    }

    public static String getFeeFieldNameInDraft(String feeType) {
        String fieldName;
        if (feeType == RT_RETAINER_FEE) {
            fieldName = FIELD_RETAINER_FEE;
        } else if (feeType == RT_SETUP_FEE) {
            fieldName = FIELD_SETUP_FEE;
        } else if (feeType == RT_PROCESSOR_FEE) {
            fieldName = FIELD_PROCESSOR_FEE;
        } else if (feeType == RT_SERVICE_FEE) {
            fieldName = FIELD_SERVICE_FEE;
        } else if (feeType == RT_PROGRAM_FEE) {
            fieldName = FIELD_PROGRAM_FEE;
        } else if (feeType == RT_CITADEL_FEE) {
            fieldName = FIELD_CITADEL_FEE;
        } 
        return fieldName;
    }

    public static void fetchFeesRecordTypeIds() {
        for (String feeTypeName : FeeUtil.FEE_TYPES) {
            Id recordTypeId = FeeUtil.getRecordTypeId(feeTypeName);
            FEE_TYPE_RT_ID_MAP.put(feeTypeName, recordTypeId);
        }
    }

    public static void fetchRecordTypeDevNamesByIds() {
        for (String feeTypeName : FeeUtil.FEE_TYPES) {
            Id recordTypeId = FeeUtil.getRecordTypeId(feeTypeName);
            RT_ID_FEE_TYPE_MAP.put(recordTypeId, feeTypeName);
        }
    }
}