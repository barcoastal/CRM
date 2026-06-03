public inherited sharing class ProgramPlanData {
            
    /**
     * Retrieves a list of Program_Plan__c records based on the provided set of IDs.
     * @param programPlanIds Set of Program_Plan__c IDs to query.
     * @return List of Program_Plan__c records.
     **/
    public static List<Program_Plan__c> getProgramPlans(Set<Id> programPlanIds) {
        return [SELECT Id, Client__c, Payment_Processor__c, Program_Fee_Percentage__c, 
                Retainer_Percentage__c, Opportunity__r.Legal_Plan_Required__c, Opportunity__r.Legal_Network__c,
                Payment_Processor__r.Monthly_Bank_Fee__c, Payment_Processor__r.Bank_Setup_Fee__c,
                Payment_Term__c, Payment_Frequency__c, Total_Debt__c, Settlement_Percentage__c,
                Settlement_Program_Fee__c, Processor_Manually_Overridden__c
                FROM Program_Plan__c
                WHERE Id IN :programPlanIds];
    }

    public static List<Program_Plan__c> getActiveProgramPlan(Id acctId) {
        return [SELECT Id, Completed_Drafts_Count__c, Payment_Processor__c, Payment_Processor__r.Processor_Type__c,
            Completed_Drafts_Amount__c, Next_Draft_Date__c, Debit_Schedule_Id__c,Opportunity__c,
            Last_Completed_Draft_Date__c, Last_Rescheduled_By__c, Last_Rescheduled_Date_Time__c, Client__c,
            Opportunity__r.External_Debit_Schedule_Id__c
            FROM Program_Plan__c 
            WHERE Client__c = :acctId AND Opportunity__r.Active_Opportunity__c = true ORDER BY CreatedDate DESC];
    }

    public static List<Program_Plan__c> getActiveProgramPlan(Id acctId, Id opptId) {
        return [SELECT Id, Completed_Drafts_Count__c, Payment_Processor__c, Payment_Processor__r.Processor_Type__c,
            Completed_Drafts_Amount__c, Next_Draft_Date__c, Debit_Schedule_Id__c,Opportunity__c,
            Last_Completed_Draft_Date__c, Last_Rescheduled_By__c, Last_Rescheduled_Date_Time__c, Client__c
            FROM Program_Plan__c 
            WHERE Client__c = :acctId AND Opportunity__c =:opptId AND Opportunity__r.Active_Opportunity__c = true ORDER BY CreatedDate DESC];
    }

    public static List<Program_Plan__c> queryProgramPlanDetails(Id oppId, List<String> prgmPlanFields) {
        String query = 'SELECT ' + String.join(prgmPlanFields, ',') + ' FROM Program_Plan__c WHERE Opportunity__c = :oppId ORDER BY CreatedDate DESC LIMIT 1';
        return Database.query(query);
    }

    public static Map<Id, Program_Plan__c> getProgramPlanDetailsMap(Id oppId) {
        return new Map<Id, Program_Plan__c>([SELECT Id,First_Payment_Date__c FROM Program_Plan__c WHERE Opportunity__c = :oppId]);
    }

    /**
     * @description: To query the active program plans of the account Ids.
    **/
    public static Map<Id, Program_Plan__c> getActiveProgramPlanOfAccounts(Set<Id> accountIds) {
        Map<Id, Program_Plan__c> accountIdPrgmPlanIdMap = new Map<Id, Program_Plan__c>();
        for (Program_Plan__c prgmPlanRecord : [SELECT Id, Client__c, Payment_Processor__c FROM Program_Plan__c 
            WHERE Client__c IN :accountIds AND Opportunity__r.StageName IN :OpportunityUtil.IN_PROGRESS_STAGES ORDER BY CreatedDate DESC]
        ) { 
            accountIdPrgmPlanIdMap.put(prgmPlanRecord.Client__c, prgmPlanRecord);
        }   
        return accountIdPrgmPlanIdMap;
    }

    //Method to query and get the Map of account Id with Program Plan Id based on the opportunities
    public static Map<Id, Id> getAccountsWithProgramPlans(List<Opportunity> oppList) {
        Map<Id, Id> accountIdPrgmPlanIdMap = new Map<Id, Id>();
        for (Program_Plan__c prgmPlan : [SELECT Id, Client__c FROM Program_Plan__c WHERE Opportunity__c IN :oppList]) { 
            accountIdPrgmPlanIdMap.put(prgmPlan.Client__c, prgmPlan.Id);
        }
        return accountIdPrgmPlanIdMap;
    }
    
    public static Map<Id, Id> getActiveProgramPlanIdOfAccounts(Set<Id> accountIds) {
        Map<Id, Id> accountIdPrgmPlanIdMap = new Map<Id, Id>();
        for (Program_Plan__c prgmPlanRecord : [SELECT Id, Client__c FROM Program_Plan__c 
            WHERE Client__c IN :accountIds AND Opportunity__r.StageName IN :OpportunityUtil.IN_PROGRESS_STAGES ORDER BY CreatedDate DESC]
        ) { 
            accountIdPrgmPlanIdMap.put(prgmPlanRecord.Client__c, prgmPlanRecord.Id);
        }   
        return accountIdPrgmPlanIdMap;
    }

    //Used for filtering the program plan which is active and synced with SAS the processor
    public static List<Program_Plan__c> getActiveProgramPlansOfOpportunties(Set<Id> opportunityIds) {
        return [SELECT Id, Client__c, Payment_Processor__c, Opportunity__c, Payment_Processor__r.Processor_Type__c FROM Program_Plan__c 
            WHERE Opportunity__c IN :opportunityIds AND (Opportunity__r.Account.External_SAS_Id__c != null OR Opportunity__r.Account.External_RAM_Id__c != null) 
            AND Opportunity__r.StageName NOT IN :OpportunityUtil.INACTIVE_STAGES 
            ORDER BY CreatedDate DESC
        ];
    }
    
    public static Map<Id, Program_Plan__c> getProrgamPlanOfOpportunties(Set<Id> programPlanIds){
        return new Map<Id,Program_Plan__c>([SELECT Id, Opportunity__c, Opportunity__r.First_Payment_Completed__c , Opportunity__r.AccountId FROM Program_Plan__c WHERE Id IN :programPlanIds]);  
    }

    public static List<Program_Plan__c> queryActiveProgramPlans(Set<Id> accountIds) {
        return [SELECT Id, Client__c, Opportunity__c, Settlement_Program_Fee__c, Payment_Processor__r.Monthly_Bank_Fee__c, Payment_Processor__r.Bank_Setup_Fee__c FROM Program_Plan__c WHERE Client__c = :accountIds];
    }

    public static Map<Id, Program_Plan__c> getProgramPlanOfAccounts(Set<Id> accountIds) {
        Map<Id, Program_Plan__c> accountIdPrgmPlanIdMap = new Map<Id, Program_Plan__c>();
        for (Program_Plan__c prgmPlanRecord : [SELECT Id, Client__c, Payment_Processor__c, Program_Fee_Percentage__c, 
            Retainer_Percentage__c, Opportunity__r.Legal_Plan_Required__c, Opportunity__r.Legal_Network__c,
            Payment_Processor__r.Monthly_Bank_Fee__c,
            Payment_Processor__r.Bank_Setup_Fee__c, Payment_Term__c, Payment_Frequency__c, Total_Debt__c, Settlement_Percentage__c,
            Settlement_Program_Fee__c, Opportunity__r.Lock_Opportunity__c
            FROM Program_Plan__c 
            WHERE Client__c IN :accountIds 
            AND (Opportunity__r.StageName = :OpportunityUtil.STAGE_CLOSED_LOST
                OR (Opportunity__r.StageName = :OpportunityUtil.STAGE_ARCHIVED AND Opportunity__r.Sub_Disposition__c != 'Opportunity Amended')
                OR (Opportunity__r.Opportunity__c != null AND Opportunity__r.StageName IN :OpportunityUtil.ACTIVE_STAGES)
                OR (Opportunity__r.Opportunity__c = null AND Opportunity__r.StageName IN :OpportunityUtil.OPP_ACTIVE_STAGES)
            )
            ORDER BY CreatedDate DESC]
        ) { 
            if (!accountIdPrgmPlanIdMap.containsKey(prgmPlanRecord.Client__c)) {
                accountIdPrgmPlanIdMap.put(prgmPlanRecord.Client__c, prgmPlanRecord);
            }
        }   
        return accountIdPrgmPlanIdMap;
    }

    public static Program_Plan__c getProgramPlanOfAccount(Id recordId) {
        return [SELECT Id, Total_Debt__c, Weekly_Draft_Amount__c, Payment_Frequency__c FROM Program_Plan__c WHERE Client__c = :recordId];
    }

    public static List<Program_Plan__c> getProgramPlanById(Id programPlanId) {
        return [
            SELECT Id, Client__c, Opportunity__c
            FROM Program_Plan__c
            WHERE Id = :programPlanId
        ];
    }
    public static List<Program_Plan__c> getProgramPlansByOpportunityId(Id opportunityId) {
        return [
            SELECT Id, Completed_Amount_During_Reschedule__c
            FROM Program_Plan__c
            WHERE Opportunity__c = :opportunityId
        ];
    }

    public static  Map<Id, Program_Plan__c> getActiveProgramPlanOfAccount(Set<Id> accountIds){
        Map<Id, Program_Plan__c> accountIdPrgmPlanIdMap = new Map<Id, Program_Plan__c>();
        for (Program_Plan__c prgmPlanRecord : [SELECT Id, Client__c, Payment_Processor__c,Setup_fee__c FROM Program_Plan__c 
            WHERE Client__c IN :accountIds ORDER BY CreatedDate DESC]
        ) { 
            accountIdPrgmPlanIdMap.put(prgmPlanRecord.Client__c, prgmPlanRecord);
        }   
        return accountIdPrgmPlanIdMap;
    }
}