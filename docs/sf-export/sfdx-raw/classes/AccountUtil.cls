/** Test Class: AccountUtilTest */
public inherited sharing class AccountUtil {
    private static final Schema.DescribeSObjectResult ACCOUNT_DESCRIBE = Schema.SObjectType.Account;
    public static final String FIELD_DISPOSITION = 'Client_Status__c';
    public static final String FIELD_SUB_DISPOSITION = 'Sub_Disposition__c';
    public static final String RT_CREDITOR = 'Creditor';
    public static final String RT_CLIENT = 'Client';
    public static final String RT_BUSINESS_ACCOUNT = 'Business_Account';
    public static final String CLIENT_STATUS_WAITING_FIRST_PAYMENT = 'First Payment pending';
    public static final String CLIENT_STATUS_CANCELLED = 'Cancelled';
    public static final String CLIENT_STATUS_GRADUATED= 'Graduated';
    public static final String CLIENT_STATUS_ACTIVE = 'Active';
    public static final String LEGAL_NETWORK_CITADEL = 'Citadel';
    public static final String LEGAL_NETWORK_VLP = 'Victory Legal Plan';
    public static final String PROCESSOR_STATUS_FEE_PAID_IN_FULL = 'Fee Paid in Full';
    public static List<AccountTeamMember> accountTeamMembersToRestoreList = new List<AccountTeamMember>();   

    public String getSObjName() {
        return ACCOUNT_DESCRIBE.getName();
    }

    public String getSObjLabel() {
        return ACCOUNT_DESCRIBE.getLabel();
    }

    public static Boolean isAccountId(Id sObjectId) {
        return ApexUtil.getSObjectName(sObjectId) == ACCOUNT_DESCRIBE.getName();
    }

    public static String getSObjectName() {
        return ACCOUNT_DESCRIBE.getName();
    }

    //Retrieve the record type Id based on the record type developer name
    public static Id getRecordTypeId(String recordTypeName) {
        Id recordTypeId;
        Map<String, Schema.RecordTypeInfo> recordTypeMap = ACCOUNT_DESCRIBE.getRecordTypeInfosByDeveloperName();
        if (recordTypeMap.containsKey(recordTypeName)) {
            recordTypeId = recordTypeMap.get(recordTypeName).getRecordTypeId();
        }
        return recordTypeId;
    }
}