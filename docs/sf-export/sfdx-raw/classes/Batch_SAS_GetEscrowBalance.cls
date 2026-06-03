public without sharing class Batch_SAS_GetEscrowBalance implements Database.Batchable<SObject>, Database.AllowsCallouts, Database.Stateful,Schedulable  {
    
        public String query;
        public Integer batchSize = 5;
        
        public Batch_SAS_GetEscrowBalance (String query,Integer batchSize) {
            this.query = query;
            if (batchSize != null && batchSize > 0) {
                this.batchSize = batchSize;
            }
        }
        
        public Batch_SAS_GetEscrowBalance(){
            this.query = 'SELECT Id, External_SAS_Id__c,Client_Status__c FROM Account WHERE External_SAS_Id__c != null AND (Escrow_Balance_Pulled_Date_Time__c < LAST_N_DAYS:7 OR Escrow_Balance_Pulled_Date_Time__c = null)';
        }        
        
        public Database.QueryLocator start(Database.BatchableContext bc){        
            return Database.getQueryLocator(this.query);
        } 
        
        public void execute(Database.BatchableContext bc, List<Account> scope) {
            List<Account> updateAccount = new List<Account>();
            for(Account acc: scope){
                try {
                    ProcessorWrapper.API_Response customerResponse = SASApi.getCustomerDetails(acc.Id);
                    if(customerResponse.isSuccess == true && customerResponse.ProcessData != null){
                        List<SASWrapper.ProcessDataDetails> processDataList = (List<SASWrapper.ProcessDataDetails>)JSON.deserialize(customerResponse.ProcessData, List<SASWrapper.ProcessDataDetails>.class); 
                        if(processDataList!= null) {
                            Account acct = new Account (Id = acc.Id, Escrow_Balance__c = processDataList[0].balance, Escrow_Balance_Pulled_Date_Time__c = System.now());            
                            updateAccount.add(acct);
                        }
                    }                 
                }catch (Exception exp) {
                    ApplicationLogger.logException('Batch_SAS_GetEscrowBalance', acc.Id, exp.getMessage());
                }
            }
            ApplicationLOgger.insertStoredLogs();
            
            for (Database.UpsertResult acctInst: Database.upsert(updateAccount, false)) {
                if (!acctInst.isSuccess()) {           
                    for (Database.Error err : acctInst.getErrors()) {
                        ApplicationLogger.logDMLException(
                            'Account fields that affected this error : ' + String.join(err.getFields(), ', '), 
                            acctInst.getId(), err.getStatuscode() + ': ' + err.getMessage()
                        );
                    }
                }
            }
        }
        
        public void finish(Database.BatchableContext bc) {
        }
        
        public void execute(SchedulableContext sc) {
            Database.executeBatch(new Batch_SAS_GetEscrowBalance(), this.batchSize);
        }
}