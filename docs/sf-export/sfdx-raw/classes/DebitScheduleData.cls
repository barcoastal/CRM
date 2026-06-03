public inherited sharing class DebitScheduleData {
    
    public static List<Debit_Schedule__c> queryDebitSchedules(Set<Id> programPlanIdSet) {
        return [
            SELECT Id, Deposit_Amount__c, Start_Date__c, Number_of_Payments__c, Program_Plan__c 
            FROM Debit_Schedule__c WHERE Program_Plan__c IN :programPlanIdSet
        ];
    }
}