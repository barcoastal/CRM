/*----------------------------------------------------------------
    Author: Vinitha R
    Description: A helper class to perform the paymentSummary trigger actions.
    Test Class: 

    History
    <Date>          <Authors Name>          <Brief Description of Change>   
    Mar-23-2025     Vinitha                  Initial Development                
--------------------------------------------------------------------*/
public inherited sharing class PaymentSummaryTriggerHelper {
    
    Public static Set<String> paymentTypeSet = new Set<String>{'Retainer Fee', 'Program Fee'}; 

    private static Integer getThreshold() {
        return ProgramCompletionAlertConfigMDTData.getThreshold();
    }
    
    public static void checkPaymentFee() {
        
        Set<Id> accIds = new Set<Id>();
        for (Payment_Summary__c paymentSumRec: (List<Payment_Summary__c>)Trigger.new) {        
            
            Payment_Summary__c oldPaymentSummary = (Payment_Summary__c)Trigger.oldMap.get(paymentSumRec.Id);                        
            if(paymentTypeSet.contains(paymentSumRec.Payment_Type__c) && paymentSumRec.Client__c != null
                && (paymentSumRec.Total_Amount__c != oldPaymentSummary.Total_Amount__c || paymentSumRec.Amount_Collected__c != oldPaymentSummary.Amount_Collected__c)){
                accIds.add(paymentSumRec.Client__c);
            }        
        }
        
        if(!accIds.isEmpty()){
            updateAccountFeeStatus(accIds);
        }
    }

    public static void checkProgramCompletionStage() {
        try{
            List<Task> tasksToCreate = new List<Task>();
            Set<Id> acctIds = new Set<Id>();
            Integer threshCount = getThreshold();
            for (Payment_Summary__c ps : (List<Payment_Summary__c>)Trigger.new) {
                Payment_Summary__c oldPs = (Payment_Summary__c)Trigger.oldMap.get(ps.Id);
                if (ps.Payment_Type__c == PaymentSumaryUtil.PAYMENT_TYPE_DRAFT &&
                    ps.Client__c != null &&
                    ps.Remaining_Payments__c != null &&
                    oldPs != null &&
                    ps.Remaining_Payments__c != oldPs.Remaining_Payments__c) {

                    if (ps.Remaining_Payments__c <= threshCount) {
                        acctIds.add(ps.Client__c);
                    }
                }
            }

            if (acctIds.isEmpty()) {
                return;
            }
            Id taskRtId = ApexUtil.getRecordTypeIdbyDeveloperName('Task','System_Activity');
            List<Account> acctsToUpdate = new List<Account>();
            Map<Id, Account> acctMap = AccountData.getActiveAccounts(acctIds);
            for (Id accId : acctMap.keySet()) {
                Account acct = acctMap.get(accId);
                if (!acct.Program_Completion_Stage__c) {
                    String idLabel = acct.External_SAS_Id__c != null ? 'SAS Id: ' + acct.External_SAS_Id__c :
                                     acct.External_RAM_Id__c != null ? 'RAM Id: ' + acct.External_RAM_Id__c : '';
                    String subject = 'Program completion alert: ' + acct.Name +
                                     (String.isBlank(idLabel) ? '' : ' - ' + idLabel);

                    Task taskRecord = new Task(
                        WhatId = accId,
                        OwnerId = acct.OwnerId,
                        Subject = subject,
                        WhoId = acct.Primary_Contact__c,
                        recordTypeId = taskRtId,
                        Description = 'The client has reached the program completion stage.',
                        Status = 'Completed'
                    );
                    tasksToCreate.add(taskRecord);

                    Account acc = new Account();
                    acc.Id = accId;
                    acc.Program_Completion_Stage__c = true;
                    acctsToUpdate.add(acc);
                }
            }
            if (!tasksToCreate.isEmpty()) {
                insert tasksToCreate;
            }
            if (!acctsToUpdate.isEmpty()) {
                update acctsToUpdate;
            }
        } catch (Exception ex) {
             ApplicationLogger.logExceptionWithData(ex,Null, 'checkProgramCompletionStage On Payment Summary Trigger Failed ', ApplicationLogger.SEVERITY_HIGH);
        }
    }

    public static void updateAccountFeeStatus(Set<Id> accIds) {
            Map<Id, AggregateResult> paymentSummaryMap = PaymentSummaryData.queryPaymentSummariesFilterByAccount(accIds, new Set<String>{PaymentSumaryUtil.PAYMENT_TYPE_RETAINER_FEE, PaymentSumaryUtil.PAYMENT_TYPE_PROGRAM_FEE});            
            List<Account> updateAccList = new List<Account>();
            for(Account acct: AccountData.queryAccounts(accIds)){
                Account accInst = new Account();
            if((decimal)paymentSummaryMap.get(acct.Id).get('totalAmount') <= (decimal)paymentSummaryMap.get(acct.Id).get('amountCollected')) {
                accInst.Id = acct.Id;
                accInst.Fee_Paid_In_Full__c = TRUE;
                updateAccList.add(accInst); 
            } else if(((decimal)paymentSummaryMap.get(acct.Id).get('totalAmount') > (decimal)paymentSummaryMap.get(acct.Id).get('amountCollected')) && acct.Fee_Paid_In_Full__c) {
                    accInst.Id = acct.Id;
                    accInst.Fee_Paid_In_Full__c = FALSE;
                    updateAccList.add(accInst); 
                }          
            }
            
            if(!updateAccList.isEmpty()){
                Update updateAccList;
            }
        }

}