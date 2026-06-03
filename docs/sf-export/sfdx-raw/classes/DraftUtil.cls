public inherited sharing class DraftUtil {
    public static Set<String> unlockedStatuses = new Set<String> {'Pending', 'Scheduled'};
    public static Set<String> lockedStatuses = new Set<String> {'Processing', 'Completed', 'NSF','Cancelled','Skipped Payment'};
    public static Set<String> completedStatuses = new Set<String> {'Processing', 'Completed'};
    public static Set<String> CancledAndNsfStatus = new Set<String> {'NSF','Cancelled'};
    public static Set<String> firstDraftDateStatus = new Set<String>{'Pending','Scheduled','Processing','Completed','Processed','Rescheduled'};
    public static final String STATUS_CANCELLED = 'Cancelled';
    public static final String STATUS_COMPLETED = 'Completed';
    public static final String STATUS_SKIPPED = 'Skipped Payment';
    public static final String STATUS_NSF = 'NSF';
    public static final String STATUS_PENDING = 'Pending';
    public static final String SAS_API_CREATE_DEBIT_SCHEDULE = 'SetDebitSchedule';
    public static final String SAS_API_ADD_DEBIT_SCHEDULE = 'AddDebits';
    public static final String SAS_API_UPDATE_DEBIT_SCHEDULE = 'UpdateDebits';
    public static final String SAS_API_CANCEL_DEBIT_SCHEDULE = 'CancelDebits';
    public static final Set<String> DRAFT_STATUSES_COLLECTED = new Set<String> {'Completed'};
    public static final Set<String> DRAFT_STATUSES_IN_SCHEDULE = new Set<String> {'Pending', 'Scheduled', 'Processing'};
    private static final Schema.DescribeSObjectResult DRAFT_DESCRIBE = Schema.SObjectType.Draft__c;
    public static final String PROGRAM_FEE_FIELD = 'Program_Fee__c';
    public static final String SERVICE_FEE_FIELD = 'Service_Fee__c';
    public static final String SETUP_FEE_FIELD = 'Setup_Fee__c';
    public static final String RETAINER_FEE_FIELD = 'Retainer_Fee__c';
    public static final String CITADEL_FEE_FIELD = 'Citadel_Fee__c';
    
    public String getSObjName() {
        return DRAFT_DESCRIBE.getName();
    }
    
    public String getSObjLabel() {
        return DRAFT_DESCRIBE.getLabel();
    }
}