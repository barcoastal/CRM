public inherited sharing class ProgramPlanUtil extends SObjectUtilHelper implements SObjectUtil {
    private static final Schema.DescribeSObjectResult PROGRAM_PLAN_DESCRIBE = Schema.SObjectType.Program_Plan__c;

    public static final String FREQUENCY_MONTHLY = 'Monthly';
    public static final String FREQUENCY_BI_MONTHLY = 'Bi-Monthly';
    public static final String FREQUENCY_WEEKLY = 'Weekly';
    public static final String FREQUENCY_DAILY = 'Daily';

    public String getSObjName() {
        return PROGRAM_PLAN_DESCRIBE.getName();
    }

    public String getSObjLabel() {
        return PROGRAM_PLAN_DESCRIBE.getLabel();
    }

    public List<FieldSetDetails> getFieldsetDetails(String fieldsetName) {
        return null;
    }

    public static Map<Id, Id> getActiveProgramPlanIdOfAccounts(Set<Id> accountIds) {
        Map<Id, Id> programPlanIdAccountIdMap = new Map<Id, Id>();
        for (Program_Plan__c prgmPlan : ProgramPlanData.queryActiveProgramPlans(accountIds)) {
            programPlanIdAccountIdMap.put(prgmPlan.Id, prgmPlan.Client__c);
        }
        return programPlanIdAccountIdMap;
    }
}