/**
 * @Description: Class to retrieve the Case records.
 */
public inherited sharing class CaseData {
    public static List<Case> getCasesForAccount(Set<Id> accountIds) {
        List<Case> cases = [SELECT Id, Status, AccountId,recordTypeId FROM Case WHERE AccountId IN :accountIds AND Status !=: CaseUtil.CASE_CLOSED_STATUS];
        return cases;
    }
    
}