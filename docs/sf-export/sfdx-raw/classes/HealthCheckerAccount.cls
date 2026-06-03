public with sharing class HealthCheckerAccount implements HealthCheckerAccountI{

    private Account accountRecord;  
    // All of our results will be added here
    private List<HealthCheckerResult> listHealthCheckerResults = new List<HealthCheckerResult>();
    
    /**
     * Checks various aspects of a Account record to ensure its health.
     * @param id The Id of the Account record to be checked.
     * @return A list of HealthCheckerResult instances representing the outcome of each check.
     */
    public List<HealthCheckerResult> check(Id id){
        
        ApexUtil.requireValue('Account Id', id);
            accountRecord = AccountData.queryAccount(id)[0];
            checkWelcomeCallCompleted();
            checkFirstPaymentCompleted();
        return listHealthCheckerResults;
    }
    
    private void checkFirstPaymentCompleted(){
        
        if (accountRecord.First_Payment_Completed_Date__c != null) {
            listHealthCheckerResults.add(HealthCheckerResult.createSuccessfulResult('First Payment Received'));
            
        }else {
            listHealthCheckerResults.add(HealthCheckerResult.createErrorResult('First Payment Not Received'));
            
        }
    }

    private void checkWelcomeCallCompleted(){
        
        List<Task> taskList = TaskData.queryWelcomeCallCompletedTasks(accountRecord.Id);
        if (taskList.size() > 0) {
            listHealthCheckerResults.add(HealthCheckerResult.createSuccessfulResult('Welcome Call completed'));
            
        }else {
            listHealthCheckerResults.add(HealthCheckerResult.createErrorResult('Welcome Call Not completed'));
            
        }
    }
}