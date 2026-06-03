public inherited sharing class OpportunityUtil {
    private static final Schema.DescribeSObjectResult OPP_DESCRIBE = Schema.SObjectType.Opportunity;
    public static final String FIELD_DISPOSITION = 'StageName';
    public static final String FIELD_SUB_DISPOSITION = 'Sub_Disposition__c';
    public static final String FIELD_CALL_TRANSFER_STATUS = 'Call_Transfer_Status__c';
    public static final String FIELD_VERSION_STATUS = 'Version_Status__c';
    //CD-535: Removed the 'Closed Won First Payment Pending' from closed stages to calculate debit schedules.
    public static final Set<String> CLOSED_STAGES = new Set<String> {'Closed Won - First Payment Completed', 'Closed Lost'};
    
    public static final String STAGE_WORKING_OPPORTUNITY = 'Working Opportunity';
    public static final String STAGE_CLOSED_WON_PENDING = 'Closed Won First Payment Pending'; 
    public static final String STAGE_CLOSED_WON_COMPLETED = 'Closed Won - First Payment Completed'; 
    public static final String STAGE_CLOSED_LOST = 'Closed Lost';
    public static final String STAGE_AGREEMENTS_RECEIVED = 'Agreements Received';
    public static final String STAGE_ARCHIVED = 'Archived'; 
    public static final String STAGE_CONTRACT_SINGED = 'Contract Signed';
    public static final String DEBT_SETTLEMENT_RECORDTYPE = 'Debt_Settlement';  
    public static final String STAGE_ARCHIVED_FINALIZED = 'Archived - Finalized';
    public static final String SUB_DISPOSITION_DUPLICATE = 'Duplicate';
    
    //Added public static variable for contract sent
    public static final String STAGE_CONTRACT_SENT = 'Contract Sent';

    public static final String SUB_DISPO_STAGE_CHANGE = 'Stage Change';

    public static final String SUB_DISPO_OPP_AMENDED = 'Opportunity Amended';

    public static final String RECORD_TYPE_BUYOUT = 'Buyout';

    public static final String SAS_PROCESSOR_TYPE = 'SAS';
    
    public static final String RAM_PROCESSOR_TYPE = 'RAM';

    public static final Set<String> ACTIVE_VERSION_STATUS = new Set<String> {'Draft','Pending Client Approval', 'Active'};
    
    public static final Set<String> NOT_ACTIVE_STAGES = new Set<String> {
        'Closed Lost', 'Archived', 'Closed Won & Completed'
    };
    
    public static final Set<String> NOTACTIVE_STAGES = new Set<String> {
        'Closed Lost', 'Archived', 'Closed Won & Completed'
    };
 

    public static final Set<String> IN_PROGRESS_STAGES = new Set<String> {
        'Working Opportunity', 'Waiting for Agreements', 'Agreements Received', 'Ready To Close'
    };
    public static final Set<String> ACTIVE_STAGES = new Set<String> {
        'Closed Won First Payment Pending', 'Closed Won - First Payment Completed'
    };

    public static final Set<String> INACTIVE_STAGES = new Set<String> {
        'Archived', 'Closed Lost'
    };
        
    public static final Set<String> WORKING_STAGES = new Set<String> {
        'Working Opportunity', 'Waiting for Agreements' , 'Agreements Received' , 'Ready To Close'
    };

    public static final Set<String> OPP_ACTIVE_STAGES = new Set<String> {
        'Working Opportunity', 'Waiting for Agreements', 'Agreements Received', 'Ready To Close', 'Contract Sent', 'Contract Signed',
        'Closed Won First Payment Pending', 'Closed Won - First Payment Completed'
    };
        
     // Stages that are considered active for reshuffled opportunities
    public static final Set<String> RESHUFFLED_ACTIVE_STAGES = new Set<String> {
         'Waiting for Agreements', 'Agreements Received', 'Ready To Close','Contract Sent', 'Contract Signed', 'Closed Won First Payment Pending', 'Closed Won - First Payment Completed'
    };
        
    public String getSObjName() {
        return OPP_DESCRIBE.getName();
    }

    public String getSObjLabel() {
        return OPP_DESCRIBE.getLabel();
    }

    public String getFieldsetDetails() {
        return null;
    }

    public static String getSObjectName() {
        return OPP_DESCRIBE.getName();
    }

    public static Boolean isOppId(Id sObjectId) {
        return ApexUtil.getSObjectName(sObjectId) == OPP_DESCRIBE.getName();
    }

    public static Map<Id, Id> getActiveOpportunityIdOfAccounts(Set<Id> accountIds) {
        Map<Id, Id> opportunityIdAccountIdMap = new Map<Id, Id>();
        for (Opportunity opp : OpportunityData.queryActiveOpportunities(accountIds)) {
            opportunityIdAccountIdMap.put(opp.Id, opp.AccountId);
        }
        return opportunityIdAccountIdMap;
    }
}