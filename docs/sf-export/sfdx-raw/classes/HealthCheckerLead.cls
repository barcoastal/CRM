/**
 * HealthCheckerLead class is responsible for performing various health checks on Lead records.
 */
public with sharing class HealthCheckerLead implements HealthCheckerLeadI {
    
    private Lead leadRecord;  
    // All of our results will be added here
    private List<HealthCheckerResult> listHealthCheckerResults = new List<HealthCheckerResult>();
    
    /**
     * Checks various aspects of a Lead record to ensure its health.
     * @param id The Id of the Lead record to be checked.
     * @return A list of HealthCheckerResult instances representing the outcome of each check.
     */
    public List<HealthCheckerResult> check(Id id){
        
        leadRecord = LeadDAO.getLeadById(id);
        if(leadRecord.Status == 'New' || leadRecord.Status == 'Working Lead'){
            checkCompanyPopulated(); 
            checkFirstAndLastNamePopulated();
            checkCallDispositionPopulated();
            checkCreditorInformationPopulated();
            checkTotalDebtAmountPopulated();
            checkIndustryPopulated();
            paymentAmountPopulated();
            checkLastNameNotNewInbound();
            checkLeadSourcePopulated();
        }
        
        return listHealthCheckerResults;
    }

    private void paymentAmountPopulated(){
        
      if (leadRecord.Is_Payment_Amount_Populated__c == true) {
            listHealthCheckerResults.add(HealthCheckerResult.createSuccessfulResult('Payment Amount Populated'));
            
        }else {
            listHealthCheckerResults.add(HealthCheckerResult.createErrorResult('Payment Amount is Not Populated'));
            
        }
    }

    private void checkLastNameNotNewInbound() {
        if (leadRecord.LastName != null && leadRecord.LastName == 'New Inbound') {
            listHealthCheckerResults.add(
                HealthCheckerResult.createErrorResult('Last Name should not be  New Inbound')
            );
        } else {
            listHealthCheckerResults.add(
                HealthCheckerResult.createSuccessfulResult('Last Name should not be  New Inbound')
            );
        }
    }

    private void checkLeadSourcePopulated() {
        if (String.isBlank(leadRecord.LeadSource)) {
            listHealthCheckerResults.add(
                HealthCheckerResult.createErrorResult('Lead Source should be populated.')
            );
        } else {
            listHealthCheckerResults.add(
                HealthCheckerResult.createSuccessfulResult('Lead Source is populated.')
            );
        }
    }

    
    /**
     * Checks if the Company Name is populated.
     */
    private void checkCompanyPopulated(){
        
        if (!String.isEmpty(leadRecord.Company)) {
            listHealthCheckerResults.add(HealthCheckerResult.createSuccessfulResult('Company Name is populated'));
            
        }else {
            listHealthCheckerResults.add(HealthCheckerResult.createErrorResult('Company Name is Not Populated'));
            
        }  
    }
    
    /**
     * Checks if the First Name Or Last Name is populated.
     */
    private void checkFirstAndLastNamePopulated(){
        
        if ((!String.isEmpty(leadRecord.FirstName)) && (!String.isEmpty(leadRecord.LastName))) {
            listHealthCheckerResults.add(HealthCheckerResult.createSuccessfulResult('First Name Or Last Name is Populated'));
            
        }else {
            listHealthCheckerResults.add(HealthCheckerResult.createErrorResult('First Name Or Last Name is Not Populated'));
            
        }
    }

    /**
     * Checks if the Call Disposition is populated.
     */
    private void checkCallDispositionPopulated(){
        
        if ((!String.isEmpty(leadRecord.CloserLookup__c)) && (!String.isEmpty(leadRecord.Call_Transfer_Status__c))&&(!String.isEmpty(leadRecord.Call_Received_By_Lookup__c))&&(leadRecord.Call_Received_Date__c != null)) {
            listHealthCheckerResults.add(HealthCheckerResult.createSuccessfulResult('Call Disposition is Populated'));
    
        }else {
            listHealthCheckerResults.add(HealthCheckerResult.createErrorResult('Call Diposition is Not Populated'));
    
        }
        
    }

    /**
     * Checks if the Creditor Information is populated.
     */
    private void checkCreditorInformationPopulated(){
        
        if (leadRecord.Creditor_1_Total_Debt__c > 0) {
            listHealthCheckerResults.add(HealthCheckerResult.createSuccessfulResult('Debt Details are Populated'));
            
        }else {
            listHealthCheckerResults.add(HealthCheckerResult.createErrorResult('Debt Details are Not Populated'));
            
        }
    }

    /**
     * Checks if the Total Debt Amount meets the minimum requirement.
     */
    private void checkTotalDebtAmountPopulated(){
        //custom setting
        Lead_Health_Checker_Settings__c leadHealthChecker = Lead_Health_Checker_Settings__c.getInstance('Business Lead');
            
        if (leadRecord.Current_Total_Debt_Amount__c >= 30000) {
            listHealthCheckerResults.add(HealthCheckerResult.createSuccessfulResult('Minimum Total Debt requirement is met'));
            
        }else {
            listHealthCheckerResults.add(HealthCheckerResult.createErrorResult('Minimum Total Debt requirement is Not met'));
            
        }
    }

    /**
     * Checks if the Industry field is populated.
     */
    private void checkIndustryPopulated(){
        
        if ((!String.isEmpty(leadRecord.Industry))) {
            listHealthCheckerResults.add(HealthCheckerResult.createSuccessfulResult('Industry is populated'));
            
        }else {
            listHealthCheckerResults.add(HealthCheckerResult.createErrorResult('Industry is not populated'));
            
        }
    }

}