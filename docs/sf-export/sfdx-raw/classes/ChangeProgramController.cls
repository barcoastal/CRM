public with sharing class ChangeProgramController {
    
    @AuraEnabled
    public static ApexActionResult getOpportunityRelatedData(Id recordId) {
        final String SCOPE = 'ChangeProgramController.getOpportunityRelatedData';
        ApexActionResult result = new ApexActionResult(SCOPE);
        ChangeProgramWrapper changeProgWrap = new ChangeProgramWrapper();
        try {
            ApexUtil.requireValue('Record Id', recordId);
            Opportunity opp = OpportunityData.queryOpportunity(recordId)[0]; 
            changeProgWrap.opportunityDetails = opp;
            changeProgWrap.accountDetails = AccountData.queryAccount(opp.AccountId)[0];
            changeProgWrap.currentProgramRecordType = opp.RecordType.Name;
            changeProgWrap.oppRecordTypes = OpportunityData.queryRecordTypes();
            result.data = JSON.serialize(changeProgWrap);
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }
    
    @AuraEnabled
    public static ApexActionResult changeProgram(String changeProgramDetails, Boolean isBuyout, String targetProgramId, String currentProgram, String targetProgramName) {
        final String SCOPE = 'ChangeProgramController.changeProgram';
        ApexActionResult result = new ApexActionResult(SCOPE);
        ChangeProgramWrapper changeProgWrap = new ChangeProgramWrapper();
        try{
            ApexUtil.requireValue('Change Program Details', changeProgramDetails);
            ApexUtil.requireValue('Target Program Id', targetProgramId);
            Map<String, Object> changeProgramMap = (Map<String, Object>) JSON.deserializeUntyped(changeProgramDetails);
            if(changeProgramMap.containsKey('opportunityDetails')){
                String opportunityRec = JSON.serialize(changeProgramMap.get('opportunityDetails'));
                Opportunity oppDML = (Opportunity)JSON.deserialize(opportunityRec, Opportunity.class);                
                oppDML.RecordTypeId = targetProgramId;                
                
                if(changeProgramMap.containsKey('accountDetails')){
                    String acctRec = JSON.serialize(changeProgramMap.get('accountDetails'));
                    Account acctDML = (Account)JSON.deserialize(acctRec, Account.class);
                    String Description = '';
                    String Subject = '';
                    if((acctDML.External_SAS_Id__c != null || acctDML.External_RAM_Id__c != null) && isBuyout){
                        acctDML.Bank_Account_Sync_Status__c = '';
                        acctDML.External_SAS_Id__c = '';
                        acctDML.External_RAM_Id__c = '';
                        acctDML.Sync_Status__c = '';
                        UPDATE acctDML;
                        
                        oppDML.Sub_Disposition__c = 'High UCC Risk';
                        String processorType = acctDML.External_SAS_Id__c != null ? 'External SAS Id' : acctDML.External_RAM_Id__c != null ? 'External RAM Id' : '';
                        Description = 'The client has been moved from '+ currentProgram +' to '+ targetProgramName +'. Accordingly, the Account Status has been updated to Active.'+
                                            ' The '+processorType +' has been removed, and the Sync Status and Bank Account Sync Status fields have been cleared.';
                        Subject = 'Account moved to Active status as the '+ targetProgramName +' program is activated.';
                        Task taskInstance = SystemActivityService.createSystemActivity(Subject,Description, acctDML.Id);
                        INSERT taskInstance;
                    }else {
                        if(isBuyout){
                            oppDML.Sub_Disposition__c = 'High UCC Risk';
                        }else if(currentProgram == 'Buyout'){
                            acctDML.HIGH_UCC_RISK__c = false;
                            UPDATE acctDML;
                        }
                        
                        Description = 'The client has been moved from '+ currentProgram +' to '+ targetProgramName +'. Accordingly, the Account Status has been updated to Active.';
                        Subject = 'Account moved to Active status as the '+ targetProgramName +' program is activated.';
                        Task taskInstance = SystemActivityService.createSystemActivity(Subject,Description, acctDML.Id);
                        INSERT taskInstance; 
                    }               
                }
                OpportunityLockService.disableOppLockForSystemUpdates();
                UPDATE oppDML;   
                OpportunityLockService.reEnableOppLockAsSystemUpdatesDone();
            }            
            
        } catch (Exception ex) {
            result.thrown(ex);
        }
        return result;
    }

    @AuraEnabled
    public static ApexActionResult setCustomerStatus(String acctId) {
        final String SCOPE = 'ChangeProgramController.setCustomerStatus';
        ApexActionResult result = new ApexActionResult(SCOPE);
        try{        
            Account acct = AccountData.queryAccount(acctId)[0];       
            Boolean isSuccessAPI = false;     
            /*String currentClientStatus = acct.Client_Status__c != null ? acct.Client_Status__c : '';               
            String uniqueIdentifier = PicklistValueTransitionHelper.generateAccountStatusUniqueIdentifer(currentClientStatus, AccountUtil.CLIENT_STATUS_CANCELLED);*/
            String processorStatus = '';
            ChangeProgramWrapper changeProgWrap = new ChangeProgramWrapper();
            /*if(uniqueIdentifier != null){
                Map<String, Boolean> identifierMap = PicklistValueTransitionHelper.verifyPicklistTransition(new Set<String>{uniqueIdentifier});
                if(identifierMap.containsKey(uniqueIdentifier) && identifierMap.get(uniqueIdentifier)){*/
                    Account_Status_Mapping__mdt acctMappingMdt = AccountStatusMDT.filterByClientStatus(AccountUtil.CLIENT_STATUS_CANCELLED);
                    if(acct.External_SAS_Id__c != null && acctMappingMdt != null) {  
                        isSuccessAPI = ProcessorAPI.setCustomerStatus(acctId, acctMappingMdt.SAS_Status_Lookup_Id__c); 
                        changeProgWrap.setCustomerStatus = isSuccessAPI;
                        processorStatus = acctMappingMdt.Processor_Status__c;                               
                    } else if(acct.External_RAM_Id__c != null && acctMappingMdt != null){
                        isSuccessAPI = ProcessorAPI.setCustomerStatus(acctId, acctMappingMdt.RAM_Processor_Status__c);
                        changeProgWrap.setCustomerStatus = isSuccessAPI; 
                        processorStatus = acctMappingMdt.Processor_Status__c;    
                    }
                    if(isSuccessAPI){
                       Account updateAcct = new Account(Id = acct.Id, Status__c = processorStatus); 
                       UPDATE updateAcct;
                    }
                //}
            //}
            result.data = JSON.serialize(changeProgWrap);
        }catch (Exception ex) {
            result.thrown(ex);
        }
        return result;        
    }

    public class ChangeProgramWrapper {
        public List<RecordType> oppRecordTypes;
        public String currentProgramRecordType;
        public Account accountDetails;
        public Opportunity opportunityDetails;
        public Boolean setCustomerStatus;
        public Boolean picklistTransitionStatus;
    }
    
}