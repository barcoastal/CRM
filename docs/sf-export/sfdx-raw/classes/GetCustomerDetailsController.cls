public with sharing class GetCustomerDetailsController {
    
     @AuraEnabled
    public static ApexActionResult getAccountDetails(Id recordId) {
        final String SCOPE = 'GetCustomerDetailsController.getAccountDetails';
        ApexActionResult result = new ApexActionResult(SCOPE);
        RecordDetails recordDetailWrap = new RecordDetails();
        try {
            ApexUtil.requireValue('Record Id', recordId);
            Account acct = AccountData.queryAccountWithUnSyncedStatus(recordId)[0];
            recordDetailWrap.escrowBalance = acct.Escrow_Balance__c != null ? String.valueOf(acct.Escrow_Balance__c) : '';
            recordDetailWrap.pulledDateTime = acct.Escrow_Balance_Pulled_Date_Time__c != null ? formatDateTime(acct.Escrow_Balance_Pulled_Date_Time__c) : '';
            recordDetailWrap.externalSASId = acct.External_SAS_Id__c != null ? acct.External_SAS_Id__c : null;
            recordDetailWrap.externalRAMId = acct.External_RAM_Id__c != null ? acct.External_RAM_Id__c : null;
            recordDetailWrap.feePaidInFull = acct.Fee_Paid_In_Full__c;
            result.data = JSON.serialize(recordDetailWrap);
        }catch (Exception ex) {
            result.message = ex.getMessage();
            result.thrown(ex);
        }
        return result;
    }
    
    @AuraEnabled
    public static ApexActionResult refreshCustomerDetails(Id recordId, String externalSASId, String externalRAMId) {
        final String SCOPE = 'GetCustomerDetailsController.refreshCustomerDetails';
        ApexActionResult result = new ApexActionResult(SCOPE);
        RecordDetails recordDetailWrap = new RecordDetails();
        try {
            ApexUtil.requireValue('Record Id', recordId);
            if(externalSASId != null){
                ProcessorWrapper.API_Response customerResponse = SASApi.getCustomerDetails(recordId);
                if(customerResponse.isSuccess == true && customerResponse.ProcessData != null){
                    List<SASWrapper.ProcessDataDetails> processDataList = (List<SASWrapper.ProcessDataDetails>)JSON.deserialize(customerResponse.ProcessData, List<SASWrapper.ProcessDataDetails>.class); 
                    Account acct = new Account (Id = recordId, Escrow_Balance__c = processDataList[0].balance, Escrow_Balance_Pulled_Date_Time__c = System.now());            
                    UPDATE acct;   
                    result = getAccountDetails(recordId);   
                }else{
                    result.message = 'Failed to get customer details';
                }  
            }else if(externalRAMId != null){
                ProcessorWrapper.API_Response customerResponse = RAMApi.getCustomerDetails(externalRAMId);
                if(customerResponse.isSuccess == true && customerResponse.balance != null){
                    Account acct = new Account (Id = recordId, Escrow_Balance__c = customerResponse.balance, Escrow_Balance_Pulled_Date_Time__c = System.now());            
                    UPDATE acct;   
                    result = getAccountDetails(recordId);   
                }else{
                    result.message = 'Failed to get customer details';
                }     
            }              
        }catch (Exception ex) {
            result.message = ex.getMessage();
            result.thrown(ex);
        }
        return result;
    }
    
    public static String formatDateTime(DateTime pulledDateTime){
        String estTimeZone = 'America/New_York';
        String formatted = pulledDateTime.format('MM/dd/yyyy h:mm a',estTimeZone );
        formatted +=' EST';    
        return formatted;
    }
    
    public class RecordDetails {
        public String pulledDateTime;
        public String escrowBalance;
        public String externalSASId;
        public String externalRAMId;        
        public Boolean feePaidInFull;        
    }
}